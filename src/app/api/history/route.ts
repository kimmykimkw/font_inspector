import { NextResponse } from "next/server";
import { getRecentInspections } from "@/lib/models/inspection";
import { db } from "@/lib/firebase";
import { getAuthenticatedUser, createUnauthorizedResponse } from "@/lib/auth-utils";

// GET /api/history - Fetch inspection history for authenticated user
export async function GET(request: Request) {
  try {
    console.log("API: Fetching inspection history");
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      console.log("API: Unauthenticated request to history endpoint");
      return createUnauthorizedResponse();
    }
    
    console.log(`API: Fetching inspection history for user: ${userId}`);
    
    // Debug: List all collections in Firestore to check names
    try {
      console.log("Attempting to list all collections in Firestore...");
      const collections = await db.listCollections();
      const collectionIds = collections.map(col => col.id);
      console.log("Available collections in Firestore:", collectionIds);
    } catch (err) {
      console.error("Error listing collections:", err);
    }
    
    // Get recent inspections from Firebase for this user
    const inspections = await getRecentInspections(50, userId); // Limit to 50 inspections for this user
    
    // Format inspections to match the frontend expected structure
    const formattedInspections = inspections.map(inspection => {
      // Safely handle timestamp conversions
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
      
      return {
        _id: inspection.id,
        url: inspection.url,
        timestamp: formatTimestamp(inspection.timestamp),
        downloadedFonts: inspection.downloadedFonts || [],
        activeFonts: inspection.activeFonts || [],
        createdAt: formatTimestamp(inspection.createdAt),
        updatedAt: formatTimestamp(inspection.updatedAt),
        projectId: inspection.projectId,
        userId: inspection.userId
      };
    });
    
    console.log(`API: Found ${inspections.length} inspection records for user ${userId}`);
    
    // Return the formatted inspection records as JSON
    return NextResponse.json(formattedInspections);
  } catch (error) {
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown Error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error(`API Error fetching inspection history: ${errorName} - ${errorMessage}`);
    console.error(errorStack);
    
    // Check for specific error types
    if (errorMessage.includes('Firebase') || errorMessage.includes('Firestore')) {
      console.error('Firebase connection error detected. Check service account credentials and database configuration.');
    }
    
    // Return error response
    return NextResponse.json(
      { 
        error: "Failed to fetch inspection history", 
        details: errorMessage,
        type: errorName,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
} 