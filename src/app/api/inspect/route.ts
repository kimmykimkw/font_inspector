import { NextRequest, NextResponse } from 'next/server';
import { inspectWebsite } from '@/server/services/inspectionService';
import { saveInspectionResult, saveFailedInspectionResult } from '@/server/services/firebaseService';
import { formatTimestamp } from '@/lib/server-utils';
import { getAuthenticatedUser, getAuthorizedUser, createUnauthorizedResponse } from '@/lib/auth-utils';
import { userActionLogger } from '@/lib/activity-logger';
import { incrementUserInspectionCount } from '@/lib/user-stats';
import { checkInspectionLimit } from '@/lib/limit-checker';

export async function POST(request: Request) {
  try {
    console.log('API: Processing inspection request');
    
    // Get authenticated and authorized user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      console.log("API: Unauthenticated request to inspect endpoint");
      return createUnauthorizedResponse();
    }
    
    const { userId, email } = userInfo;
    console.log(`API: Processing inspection request for user: ${userId} (${email})`);
    
    // Check inspection limits before processing
    const limitCheck = await checkInspectionLimit(userId, email);
    if (!limitCheck.allowed) {
      console.log(`API: Inspection limit exceeded for user ${userId}: ${limitCheck.reason}`);
      
      // Determine appropriate status code based on the reason
      let statusCode = 429; // Too Many Requests (default for limits)
      let errorType = 'Inspection limit exceeded';
      
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
    
    console.log(`API: Inspection limit check passed for user ${userId}: ${limitCheck.currentCount}/${limitCheck.limit}`);
    
    // Parse request body
    const body = await request.json();
    console.log('Request body:', body);
    
    // Handle permission check requests - return limit info without creating inspection
    if (body.permissionCheck) {
      console.log(`API: Permission check request for user: ${userId}`);
      return NextResponse.json({
        message: 'Permission check passed',
        currentCount: limitCheck.currentCount,
        limit: limitCheck.limit,
        canCreateInspection: true
      });
    }
    
    if (!body.urls || !Array.isArray(body.urls) || body.urls.length === 0) {
      return NextResponse.json(
        { error: 'Please provide at least one URL to inspect' },
        { status: 400 }
      );
    }

    // Get the first URL
    const url = body.urls[0];
    const projectId = body.projectId || null; // Extract project ID if provided
    
    console.log(`API: Inspecting URL: ${url}${projectId ? `, Project ID: ${projectId}` : ''} for user: ${userId}`);

    // Validate URL
    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Validate projectId if provided
    if (projectId && (typeof projectId !== 'string' || !projectId.trim())) {
      console.warn('API: Invalid projectId provided, will not associate inspection with project');
      return NextResponse.json(
        { error: 'Invalid projectId provided' },
        { status: 400 }
      );
    }

    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }

    try {
      // Use puppeteer service to inspect the website
      const result = await inspectWebsite(normalizedUrl);
      console.log(`API: Website inspection completed for ${normalizedUrl}`);
      
      // Save results to Firebase with user association
      console.log(`API: Saving inspection result to database for user ${userId}${projectId ? ` with projectId: ${projectId}` : ''}`);
      const savedInspection = await saveInspectionResult(normalizedUrl, result, projectId, userId);
      
      if (!savedInspection || !savedInspection.id) {
        console.error('API: Failed to save inspection to database');
        return NextResponse.json(
          { error: 'Failed to save inspection to database' },
          { status: 500 }
        );
      }
      
      console.log(`API: Inspection saved with ID: ${savedInspection.id} for user: ${userId}${projectId ? `, associated with project: ${projectId}` : ''}`);
      
      // Log activity and update user stats
      try {
        await userActionLogger.inspectionCreated(email, userId, savedInspection.id!, normalizedUrl);
        await incrementUserInspectionCount(userId);
        console.log(`API: Activity logged and stats updated for user: ${userId}`);
      } catch (logError) {
        console.error('API: Error logging activity or updating stats:', logError);
        // Don't fail the request if logging fails
      }
      
      // Return inspection result with Firebase document ID
      return NextResponse.json({
        _id: savedInspection.id, // Use this format for compatibility
        id: savedInspection.id,  // Also include the original id
        url: normalizedUrl,
        timestamp: formatTimestamp(savedInspection.timestamp),
        createdAt: formatTimestamp(savedInspection.createdAt || savedInspection.timestamp),
        updatedAt: formatTimestamp(savedInspection.updatedAt || savedInspection.timestamp),
        projectId: savedInspection.projectId || projectId, // Use saved projectId or the one from the request
        userId: savedInspection.userId,
        result: {
          downloadedFonts: result.downloadedFonts,
          fontFaceDeclarations: result.fontFaceDeclarations,
          activeFonts: result.activeFonts
        }
      });
    } catch (inspectionError) {
      console.error('API: Website inspection failed:', inspectionError);
      const errorMessage = inspectionError instanceof Error ? inspectionError.message : String(inspectionError);
      
      // Save failed inspection to database
      console.log(`API: Saving failed inspection to database for user ${userId}${projectId ? ` with projectId: ${projectId}` : ''}`);
      try {
        const savedFailedInspection = await saveFailedInspectionResult(normalizedUrl, errorMessage, projectId, userId);
        console.log(`API: Failed inspection saved with ID: ${savedFailedInspection.id} for user: ${userId}`);
        
        // Log activity for failed inspection
        try {
          await userActionLogger.inspectionCreated(email, userId, savedFailedInspection.id!, normalizedUrl);
          console.log(`API: Activity logged for failed inspection for user: ${userId}`);
        } catch (logError) {
          console.error('API: Error logging failed inspection activity:', logError);
        }
        
        // Return the failed inspection data instead of an error
        return NextResponse.json({
          _id: savedFailedInspection.id,
          id: savedFailedInspection.id,
          url: normalizedUrl,
          timestamp: formatTimestamp(savedFailedInspection.timestamp),
          createdAt: formatTimestamp(savedFailedInspection.createdAt || savedFailedInspection.timestamp),
          updatedAt: formatTimestamp(savedFailedInspection.updatedAt || savedFailedInspection.timestamp),
          projectId: savedFailedInspection.projectId || projectId,
          userId: savedFailedInspection.userId,
          status: 'failed',
          error: errorMessage,
          result: {
            downloadedFonts: [],
            fontFaceDeclarations: [],
            activeFonts: []
          }
        });
        
      } catch (saveError) {
        console.error('API: Error saving failed inspection to database:', saveError);
        // If we can't save failed inspection, return the original error
        return NextResponse.json(
          { 
            error: 'Website inspection failed',
            details: errorMessage,
            url: normalizedUrl
          },
          { status: 422 }
        );
      }
    }
  } catch (error) {
    console.error('API: Request processing error:', error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    // Return error response
    return NextResponse.json(
      {
        error: 'Failed to process inspection request',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 500 }
    );
  }
} 