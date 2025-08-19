import { NextResponse } from "next/server";
import { DatabaseFactory } from "@/lib/database-factory";
import { getAuthenticatedUser, createUnauthorizedResponse } from "@/lib/auth-utils";

// GET /api/history/counts - Get total counts for inspections and projects
export async function GET(request: Request) {
  try {
    console.log("API: Fetching total counts");
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      console.log("API: Unauthenticated request to counts endpoint");
      return createUnauthorizedResponse();
    }
    
    console.log(`API: Fetching total counts for user: ${userId}`);
    
    // Get local database services for the user
    const { inspections: inspectionService, projects: projectService } = await DatabaseFactory.getServices(userId);
    
    // Get total counts from local database
    const totalInspections = await inspectionService.getInspectionCount(userId);
    const totalProjects = await projectService.getProjectCount(userId);
    
    console.log(`API: Total counts from local database - Inspections: ${totalInspections}, Projects: ${totalProjects}`);
    
    // Return the counts
    return NextResponse.json({
      inspections: totalInspections,
      projects: totalProjects
    });
  } catch (error) {
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown Error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error(`API Error fetching total counts: ${errorName} - ${errorMessage}`);
    console.error(errorStack);
    
    // Return error response
    return NextResponse.json(
      { 
        error: "Failed to fetch total counts", 
        details: errorMessage,
        type: errorName,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
