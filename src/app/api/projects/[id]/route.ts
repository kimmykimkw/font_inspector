import { NextResponse } from "next/server";
import { getProjectById } from "@/lib/models/project";
import { getInspectionsByProjectId } from "@/lib/models/inspection";
import { getInspectionById, Inspection } from "@/lib/models/inspection";
import { deleteProject } from "@/lib/models/project";

// Helper function to safely format timestamps
const formatTimestamp = (timestamp: any) => {
  if (!timestamp) return new Date().toISOString();
  
  try {
    if (timestamp instanceof Date) {
      return timestamp.toISOString();
    }
    
    // Firebase Timestamp handling
    if (timestamp && typeof timestamp.toDate === 'function') {
      return timestamp.toDate().toISOString();
    }
    
    return new Date(timestamp).toISOString();
  } catch (err) {
    console.warn('Timestamp conversion error:', err);
    return new Date().toISOString();
  }
};

// GET /api/projects/[id] - Fetch a single project by ID
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    console.log(`API: Fetching project with ID: ${id}`);
    
    // Handle case when id is stringified object
    let projectId = id;
    try {
      // Check if the ID might be a stringified object
      if (id.startsWith('{') && id.endsWith('}')) {
        const parsed = JSON.parse(id);
        projectId = parsed.id || parsed._id || id;
        console.log(`API: Parsed project ID from JSON: ${projectId}`);
      }
    } catch (err) {
      console.log(`API: Not a JSON object: ${id}`);
    }
    
    // Get project from Firebase
    const project = await getProjectById(projectId);
    
    // If project not found, return 404
    if (!project) {
      console.log(`API: Project with ID ${projectId} not found`);
      return NextResponse.json(
        { error: "Project not found", details: `No project with ID ${projectId}` },
        { status: 404 }
      );
    }
    
    console.log(`API: Found project: ${project.name} with ${project.inspectionIds?.length || 0} inspectionIds`);
    
    // Get all inspections for this project
    let inspections: Inspection[] = [];
    try {
      inspections = await getInspectionsByProjectId(projectId);
      console.log(`API: Found ${inspections.length} inspections for project ${projectId}`);
      
      if (inspections.length === 0 && project.inspectionIds?.length > 0) {
        // We have inspectionIds but couldn't find any inspections, try to log the issue
        console.warn(`API: Project has ${project.inspectionIds.length} inspectionIds but no inspections were found.`);
        console.log(`API: InspectionIds in project:`, project.inspectionIds);
        
        // Try to fetch each inspection individually to see which ones might be missing
        for (const inspId of project.inspectionIds) {
          try {
            const insp = await getInspectionById(inspId);
            if (insp) {
              console.log(`API: Found inspection ${inspId} with projectId ${insp.projectId}`);
              inspections.push(insp);
            } else {
              console.warn(`API: Inspection ${inspId} not found`);
            }
          } catch (err) {
            console.error(`API: Error fetching inspection ${inspId}:`, err);
          }
        }
      }
    } catch (inspError) {
      console.error(`API: Error fetching inspections for project ${projectId}:`, inspError);
      // Continue anyway to at least return the project data
    }
    
    // Convert Firebase data format to the format expected by the frontend
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
    
    console.log(`API: Returning project with ID: ${projectId} with ${formattedProject.inspections?.length || 0} inspections`);
    
    // Return the formatted project as JSON
    return NextResponse.json(formattedProject);
  } catch (error) {
    console.error("API Error fetching project:", error);
    
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
    console.log(`API: Deleting project with ID: ${id}`);
    
    // Handle case when id is stringified object
    let projectId = id;
    try {
      // Check if the ID might be a stringified object
      if (id.startsWith('{') && id.endsWith('}')) {
        const parsed = JSON.parse(id);
        projectId = parsed.id || parsed._id || id;
        console.log(`API: Parsed project ID from JSON: ${projectId}`);
      }
    } catch (err) {
      console.log(`API: Not a JSON object: ${id}`);
    }
    
    // Delete project from Firebase (this also deletes associated inspections)
    const success = await deleteProject(projectId);
    
    if (!success) {
      console.log(`API: Project with ID ${projectId} not found or could not be deleted`);
      return NextResponse.json(
        { error: "Project not found or could not be deleted" },
        { status: 404 }
      );
    }
    
    console.log(`API: Successfully deleted project with ID: ${projectId}`);
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      message: "Project deleted successfully"
    });
  } catch (error) {
    console.error(`API Error deleting project:`, error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return error response
    return NextResponse.json(
      { error: "Failed to delete project", details: errorMessage },
      { status: 500 }
    );
  }
} 