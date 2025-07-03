import puppeteer, { Browser, Page } from 'puppeteer-core';
import { extractFontMetadata, isLikelyParseable, getMetadataSummary } from '../../lib/font-metadata-extractor';

// Utility function to check if running in Electron environment
function isElectronEnvironment(): boolean {
  const hasElectronEnv = process.env.ELECTRON_APP === 'true';
  const hasElectronVersions = typeof process.versions?.electron !== 'undefined';
  const isElectron = hasElectronEnv || hasElectronVersions;
  
  // Only log in development mode
  if (process.env.NODE_ENV === 'development') {
    console.log('🔍 Environment Detection:', {
      ELECTRON_APP: process.env.ELECTRON_APP,
      isElectron
    });
  }
  
  return isElectron;
}

// Interfaces for font metadata
export interface FontMetadata {
  foundry: string | null;           // Font foundry (Monotype, Adobe, etc.)
  copyright: string | null;         // Copyright notice
  version: string | null;           // Font version
  licenseInfo: string | null;       // License information
  embeddingPermissions: {    // Font embedding rights
    installable: boolean;
    editable: boolean;
    previewAndPrint: boolean;
    restrictedLicense: boolean;
  } | null;
  uniqueIdentifier: string | null;  // Font unique ID
  creationDate: string | null;      // Font creation date
  designer: string | null;          // Font designer
  fontName: string | null;          // Full font name
}

// Interfaces for font inspection results
export interface FontFile {
  name: string;
  format: string;
  size: number; // in bytes
  url: string;
  source: string; // CDN, Google Fonts, etc.
  websiteUrl?: string; // The website URL this font was found on
  metadata: FontMetadata | null; // Font metadata or null if not available
}

export interface FontFaceDeclaration {
  family: string;
  source: string;
  weight?: string;
  style?: string;
}

export interface ActiveFont {
  family: string;
  elementCount: number;
  preview?: string;
}

export interface InspectionResult {
  downloadedFonts: FontFile[];
  fontFaceDeclarations: FontFaceDeclaration[];
  activeFonts: ActiveFont[];
  screenshots?: {
    original: string;
    annotated: string;
    capturedAt: Date;
    dimensions: {
      width: number;
      height: number;
    };
    annotationCount: number;
  };
}

// Function to inspect a website for font usage
export async function inspectWebsite(url: string, options?: { 
  captureScreenshots?: boolean;
  userId?: string;
  inspectionId?: string;
}): Promise<InspectionResult> {
  let browser: Browser | null = null;
  
  try {
    // Launch a headless browser with cache disabled
    console.log('Launching browser...');
    try {
      const launchOptions: any = {
        headless: true,
        args: [
          '--no-sandbox', 
          '--disable-setuid-sandbox', 
          '--disable-web-security',
          '--disable-cache',  // Disable browser cache
          '--disk-cache-size=0', // Set disk cache size to 0
          '--disable-dev-shm-usage', // Prevent shm usage issues
          '--disable-extensions',
          '--disable-plugins',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI'
        ],
        timeout: 60000  // 60 second timeout for launch
      };

      // puppeteer-core requires explicit Chrome executable path
      const fs = require('fs');
      
      // Check for custom Chrome path first
      let chromeExecutablePath = process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN;
      
      if (!chromeExecutablePath) {
        // Try common Chrome installation paths
        const possibleChromePaths = [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
          '/Applications/Chromium.app/Contents/MacOS/Chromium', // macOS Chromium
          '/usr/bin/google-chrome-stable', // Linux
          '/usr/bin/google-chrome', // Linux
          '/usr/bin/chromium-browser', // Linux Chromium
          'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // Windows
          'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe', // Windows 32-bit
        ];

        for (const path of possibleChromePaths) {
          if (fs.existsSync(path)) {
            chromeExecutablePath = path;
            break;
          }
        }
      }

      if (chromeExecutablePath && fs.existsSync(chromeExecutablePath)) {
        launchOptions.executablePath = chromeExecutablePath;
        console.log(`Using Chrome at: ${chromeExecutablePath}`);
      } else {
        throw new Error('Chrome/Chromium not found. Please install Google Chrome or set CHROME_PATH environment variable.');
      }

      browser = await puppeteer.launch(launchOptions);
      console.log('Browser launched successfully');
    } catch (launchError) {
      console.error('Browser launch failed:', launchError);
      throw new Error(`Failed to launch browser: ${launchError instanceof Error ? launchError.message : 'Unknown browser launch error'}`);
    }
    
    // Open a new page
    const page = await browser.newPage();
    
    // Disable cache for consistent results
    await page.setCacheEnabled(false);
    
    // Set a user agent to avoid being blocked
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');
    
    // Clear all browser cookies for clean state
    const client = await page.target().createCDPSession();
    await client.send('Network.clearBrowserCookies');
    await client.send('Network.clearBrowserCache');
    
    // Set request interception to capture font files
    const downloadedFonts: FontFile[] = [];
    await setupRequestInterception(page, downloadedFonts);
    
    // Navigate to the URL with enhanced loading wait
    console.log(`Navigating to ${url}...`);
    try {
      await navigateAndWaitForFullLoad(page, url);
      console.log(`Successfully navigated to ${url} and waited for full load`);
    } catch (navigationError) {
      console.error('Navigation or loading error:', navigationError);
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to load the website completely';
      
      if (navigationError instanceof Error) {
        const errorMsg = navigationError.message.toLowerCase();
        
        if (errorMsg.includes('timeout')) {
          errorMessage = 'Website took too long to respond or load completely (timeout)';
        } else if (errorMsg.includes('net::err_name_not_resolved')) {
          errorMessage = 'Website domain could not be found (DNS resolution failed)';
        } else if (errorMsg.includes('net::err_connection_refused')) {
          errorMessage = 'Website refused the connection';
        } else if (errorMsg.includes('net::err_connection_timed_out')) {
          errorMessage = 'Connection to website timed out';
        } else if (errorMsg.includes('net::err_internet_disconnected')) {
          errorMessage = 'No internet connection available';
        } else if (errorMsg.includes('net::err_ssl_protocol_error')) {
          errorMessage = 'SSL/TLS connection error';
        } else if (errorMsg.includes('net::err_cert_')) {
          errorMessage = 'SSL certificate error';
        } else if (errorMsg.includes('evaluation failed')) {
          errorMessage = 'Website loading failed during content analysis (possibly due to JavaScript errors)';
        } else {
          errorMessage = `Failed to load the website completely: ${navigationError.message}`;
        }
      }
      
      throw new Error(errorMessage);
    }
    
    // Extract @font-face declarations from stylesheets
    console.log('Extracting @font-face declarations...');
    const fontFaceDeclarations = await extractFontFaceDeclarations(page);
    
    // Analyze active fonts on the page
    console.log('Analyzing active fonts...');
    const activeFonts = await analyzeActiveFonts(page);
    
    // Process results to ensure consistent font naming
    const processedFonts = processDownloadedFonts(downloadedFonts);
    
    // Capture screenshots if requested and in Electron environment
    let screenshotData;
    if (options?.captureScreenshots && options?.userId && options?.inspectionId && isElectronEnvironment()) {
      try {
        console.log('Capturing screenshots...');
        
        // Dynamically import screenshot service only in Electron environment
        const { screenshotManager, addFontAnnotations } = await import('./screenshotService');
        
        // Additional wait specifically for screenshot stability
        console.log('Final wait before screenshot capture...');
        await page.evaluate(() => {
          // Ensure page is scrolled to top for consistent screenshots
          window.scrollTo(0, 0);
          return new Promise(resolve => setTimeout(resolve, 500));
        });
        
        // Get page dimensions
        const dimensions = await page.evaluate(() => ({
          width: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
          height: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
        }));
        
        console.log(`Page dimensions: ${dimensions.width}x${dimensions.height}`);
        
        // Take original screenshot
        console.log('Taking original screenshot...');
        const originalScreenshot = await page.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        
        // Add font annotations
        console.log('Adding font annotations to page...');
        const annotationCount = await addFontAnnotations(page, { 
          activeFonts, 
          downloadedFonts: processedFonts 
        });
        console.log(`Added ${annotationCount} font annotations`);
        
        // Take annotated screenshot
        console.log('Taking annotated screenshot...');
        const annotatedScreenshot = await page.screenshot({ 
          fullPage: true,
          type: 'png'
        });
        
        // Save screenshots locally
        const screenshotPaths = await screenshotManager.saveInspectionScreenshot(
          options.userId,
          options.inspectionId,
          Buffer.from(originalScreenshot),
          Buffer.from(annotatedScreenshot),
          {
            url,
            capturedAt: new Date(),
            dimensions,
            annotationCount
          }
        );
        
        screenshotData = {
          original: screenshotPaths.original,
          annotated: screenshotPaths.annotated,
          capturedAt: new Date(),
          dimensions,
          annotationCount
        };
        
        console.log(`Screenshots captured and saved: ${annotationCount} font annotations`);
      } catch (screenshotError) {
        console.error('Error capturing screenshots:', screenshotError);
        console.log('Screenshots not available in non-Electron environment');
        // Continue without screenshots - don't fail the entire inspection
        screenshotData = undefined;
      }
    } else if (options?.captureScreenshots && (!options?.userId || !options?.inspectionId)) {
      console.log('Screenshot capture skipped: missing userId or inspectionId');
    } else if (options?.captureScreenshots && !isElectronEnvironment()) {
      console.log('Screenshot capture skipped: not in Electron environment');
    }
    
    return {
      downloadedFonts: processedFonts,
      fontFaceDeclarations,
      activeFonts,
      ...(screenshotData && { screenshots: screenshotData })
    };
  } catch (error) {
    console.error('Error during website inspection:', error);
    throw error;
  } finally {
    // Close the browser
    if (browser) {
      await browser.close();
      console.log('Browser closed');
    }
  }
}

/**
 * Enhanced navigation and loading function that waits for the website to fully load
 * before proceeding with analysis or screenshots
 */
async function navigateAndWaitForFullLoad(page: Page, url: string): Promise<void> {
  console.log('Using aggressive loading approach for fastest inspections...');
  console.log('Step 1: Initial navigation with networkidle2...');
  
  // Step 1: Basic navigation with networkidle2
  await page.goto(url, { 
    waitUntil: 'networkidle2',
    timeout: 30000 
  });
  
    console.log('Step 2: Parallel font loading and animation detection...');
  
  // Step 2 & 4: Run font loading and animation detection in parallel
  await Promise.all([
    // Font loading check
    page.evaluate(() => {
      return new Promise<void>((resolve) => {
        if ('fonts' in document) {
          // Use document.fonts.ready if available (modern browsers)
          (document as any).fonts.ready.then(() => {
            console.log('All fonts loaded via document.fonts.ready');
            resolve();
          }).catch(() => {
            // Fallback if fonts.ready fails
            console.log('Font loading check failed, continuing...');
            resolve();
          });
        } else {
          // Fallback for older browsers
          console.log('document.fonts not available, continuing...');
          resolve();
        }
      });
    }),
    
    // Animation detection check
    page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const elementsWithAnimations = Array.from(document.querySelectorAll('*')).filter(el => {
          const style = window.getComputedStyle(el);
          return style.animationName !== 'none' || style.transitionProperty !== 'none';
        });
        
        if (elementsWithAnimations.length === 0) {
          console.log('No animations detected');
          resolve();
          return;
        }
        
        console.log(`Found ${elementsWithAnimations.length} elements with animations/transitions`);
        
        let completedCount = 0;
        const totalCount = elementsWithAnimations.length;
        
        const checkComplete = () => {
          completedCount++;
          if (completedCount >= totalCount) {
            console.log('All animations/transitions completed');
            resolve();
          }
        };
        
        // Set a timeout to avoid waiting forever for animations
        const timeout = setTimeout(() => {
          console.log(`Animation timeout after 1s (${completedCount}/${totalCount} completed)`);
          resolve();
        }, 1000);
        
        elementsWithAnimations.forEach((element) => {
          element.addEventListener('animationend', checkComplete, { once: true });
          element.addEventListener('transitionend', checkComplete, { once: true });
        });
        
        // If no animations are actually running, resolve immediately
        setTimeout(() => {
          if (completedCount === 0) {
            console.log('No active animations detected, continuing...');
            clearTimeout(timeout);
            resolve();
          }
        }, 100);
      });
    })
  ]);
  
    console.log('Step 3: Parallel media loading and lazy-loading detection...');
  
  // Step 3: Run media loading and lazy-loading detection in parallel
  await Promise.all([
    // Media loading check
    page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const images = Array.from(document.querySelectorAll('img'));
        const videos = Array.from(document.querySelectorAll('video'));
        const mediaElements = [...images, ...videos];
        
        if (mediaElements.length === 0) {
          console.log('No media elements found');
          resolve();
          return;
        }
        
        let loadedCount = 0;
        const totalCount = mediaElements.length;
        
        const checkComplete = () => {
          loadedCount++;
          if (loadedCount >= totalCount) {
            console.log(`All ${totalCount} media elements loaded`);
            resolve();
          }
        };
        
        // Set a timeout to avoid waiting forever (aggressive: 3s)
        const timeout = setTimeout(() => {
          console.log(`Media loading timeout after 3s (${loadedCount}/${totalCount} loaded)`);
          resolve();
        }, 3000);
        
        mediaElements.forEach((element) => {
          if (element instanceof HTMLImageElement) {
            if (element.complete) {
              checkComplete();
            } else {
              element.addEventListener('load', checkComplete, { once: true });
              element.addEventListener('error', checkComplete, { once: true });
            }
          } else if (element instanceof HTMLVideoElement) {
            if (element.readyState >= 2) { // HAVE_CURRENT_DATA
              checkComplete();
            } else {
              element.addEventListener('loadeddata', checkComplete, { once: true });
              element.addEventListener('error', checkComplete, { once: true });
            }
          }
        });
        
        // Clear timeout if all media loads before timeout
        if (loadedCount >= totalCount) {
          clearTimeout(timeout);
        }
      });
    }),
    
    // Lazy-loading detection check
    page.evaluate(() => {
      return new Promise<void>((resolve) => {
        let lastHeight = document.body.scrollHeight;
        let attempts = 0;
        const maxAttempts = 1; // Aggressive: only 1 attempt
        
        const checkForNewContent = () => {
          // Scroll to bottom to trigger lazy loading
          window.scrollTo(0, document.body.scrollHeight);
          
          setTimeout(() => {
            const newHeight = document.body.scrollHeight;
            attempts++;
            
            if (newHeight > lastHeight && attempts < maxAttempts) {
              console.log(`New content detected, height: ${lastHeight} -> ${newHeight}`);
              lastHeight = newHeight;
              checkForNewContent();
            } else {
              // Scroll back to top for screenshot
              window.scrollTo(0, 0);
              console.log('Lazy loading check completed');
              resolve();
            }
          }, 500); // Aggressive: 500ms instead of 1000ms
        };
        
        checkForNewContent();
      });
    })
  ]);
  
  console.log('Step 4: Final wait for page stabilization...');
  
  // Step 4: Final wait for page to stabilize
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Step 5: Log loading summary for debugging
  const loadingSummary = await page.evaluate(() => {
    const imageCount = document.querySelectorAll('img').length;
    const videoCount = document.querySelectorAll('video').length;
    const scriptCount = document.querySelectorAll('script').length;
    const linkCount = document.querySelectorAll('link').length;
    const textLength = document.body.innerText?.length || 0;
    const hasVisibleContent = document.body.offsetHeight > 100;
    
    return {
      imageCount,
      videoCount,
      scriptCount,
      linkCount,
      textLength,
      hasVisibleContent,
      bodyHeight: document.body.offsetHeight,
      pageHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight)
    };
  });
  
  console.log('Enhanced page loading completed. Summary:', {
    images: loadingSummary.imageCount,
    videos: loadingSummary.videoCount,
    scripts: loadingSummary.scriptCount,
    stylesheets: loadingSummary.linkCount,
    textLength: loadingSummary.textLength,
    hasVisibleContent: loadingSummary.hasVisibleContent,
    bodyHeight: loadingSummary.bodyHeight,
    pageHeight: loadingSummary.pageHeight
  });
}

// Helper function to process downloaded fonts for consistency
function processDownloadedFonts(fonts: FontFile[]): FontFile[] {
  // Create a map to store unique fonts by name (not URL)
  const uniqueFontsByName = new Map<string, FontFile>();
  
  for (const font of fonts) {
    // If we haven't seen this font name yet, or if this one is larger (potentially more complete)
    if (!uniqueFontsByName.has(font.name) || uniqueFontsByName.get(font.name)!.size < font.size) {
      uniqueFontsByName.set(font.name, font);
    }
  }
  
  // Convert map back to array and sort by name for consistent ordering
  return Array.from(uniqueFontsByName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// Set up request interception to capture font downloads
async function setupRequestInterception(page: Page, downloadedFonts: FontFile[]) {
  await page.setRequestInterception(true);
  
  // Track processed URLs to avoid duplicates
  const processedFontUrls = new Set<string>();
  
  page.on('request', request => {
    // Continue with the request, but abort tracking pixels and analytics if needed
    const url = request.url();
    const resourceType = request.resourceType();
    
    if (resourceType === 'image' && (url.includes('tracking') || url.includes('analytics'))) {
      request.abort();
    } else {
      request.continue();
    }
  });
  
  page.on('response', async response => {
    try {
      const url = response.url();
      
      // Skip if we've already processed this URL
      if (processedFontUrls.has(url)) {
        return;
      }
      
      const contentType = response.headers()['content-type'] || '';
      
      // Check if the response is a font file
      if (
        contentType.includes('font') || 
        url.match(/\.(woff2?|ttf|otf|eot)($|\?)/i)
      ) {
        try {
          // Some responses might not be available or might be corrupt
          const buffer = await response.buffer().catch(err => {
            console.warn(`Could not get buffer for font at ${url}: ${err.message}`);
            return null;
          });
          
          if (!buffer) return;
          
          const size = buffer.length;
          
          // Extract font name from URL
          const urlParts = url.split('/');
          const fileName = urlParts[urlParts.length - 1].split('?')[0];
          
          // Determine font format
          let format = 'unknown';
          if (url.includes('.woff2')) format = 'woff2';
          else if (url.includes('.woff')) format = 'woff';
          else if (url.includes('.ttf')) format = 'ttf';
          else if (url.includes('.otf')) format = 'otf';
          else if (url.includes('.eot')) format = 'eot';
          
          // Determine source
          let source = 'self-hosted';
          if (url.includes('fonts.googleapis.com') || url.includes('fonts.gstatic.com')) {
            source = 'Google Fonts';
          } else if (url.includes('use.typekit.net') || url.includes('p.typekit.net')) {
            source = 'Adobe Fonts';
          } else if (url.includes('cloud.typography.com')) {
            source = 'Hoefler&Co';
          } else if (url.includes('fast.fonts.net')) {
            source = 'Monotype';
          } else if (url.includes('cdn')) {
            source = 'CDN';
          }
          
          // Extract font metadata
          let metadata: FontMetadata | null = null;
          try {
            // Convert Buffer to ArrayBuffer for font parsing
            const arrayBuffer = new ArrayBuffer(buffer.length);
            const uint8Array = new Uint8Array(arrayBuffer);
            uint8Array.set(buffer);
            
            // Attempt metadata extraction for all fonts
            console.log(`Extracting metadata for font: ${fileName} from ${url}`);
            metadata = await extractFontMetadata(arrayBuffer, url);
            console.log(`Metadata extracted successfully: ${getMetadataSummary(metadata)}`);
          } catch (metadataError) {
            console.warn(`Could not extract metadata for font ${fileName} at ${url}:`, 
              metadataError instanceof Error ? metadataError.message : 'Unknown error');
            // Continue without metadata - don't fail the entire inspection
            metadata = null;
          }
          
          // Add URL to processed set
          processedFontUrls.add(url);
          
          downloadedFonts.push({
            name: fileName,
            format,
            size,
            url,
            source,
            metadata
          });
          
          const metadataInfo = metadata ? ` | Metadata: ${getMetadataSummary(metadata)}` : '';
          console.log(`Font detected: ${fileName} (${format}, ${size} bytes) from ${source}${metadataInfo}`);
        } catch (error) {
          console.error('Error processing font response:', error);
        }
      }
    } catch (error) {
      // Ignore errors in response handling - just log them
      console.warn('Error handling response:', error);
    }
  });
  
  // Handle network errors
  page.on('error', error => {
    console.error('Page error:', error);
  });
}

// Extract @font-face declarations from stylesheets
async function extractFontFaceDeclarations(page: Page): Promise<FontFaceDeclaration[]> {
  return page.evaluate(() => {
    const fontFaceDeclarations: FontFaceDeclaration[] = [];
    
    // Helper function to parse font-face rules
    const parseFontFace = (cssText: string) => {
      const family = cssText.match(/font-family\s*:\s*['"]?([^'";]+)/i)?.[1] || '';
      const sources = cssText.match(/src\s*:([^;]+)/i)?.[1] || '';
      const weight = cssText.match(/font-weight\s*:\s*([^;]+)/i)?.[1] || '';
      const style = cssText.match(/font-style\s*:\s*([^;]+)/i)?.[1] || '';
      
      return {
        family,
        source: sources.trim(),
        weight: weight.trim() || undefined,
        style: style.trim() || undefined
      };
    };
    
    // Process all stylesheets
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        // Skip cross-origin stylesheets that can't be accessed
        if (sheet.href && new URL(sheet.href).origin !== window.location.origin) {
          continue;
        }
        
        const rules = sheet.cssRules || [];
        for (let i = 0; i < rules.length; i++) {
          const rule = rules[i];
          if (rule instanceof CSSFontFaceRule) {
            fontFaceDeclarations.push(parseFontFace(rule.cssText));
          }
        }
      } catch (error) {
        // Silently skip inaccessible stylesheets
        console.warn('Could not access stylesheet:', error);
      }
    }
    
    return fontFaceDeclarations;
  });
}

// Analyze which fonts are actively used on the page
async function analyzeActiveFonts(page: Page): Promise<ActiveFont[]> {
  return page.evaluate(() => {
    const fontUsage = new Map<string, number>();
    const previewText: Record<string, string> = {};
    
    // Get all text-containing elements
    const elements = document.querySelectorAll('*');
    
    elements.forEach(el => {
      // Skip elements with no text content
      if (!el.textContent?.trim()) return;
      
      // Get computed font family
      const style = window.getComputedStyle(el);
      const fontFamily = style.fontFamily;
      
      if (fontFamily) {
        // Clean up the font-family value and get the first font
        const primaryFont = fontFamily.split(',')[0].trim().replace(/["']/g, '');
        
        // Increment usage count
        fontUsage.set(primaryFont, (fontUsage.get(primaryFont) || 0) + 1);
        
        // Save a text sample if we don't have one yet
        if (!previewText[primaryFont] && el.textContent?.trim()) {
          // Get a sample of text (max 50 chars)
          previewText[primaryFont] = el.textContent.trim().substring(0, 50);
        }
      }
    });
    
    // Convert to array and sort by usage
    return Array.from(fontUsage.entries())
      .map(([family, elementCount]) => ({
        family,
        elementCount,
        preview: previewText[family]
      }))
      .sort((a, b) => b.elementCount - a.elementCount);
  });
} 