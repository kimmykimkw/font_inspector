import { NextResponse } from "next/server";
import { DatabaseFactory } from "@/lib/database-factory";
import { getAuthenticatedUser, createUnauthorizedResponse } from "@/lib/auth-utils";
import { formatTimestamp } from "@/lib/server-utils";
import logger from "@/lib/logger";

// GET /api/projects/[id] - Fetch a single project by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.debug(`API: Fetching project with ID: ${id}`);
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      logger.debug("Unauthenticated request to get project");
      return createUnauthorizedResponse();
    }
    
    // Handle case when id is stringified object
    let projectId = id;
    try {
      // Check if the ID might be a stringified object
      if (id.startsWith('{') && id.endsWith('}')) {
        const parsed = JSON.parse(id);
        projectId = parsed.id || parsed._id || id;
        logger.debug(`API: Parsed project ID from JSON: ${projectId}`);
      }
    } catch (err) {
      logger.debug(`API: Not a JSON object: ${id}`);
    }
    
    // Get local database services for the user
    const { projects: projectService, inspections: inspectionService } = await DatabaseFactory.getServices(userId);
    
    // Get project from local database
    const project = await projectService.getProject(projectId, userId);
    
    // If project not found or access denied, return 404
    if (!project) {
      logger.debug(`API: Project with ID ${projectId} not found or access denied`);
      return NextResponse.json(
        { error: "Project not found", details: "Project not found or access denied" },
        { status: 404 }
      );
    }
    
    logger.debug(`API: Found project: ${project.name} with ${project.inspectionIds?.length || 0} inspectionIds`);
    
    // Get all inspections for this project from local database
    let inspections: any[] = [];
    try {
      inspections = await inspectionService.getInspectionsByProjectId(projectId);
      logger.debug(`API: Found ${inspections.length} inspections for project ${projectId}`);
    } catch (inspError) {
      logger.error(`API: Error fetching inspections for project ${projectId}:`, inspError);
      // Continue anyway to at least return the project data
    }
    
    // Convert local database format to the format expected by the frontend
    const formattedProject = {
      _id: project.id,
      name: project.name,
      description: project.description,
      createdAt: formatTimestamp(project.createdAt),
      updatedAt: formatTimestamp(project.updatedAt),
      inspections: inspections.map(inspection => ({
        _id: inspection.id,
        url: inspection.url,
        timestamp: formatTimestamp(inspection.timestamp),
        downloadedFonts: inspection.downloadedFonts || [],
        activeFonts: inspection.activeFonts || [],
        fontFaceDeclarations: inspection.fontFaceDeclarations || [],
        createdAt: formatTimestamp(inspection.createdAt),
        updatedAt: formatTimestamp(inspection.updatedAt),
        projectId: inspection.projectId,
        status: inspection.status,
        error: inspection.error
      }))
    };
    
    logger.debug(`API: Returning project with ID: ${projectId} with ${formattedProject.inspections?.length || 0} inspections`);
    
    // Return the formatted project as JSON
    return NextResponse.json(formattedProject);
  } catch (error) {
    logger.error("API Error fetching project:", error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    // Return error response
    return NextResponse.json(
      { 
        error: "Failed to fetch project", 
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[id] - Delete a project and all associated inspections
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    logger.debug(`API: Deleting project with ID: ${id}`);
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      logger.debug("Unauthenticated request to delete project");
      return createUnauthorizedResponse();
    }
    
    // Handle case when id is stringified object
    let projectId = id;
    try {
      // Check if the ID might be a stringified object
      if (id.startsWith('{') && id.endsWith('}')) {
        const parsed = JSON.parse(id);
        projectId = parsed.id || parsed._id || id;
        logger.debug(`API: Parsed project ID from JSON: ${projectId}`);
      }
    } catch (err) {
      logger.debug(`API: Not a JSON object: ${id}`);
    }
    
    // Get local database services for the user
    const { projects: projectService } = await DatabaseFactory.getServices(userId);
    
    // First, verify the project exists and belongs to the user
    const project = await projectService.getProject(projectId, userId);
    
    if (!project) {
      logger.debug(`API: Project with ID ${projectId} not found or access denied`);
      return NextResponse.json(
        { error: "Project not found or access denied" },
        { status: 404 }
      );
    }
    
    // Delete project from local database (this also deletes associated inspections)
    const success = await projectService.deleteProject(projectId);
    
    if (!success) {
      logger.debug(`API: Project with ID ${projectId} could not be deleted`);
      return NextResponse.json(
        { error: "Project could not be deleted" },
        { status: 500 }
      );
    }
    
    logger.debug(`API: Successfully deleted project with ID: ${projectId}`);
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      message: "Project deleted successfully"
    });
  } catch (error) {
    logger.error(`API Error deleting project:`, error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return error response
    return NextResponse.json(
      { error: "Failed to delete project", details: errorMessage },
      { status: 500 }
    );
  }
} 