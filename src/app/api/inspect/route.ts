import { NextRequest, NextResponse } from 'next/server';
import { inspectWebsite } from '@/server/services/inspectionService';
import { saveInspectionResult, saveFailedInspectionResult } from '@/server/services/firebaseService';
import { formatTimestamp } from '@/lib/server-utils';
import { getAuthenticatedUser, getAuthorizedUser, createUnauthorizedResponse } from '@/lib/auth-utils';
import { incrementUserInspectionCount } from '@/lib/user-stats';
import { checkInspectionLimit } from '@/lib/limit-checker';
import logger from '@/lib/logger';

export async function POST(request: Request) {
  try {
    logger.debug('Processing inspection request');
    
    // Get authenticated and authorized user
    const userInfo = await getAuthorizedUser(request);
    
    if (!userInfo) {
      logger.debug("Unauthenticated request to inspect endpoint");
      return createUnauthorizedResponse();
    }
    
    const { userId, email } = userInfo;
    logger.debug(`Processing inspection request for authenticated user`);
    
    // Check inspection limits before processing
    const limitCheck = await checkInspectionLimit(userId, email);
    if (!limitCheck.allowed) {
      logger.warn(`Inspection limit exceeded: ${limitCheck.reason}`);
      
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
    
    logger.debug(`Inspection limit check passed: ${limitCheck.currentCount}/${limitCheck.limit}`);
    
    // Parse request body
    const body = await request.json();
    logger.debug('Request body received');
    
    // Handle permission check requests - return limit info without creating inspection
    if (body.permissionCheck) {
      logger.debug(`Permission check request`);
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
    
    logger.debug(`Inspecting URL: ${url}${projectId ? ` for project` : ''}`);

    // Validate URL
    if (typeof url !== 'string' || !url.trim()) {
      return NextResponse.json(
        { error: 'Invalid URL provided' },
        { status: 400 }
      );
    }

    // Validate projectId if provided
    if (projectId && (typeof projectId !== 'string' || !projectId.trim())) {
      logger.warn('Invalid projectId provided, will not associate inspection with project');
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
      logger.debug(`Website inspection completed`);
      
      // Save results to Firebase with user association
      logger.debug(`Saving inspection result to database`);
      const savedInspection = await saveInspectionResult(normalizedUrl, result, projectId, userId);
      
      if (!savedInspection || !savedInspection.id) {
        logger.error('Failed to save inspection to database');
        return NextResponse.json(
          { error: 'Failed to save inspection to database' },
          { status: 500 }
        );
      }
      
      logger.info(`Inspection saved successfully`);
      
      // Update user stats
      try {
        await incrementUserInspectionCount(userId);
        logger.debug(`User stats updated`);
      } catch (logError) {
        logger.error('Error updating stats:', logError);
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
      logger.error('Website inspection failed:', inspectionError);
      const errorMessage = inspectionError instanceof Error ? inspectionError.message : String(inspectionError);
      
      // Save failed inspection to database
      logger.debug(`Saving failed inspection to database`);
      try {
        const savedFailedInspection = await saveFailedInspectionResult(normalizedUrl, errorMessage, projectId, userId);
        logger.info(`Failed inspection saved`);
        
        // Note: No stats update for failed inspections as they don't count towards user limits
        
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
        logger.error('Error saving failed inspection to database:', saveError);
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
    logger.error('Request processing error:', error);
    
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