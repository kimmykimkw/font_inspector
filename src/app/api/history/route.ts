import { NextResponse } from "next/server";
import { getRecentInspections, repairOrphanedInspections, searchInspections } from "@/lib/models/inspection";
import { db } from "@/lib/firebase";
import { getAuthenticatedUser, createUnauthorizedResponse } from "@/lib/auth-utils";
import { DatabaseFactory } from "@/lib/database-factory";
import { formatTimestamp } from "@/lib/server-utils";

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
    
    // Parse pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search');
    
    console.log(`API: Fetching inspection history for user: ${userId}, page: ${page}, limit: ${limit}${search ? `, search: "${search}"` : ''}`);
    
    // Get local database services for the user
    const { inspections: inspectionService } = await DatabaseFactory.getServices(userId);
    
    let inspections;
    
    if (search && search.trim()) {
      // Use search function if search term is provided
      inspections = await inspectionService.searchInspections(userId, search.trim(), limit);
    } else {
      // Use regular pagination if no search term
      const offset = (page - 1) * limit;
      inspections = await inspectionService.getInspectionsByUser(userId, {
        limit,
        offset,
        orderBy: 'createdAt',
        orderDirection: 'DESC'
      });
    }
    
    // Format inspections to match the frontend expected structure
    const formattedInspections = inspections.map(inspection => {
      
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
    
    // Return the formatted inspection records with pagination metadata
    return NextResponse.json({
      data: formattedInspections,
      pagination: {
        page: page,
        limit: limit,
        hasMore: inspections.length === limit // If we got exactly the limit, there might be more
      },
      isSearch: !!search
    });
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

// POST /api/history - Repair orphaned inspections for authenticated user
export async function POST(request: Request) {
  try {
    console.log("API: Repairing orphaned inspections");
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      console.log("API: Unauthenticated request to repair endpoint");
      return createUnauthorizedResponse();
    }
    
    console.log(`API: Starting repair for user: ${userId}`);
    
    // Run the repair function
    const repairResult = await repairOrphanedInspections(userId);
    
    console.log(`API: Repair completed - fixed ${repairResult.fixed} out of ${repairResult.total} inspections`);
    
    // Return the repair results
    return NextResponse.json({
      success: true,
      message: `Repair completed: fixed ${repairResult.fixed} out of ${repairResult.total} inspections`,
      fixed: repairResult.fixed,
      total: repairResult.total
    });
  } catch (error) {
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown Error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error(`API Error repairing orphaned inspections: ${errorName} - ${errorMessage}`);
    console.error(errorStack);
    
    // Return error response
    return NextResponse.json(
      { 
        error: "Failed to repair orphaned inspections", 
        details: errorMessage,
        type: errorName,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
} 