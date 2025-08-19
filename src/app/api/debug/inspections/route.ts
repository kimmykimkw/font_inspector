import { NextResponse } from "next/server";
import { collections } from "@/lib/firebase";
import { getAuthenticatedUser, createUnauthorizedResponse } from "@/lib/auth-utils";

// GET /api/debug/inspections - Debug inspection data for authenticated user
export async function GET(request: Request) {
  try {
    console.log("API: Debug inspection data");
    
    // Get authenticated user
    const userId = await getAuthenticatedUser(request);
    
    if (!userId) {
      console.log("API: Unauthenticated request to debug endpoint");
      return createUnauthorizedResponse();
    }
    
    console.log(`API: Debugging inspections for user: ${userId}`);
    
    // Get URL parameter for filtering
    const url = new URL(request.url);
    const searchUrl = url.searchParams.get('url');
    
    // Query all inspections for this user
    let query = collections.inspections.where('userId', '==', userId);
    
    // If URL is provided, filter by it
    if (searchUrl) {
      query = query.where('url', '==', searchUrl);
      console.log(`API: Filtering by URL: ${searchUrl}`);
    }
    
    const snapshot = await query.get();
    
    console.log(`API: Found ${snapshot.docs.length} inspections for user ${userId}`);
    
    const inspections = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        url: data.url,
        userId: data.userId,
        projectId: data.projectId,
        status: data.status,
        timestamp: data.timestamp,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        hasDownloadedFonts: (data.downloadedFonts?.length || 0) > 0,
        hasActiveFonts: (data.activeFonts?.length || 0) > 0,
        hasScreenshots: !!data.screenshots
      };
    });
    
    // Also check for inspections without userId (potential orphans)
    const orphanQuery = collections.inspections.where('userId', '==', null);
    const orphanSnapshot = await orphanQuery.get();
    
    const orphanInspections = orphanSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        url: data.url,
        userId: data.userId,
        projectId: data.projectId,
        status: data.status,
        timestamp: data.timestamp,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
        isOrphan: true
      };
    });
    
    console.log(`API: Found ${orphanInspections.length} orphaned inspections`);
    
    // Return debug information
    return NextResponse.json({
      success: true,
      userId,
      searchUrl: searchUrl || null,
      userInspections: {
        count: inspections.length,
        data: inspections
      },
      orphanedInspections: {
        count: orphanInspections.length,
        data: orphanInspections
      },
      summary: {
        totalInspections: inspections.length,
        orphanedInspections: orphanInspections.length,
        recentInspections: inspections
          .sort((a, b) => {
            const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : new Date(a.timestamp).getTime();
            const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : new Date(b.timestamp).getTime();
            return bTime - aTime;
          })
          .slice(0, 5)
      }
    });
  } catch (error) {
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorName = error instanceof Error ? error.name : 'Unknown Error';
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    console.error(`API Error debugging inspections: ${errorName} - ${errorMessage}`);
    console.error(errorStack);
    
    // Return error response
    return NextResponse.json(
      { 
        error: "Failed to debug inspections", 
        details: errorMessage,
        type: errorName,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
}
