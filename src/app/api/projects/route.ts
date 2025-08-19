import { NextResponse } from "next/server";
import { getAllProjects, getRecentProjectsPaginated, searchProjects } from "@/lib/models/project";
import { getInspectionsByProjectId } from "@/lib/models/inspection";
import { createProject } from "@/lib/models/project"; 
import { formatTimestamp } from "@/lib/server-utils";
import { getAuthenticatedUser, getAuthorizedUser, createUnauthorizedResponse } from "@/lib/auth-utils";
import { incrementUserProjectCount } from "@/lib/user-stats";
import { checkProjectLimit } from "@/lib/limit-checker";
import { DatabaseFactory } from "@/lib/database-factory";
import logger from "@/lib/logger";

// GET /api/projects - Fetch projects for authenticated user with pagination support
export async function GET(request: Request) {
  try {
    logger.debug("Fetching projects");
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      logger.debug("Unauthenticated request to projects endpoint");
      return createUnauthorizedResponse();
    }
    
    // Parse pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search');
    
    logger.debug(`Fetching projects for authenticated user, page: ${page}, limit: ${limit}${search ? `, search: "${search}"` : ''}`);
    
    // Get local database services for the user
    const { projects: projectService, inspections: inspectionService } = await DatabaseFactory.getServices(userId);
    
    let projects;
    
    if (search && search.trim()) {
      // Use search function if search term is provided
      projects = await projectService.searchProjects(userId, search.trim(), limit);
    } else {
      // Get projects from local database for this user (paginated if page/limit provided)
      const offset = (page - 1) * limit;
      projects = await projectService.getProjectsByUser(userId, {
        limit,
        offset,
        orderBy: 'createdAt',
        orderDirection: 'DESC'
      });
    }
    
    // Format projects to match the frontend expected structure
    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        const inspections = await inspectionService.getInspectionsByProjectId(project.id as string);
        
        return {
          _id: project.id,
          name: project.name,
          description: project.description,
          createdAt: formatTimestamp(project.createdAt),
          updatedAt: formatTimestamp(project.updatedAt),
          userId: project.userId,
          inspections: inspections.map(inspection => ({
            _id: inspection.id,
            url: inspection.url,
            timestamp: formatTimestamp(inspection.timestamp),
            downloadedFonts: inspection.downloadedFonts || [],
            activeFonts: inspection.activeFonts || [],
            createdAt: formatTimestamp(inspection.createdAt),
            updatedAt: formatTimestamp(inspection.updatedAt),
            projectId: inspection.projectId,
            userId: inspection.userId
          }))
        };
      })
    );
    
    logger.info(`Found ${projects.length} projects for user`);
    
    // Return formatted projects with pagination metadata if paginated or searching
    if (page > 1 || limit !== 50 || search) {
      return NextResponse.json({
        data: formattedProjects,
        pagination: {
          page: page,
          limit: limit,
          hasMore: projects.length === limit
        },
        isSearch: !!search
      });
    } else {
      // Return legacy format for backward compatibility
      return NextResponse.json(formattedProjects);
    }
  } catch (error) {
    logger.error("Error fetching projects:", error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    // Return error response
    return NextResponse.json(
      { 
        error: "Failed to fetch projects", 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

// POST /api/projects - Create a new project for authenticated user
export async function POST(request: Request) {
  const requestId = Math.random().toString(36).substring(2, 9);
  
  try {
    logger.debug(`Creating a new project`);
    
    // Get authenticated and authorized user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      logger.debug(`Unauthenticated request to create project`);
      return createUnauthorizedResponse();
    }
    
    const { userId, email } = userInfo;
    logger.debug(`Creating project for authenticated user`);
    
    // Check project limits before processing
    const limitCheck = await checkProjectLimit(userId, email);
    if (!limitCheck.allowed) {
      logger.warn(`Project limit exceeded: ${limitCheck.reason}`);
      
      // Determine appropriate status code based on the reason
      let statusCode = 429; // Too Many Requests (default for limits)
      let errorType = 'Project limit exceeded';
      
      if (limitCheck.reason?.includes('restricted') || limitCheck.reason?.includes('suspended')) {
        statusCode = 403; // Forbidden (permission denied)
        errorType = 'Access denied';
      } else if (limitCheck.reason?.includes('Database not available') || limitCheck.reason?.includes('Error checking limits')) {
        statusCode = 503; // Service Unavailable
        errorType = 'Service temporarily unavailable';
      }
      
      return NextResponse.json(
        { 
          error: errorType,
          message: limitCheck.reason,
          details: limitCheck.reason,
          currentCount: limitCheck.currentCount,
          limit: limitCheck.limit
        },
        { status: statusCode }
      );
    }
    
    logger.debug(`Project limit check passed: ${limitCheck.currentCount}/${limitCheck.limit}`);
    
    // Parse request body
    const body = await request.json();
    logger.debug(`Request body received`);
    
    // Handle permission check requests - return limit info without creating project
    if (body.permissionCheck) {
      logger.debug(`Permission check request`);
      return NextResponse.json({
        message: 'Permission check passed',
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit,
        canCreateProject: true
      });
    }
    
    if (!body.name) {
      logger.warn(`Missing required field 'name'`);
      return NextResponse.json(
        { error: "Missing required field", details: "Project name is required" },
        { status: 400 }
      );
    }
    
    // Get local database services for the user
    const { projects: projectService } = await DatabaseFactory.getServices(userId);
    
    // Create project in local database with inspectionIds if provided and associate with user
    logger.debug(`Creating project: "${body.name}"`);
    const project = await projectService.createProject({
      name: body.name,
      description: body.description || "",
      userId: userId, // Associate project with authenticated user
      inspectionIds: body.inspectionIds || [], // Handle inspectionIds from request body
    });
    
    logger.info(`Project created successfully: ${project.name}`);
    
    // IMMEDIATELY update Firebase user stats (real-time requirement)
    try {
      await incrementUserProjectCount(userId);
      logger.debug(`Firebase user stats updated`);
    } catch (logError) {
      logger.error(`Error updating stats:`, logError);
      // Don't fail the request if logging fails
    }
    
    // Return created project with proper ID structure for frontend consumption
    return NextResponse.json({
      message: "Project created successfully",
      project: {
        _id: project.id, // This is the format expected by the frontend
        id: project.id,  // Also include the original id for reference
        name: project.name,
        description: project.description,
        createdAt: formatTimestamp(project.createdAt),
        updatedAt: formatTimestamp(project.updatedAt),
        userId: project.userId,
        inspectionIds: project.inspectionIds || [], // Ensure inspectionIds is always an array
        inspections: [] // Empty array for initial project creation, to maintain compatibility
      }
    });
  } catch (error) {
    logger.error(`Error creating project:`, error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    // Return error response
    return NextResponse.json(
      { 
        error: "Failed to create project", 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
} 