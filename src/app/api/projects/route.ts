import { NextResponse } from "next/server";
import { getAllProjects } from "@/lib/models/project";
import { getInspectionsByProjectId } from "@/lib/models/inspection";
import { createProject } from "@/lib/models/project"; 
import { formatTimestamp } from "@/lib/server-utils";
import { getAuthenticatedUser, getAuthorizedUser, createUnauthorizedResponse } from "@/lib/auth-utils";
import { userActionLogger } from "@/lib/activity-logger";
import { incrementUserProjectCount } from "@/lib/user-stats";
import { checkProjectLimit } from "@/lib/limit-checker";

// GET /api/projects - Fetch all projects for authenticated user
export async function GET(request: Request) {
  try {
    console.log("API: Fetching projects");
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      console.log("API: Unauthenticated request to projects endpoint");
      return createUnauthorizedResponse();
    }
    
    console.log(`API: Fetching projects for user: ${userId}`);
    
    // Get all projects from Firebase for this user
    const projects = await getAllProjects(userId);
    
    // Format projects to match the frontend expected structure
    const formattedProjects = await Promise.all(
      projects.map(async (project) => {
        const inspections = await getInspectionsByProjectId(project.id as string, userId);
        
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
    
    console.log(`API: Found ${projects.length} project records for user ${userId}`);
    
    // Return formatted projects
    return NextResponse.json(formattedProjects);
  } catch (error) {
    console.error("API Error fetching projects:", error);
    
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
    console.log(`[${requestId}] API: Creating a new project`);
    
    // Get authenticated and authorized user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      console.log(`[${requestId}] API: Unauthenticated request to create project`);
      return createUnauthorizedResponse();
    }
    
    const { userId, email } = userInfo;
    console.log(`[${requestId}] API: Creating project for user: ${userId} (${email})`);
    
    // Check project limits before processing
    const limitCheck = await checkProjectLimit(userId, email);
    if (!limitCheck.allowed) {
      console.log(`[${requestId}] API: Project limit exceeded for user ${userId}: ${limitCheck.reason}`);
      
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
    
    console.log(`[${requestId}] API: Project limit check passed for user ${userId}: ${limitCheck.currentCount}/${limitCheck.limit}`);
    
    // Parse request body
    const body = await request.json();
    console.log(`[${requestId}] Request body:`, body);
    
    // Handle permission check requests - return limit info without creating project
    if (body.permissionCheck) {
      console.log(`[${requestId}] API: Permission check request for user: ${userId}`);
      return NextResponse.json({
        message: 'Permission check passed',
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit,
        canCreateProject: true
      });
    }
    
    if (!body.name) {
      console.error(`[${requestId}] API Error: Missing required field 'name'`);
      return NextResponse.json(
        { error: "Missing required field", details: "Project name is required" },
        { status: 400 }
      );
    }
    
    // Create project in Firebase with inspectionIds if provided and associate with user
    console.log(`[${requestId}] Attempting to create project with name: "${body.name}"`);
    const project = await createProject({
      name: body.name,
      description: body.description || "",
      userId: userId, // Associate project with authenticated user
      inspectionIds: body.inspectionIds || [], // Handle inspectionIds from request body
    });
    
    console.log(`[${requestId}] API: Project created successfully:`, { 
      id: project.id, 
      name: project.name, 
      userId: project.userId,
      createdAt: project.createdAt
    });
    
    // Log activity and update user stats
    try {
      const urlCount = body.inspectionIds ? body.inspectionIds.length : 0;
      await userActionLogger.projectCreated(email, userId, project.id!, urlCount);
      await incrementUserProjectCount(userId);
      console.log(`[${requestId}] API: Activity logged and stats updated for user: ${userId}`);
    } catch (logError) {
      console.error(`[${requestId}] API: Error logging activity or updating stats:`, logError);
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
    console.error(`[${requestId}] API Error creating project:`, error);
    
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