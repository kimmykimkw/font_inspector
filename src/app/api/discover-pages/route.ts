import { NextRequest, NextResponse } from 'next/server';
import { PageDiscoveryService, PageDiscoveryOptions } from '@/lib/page-discovery';
import { getAuthorizedUser, createUnauthorizedResponse } from '@/lib/auth-utils';
import { checkProjectLimit } from '@/lib/limit-checker';
import logger from '@/lib/logger';

export async function POST(request: NextRequest) {
  const requestId = Math.random().toString(36).substring(2, 9);
  
  try {
    logger.info(`[${requestId}] Page discovery request received`);
    
    // Parse request body
    const body = await request.json();
    const { url, pageCount } = body;
    
    // Validate input
    if (!url || typeof url !== 'string') {
      logger.warn(`[${requestId}] Invalid URL provided: ${url}`);
      return NextResponse.json(
        { error: 'Valid URL is required' },
        { status: 400 }
      );
    }
    
    if (!pageCount || ![1, 5, 10].includes(pageCount)) {
      logger.warn(`[${requestId}] Invalid page count: ${pageCount}`);
      return NextResponse.json(
        { error: 'Page count must be 1, 5, or 10' },
        { status: 400 }
      );
    }
    
    // If requesting only 1 page, just return the original URL
    if (pageCount === 1) {
      logger.info(`[${requestId}] Single page requested, returning original URL`);
      return NextResponse.json({
        success: true,
        pages: [{ url, priority: 100, source: 'original' }],
        totalFound: 1
      });
    }
    
    // Authenticate and authorize user
    const userInfo = await getAuthorizedUser(request);
    if (!userInfo) {
      logger.warn(`[${requestId}] Unauthenticated page discovery request`);
      return createUnauthorizedResponse();
    }
    
    const { userId, email } = userInfo;
    
    // Check user limits for project creation (since multi-page becomes a project)
    const limitCheck = await checkProjectLimit(userId, email);
    if (!limitCheck.allowed) {
      logger.warn(`[${requestId}] User ${userId} exceeded project limits`);
      return NextResponse.json(
        { error: limitCheck.reason },
        { status: 429 }
      );
    }
    
    logger.info(`[${requestId}] Starting page discovery for ${url} (${pageCount} pages) - User: ${userId}`);
    
    // Normalize URL
    let normalizedUrl = url.trim();
    if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
      normalizedUrl = `https://${normalizedUrl}`;
    }
    
    // Discover pages
    const options: PageDiscoveryOptions = {
      maxPages: pageCount,
      timeout: 30000,
      includeSubdomains: false
    };
    
    const startTime = Date.now();
    const discoveredPages = await PageDiscoveryService.discoverPages(normalizedUrl, options);
    const discoveryTime = Date.now() - startTime;
    
    logger.info(`[${requestId}] Page discovery completed in ${discoveryTime}ms - Found ${discoveredPages.length} pages`);
    
    // Log discovered pages for debugging
    logger.debug(`[${requestId}] Discovered pages:`, discoveredPages.map(p => ({
      url: p.url,
      source: p.source,
      priority: p.priority
    })));
    
    return NextResponse.json({
      success: true,
      pages: discoveredPages,
      totalFound: discoveredPages.length,
      discoveryTimeMs: discoveryTime,
      requestId
    });
    
  } catch (error) {
    logger.error(`[${requestId}] Page discovery failed:`, error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Page discovery failed',
        details: errorMessage,
        requestId
      },
      { status: 500 }
    );
  }
}

// Handle GET requests (not supported)
export async function GET() {
  return NextResponse.json(
    { error: 'Method not allowed. Use POST to discover pages.' },
    { status: 405 }
  );
}
