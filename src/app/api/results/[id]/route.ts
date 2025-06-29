import { NextResponse } from "next/server";
import { getInspectionById, deleteInspection } from "@/lib/models/inspection";
import { getAuthenticatedUser, createUnauthorizedResponse } from "@/lib/auth-utils";

// GET /api/results/[id] - Fetch a single inspection by ID for authenticated user
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Properly await the params object to prevent Next.js warning
    console.log(`API: Fetching inspection with ID: ${id}`);
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      console.log(`API: Unauthenticated request to get inspection ${id}`);
      return createUnauthorizedResponse();
    }
    
    console.log(`API: Fetching inspection ${id} for user: ${userId}`);
    
    // Get inspection from Firebase with user verification
    const inspection = await getInspectionById(id, userId);
    
    if (!inspection) {
      console.log(`API: Inspection with ID ${id} not found or not accessible by user ${userId}`);
      return NextResponse.json(
        { error: "Inspection not found or access denied" },
        { status: 404 }
      );
    }
    
    // Safely format timestamps
    const formatTimestamp = (timestamp: any) => {
      if (!timestamp) return new Date().toISOString();
      
      try {
        if (timestamp instanceof Date) {
          return timestamp.toISOString();
        }
        
        // Firebase Timestamp handling
        if (typeof timestamp.toDate === 'function') {
          return timestamp.toDate().toISOString();
        }
        
        return new Date(timestamp).toISOString();
      } catch (err) {
        console.warn('Timestamp conversion error:', err);
        return new Date().toISOString();
      }
    };
    
    // Format inspection to match the frontend expected structure
    const formattedInspection = {
      _id: inspection.id,
      url: inspection.url,
      timestamp: formatTimestamp(inspection.timestamp),
      downloadedFonts: inspection.downloadedFonts || [],
      fontFaceDeclarations: inspection.fontFaceDeclarations || [],
      activeFonts: inspection.activeFonts || [],
      createdAt: formatTimestamp(inspection.createdAt),
      updatedAt: formatTimestamp(inspection.updatedAt),
      projectId: inspection.projectId,
      userId: inspection.userId,
      ...(inspection.screenshots ? { 
        screenshots: {
          original: inspection.screenshots.original,
          annotated: inspection.screenshots.annotated,
          capturedAt: formatTimestamp(inspection.screenshots.capturedAt),
          dimensions: inspection.screenshots.dimensions,
          annotationCount: inspection.screenshots.annotationCount
        }
      } : {}) // Include screenshots if they exist
    };
    
    console.log(`API: Successfully retrieved inspection with ID: ${id} for user: ${userId}`);
    
    // Return the formatted inspection
    return NextResponse.json(formattedInspection);
  } catch (error) {
    console.error(`API Error fetching inspection:`, error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return error response
    return NextResponse.json(
      { error: "Failed to fetch inspection", details: errorMessage },
      { status: 500 }
    );
  }
} 

// DELETE /api/results/[id] - Delete an inspection by ID for authenticated user
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Properly await the params object to prevent Next.js warning
    console.log(`API: Deleting inspection with ID: ${id}`);
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      console.log(`API: Unauthenticated request to delete inspection ${id}`);
      return createUnauthorizedResponse();
    }
    
    console.log(`API: Deleting inspection ${id} for user: ${userId}`);
    
    // First verify the inspection belongs to the user
    const inspection = await getInspectionById(id, userId);
    
    if (!inspection) {
      console.log(`API: Inspection with ID ${id} not found or not accessible by user ${userId}`);
      return NextResponse.json(
        { error: "Inspection not found or access denied" },
        { status: 404 }
      );
    }
    
    // Delete the inspection
    const success = await deleteInspection(id);
    
    if (!success) {
      console.log(`API: Failed to delete inspection with ID ${id}`);
      return NextResponse.json(
        { error: "Failed to delete inspection" },
        { status: 500 }
      );
    }
    
    console.log(`API: Successfully deleted inspection with ID: ${id} for user: ${userId}`);
    
    // Return success response
    return NextResponse.json({ 
      success: true,
      message: "Inspection deleted successfully"
    });
  } catch (error) {
    console.error(`API Error deleting inspection:`, error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    // Return error response
    return NextResponse.json(
      { error: "Failed to delete inspection", details: errorMessage },
      { status: 500 }
    );
  }
} 