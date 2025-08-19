import { NextRequest, NextResponse } from 'next/server';
import { inspectWebsite } from '@/server/services/inspectionService';
import { saveInspectionResult } from '@/server/services/firebaseService';
import { formatTimestamp } from '@/lib/server-utils';
import { getAuthenticatedUser, getAuthorizedUser, createUnauthorizedResponse } from '@/lib/auth-utils';
import { incrementUserInspectionCount } from '@/lib/user-stats';
import { checkInspectionLimit } from '@/lib/limit-checker';
import { DatabaseFactory } from '@/lib/database-factory';
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
    logger.debug('Request body received:', JSON.stringify(body));
    
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
      // Generate a unique inspection ID for screenshot storage
      const crypto = require('crypto');
      const inspectionId = crypto.randomUUID();
      
      logger.info(`Starting inspection for URL: ${normalizedUrl}, User: ${userId}, Project: ${projectId || 'none'}, InspectionID: ${inspectionId}`);
      
      // Check if we're in Electron environment for screenshots
      const hasElectronEnv = process.env.ELECTRON_APP === 'true';
      const hasElectronVersions = typeof process.versions?.electron !== 'undefined';
      const isElectronEnv = hasElectronEnv || hasElectronVersions;
      
      // Log environment detection
      logger.debug(`Environment Detection: Electron = ${isElectronEnv}, Screenshots = ${isElectronEnv}`);
      
      // Use puppeteer service to inspect the website with screenshot options
      logger.info(`Calling inspectWebsite service for: ${normalizedUrl}`);
      const result = await inspectWebsite(normalizedUrl, {
        captureScreenshots: isElectronEnv, // Only enable screenshots in Electron
        userId: userId,
        inspectionId: inspectionId
      });
      logger.info(`Website inspection completed successfully for: ${normalizedUrl}`);
      logger.debug(`Inspection result summary: ${result.downloadedFonts?.length || 0} downloaded fonts, ${result.activeFonts?.length || 0} active fonts`);
      
      // Save results to local database with user association
      logger.info(`Saving inspection result to local database for: ${normalizedUrl}`);
      
      // Get local database services for the user
      const { inspections } = await DatabaseFactory.getServices(userId);
      
      // Prepare inspection data
      const inspectionData = {
        url: normalizedUrl,
        timestamp: new Date(),
        downloadedFonts: result.downloadedFonts || [],
        fontFaceDeclarations: result.fontFaceDeclarations || [],
        activeFonts: result.activeFonts || [],
        projectId: projectId,
        userId: userId,
        status: 'completed' as const,
        ...(result.screenshots ? { 
          screenshots: {
            original: result.screenshots.original,
            annotated: result.screenshots.annotated,
            capturedAt: result.screenshots.capturedAt,
            dimensions: result.screenshots.dimensions,
            annotationCount: result.screenshots.annotationCount
          }
        } : {})
      };
      
      const savedInspection = await inspections.createInspection(inspectionData);
      
      if (!savedInspection || !savedInspection.id) {
        logger.error(`Failed to save inspection to local database for URL: ${normalizedUrl}`);
        return NextResponse.json(
          { error: 'Failed to save inspection to database' },
          { status: 500 }
        );
      }
      
      logger.info(`Inspection saved successfully with ID: ${savedInspection.id} for URL: ${normalizedUrl}`);
      
      // IMMEDIATELY update Firebase user stats (real-time requirement)
      try {
        await incrementUserInspectionCount(userId);
        logger.debug(`Firebase user stats updated for user: ${userId}`);
      } catch (logError) {
        logger.error('Error updating stats:', logError);
        // Don't fail the request if logging fails
      }
      
      // Return inspection result with local database ID
      return NextResponse.json({
        _id: savedInspection.id, // Use this format for compatibility
        id: savedInspection.id,  // Also include the original id
        url: normalizedUrl,
        timestamp: formatTimestamp(savedInspection.timestamp),
        createdAt: formatTimestamp(savedInspection.createdAt),
        updatedAt: formatTimestamp(savedInspection.updatedAt),
        projectId: savedInspection.projectId || projectId, // Use saved projectId or the one from the request
        userId: savedInspection.userId,
        result: {
          downloadedFonts: savedInspection.downloadedFonts,
          fontFaceDeclarations: savedInspection.fontFaceDeclarations,
          activeFonts: savedInspection.activeFonts
        }
      });
    } catch (inspectionError) {
      logger.error(`Website inspection failed for URL: ${normalizedUrl}:`, inspectionError);
      const errorMessage = inspectionError instanceof Error ? inspectionError.message : String(inspectionError);
      const errorStack = inspectionError instanceof Error ? inspectionError.stack : 'No stack trace';
      
      // Log detailed error information
      logger.error(`Inspection Error Details:`);
      logger.error(`  URL: ${normalizedUrl}`);
      logger.error(`  User: ${userId}`);
      logger.error(`  Project: ${projectId || 'none'}`);
      logger.error(`  Error: ${errorMessage}`);
      logger.error(`  Stack: ${errorStack}`);
      
      // Don't save failed inspections to database - just return error response
      logger.info(`Inspection failed for URL: ${normalizedUrl}, not saving to database`);
      
      // Return error response for failed inspection
      return NextResponse.json(
        { 
          error: 'Website inspection failed',
          details: errorMessage,
          url: normalizedUrl,
          status: 'failed',
          message: errorMessage // Add message field for better error handling
        },
        { status: 422 }
      );
    }
  } catch (error) {
    logger.error('Request processing error:', error);
    
    // Get detailed error info
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : 'No stack trace';
    
    // Return error response (use 422 for consistency with inspection failures)
    return NextResponse.json(
      {
        error: 'Failed to process inspection request',
        details: errorMessage,
        message: errorMessage,
        status: 'failed',
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
      },
      { status: 422 }
    );
  }
} 