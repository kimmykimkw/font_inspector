import puppeteer, { Browser, Page } from 'puppeteer-core';
import { extractFontMetadata, isLikelyParseable, getMetadataSummary } from '../../lib/font-metadata-extractor';

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
}

// Function to inspect a website for font usage
export async function inspectWebsite(url: string): Promise<InspectionResult> {
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
    
    // Navigate to the URL with a timeout
    console.log(`Navigating to ${url}...`);
    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });
      console.log(`Successfully navigated to ${url}`);
    } catch (navigationError) {
      console.error('Navigation error:', navigationError);
      
      // Provide more specific error messages based on the error type
      let errorMessage = 'Failed to load the website';
      
      if (navigationError instanceof Error) {
        const errorMsg = navigationError.message.toLowerCase();
        
        if (errorMsg.includes('timeout')) {
          errorMessage = 'Website took too long to respond (timeout after 30 seconds)';
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
        } else {
          errorMessage = `Failed to load the website: ${navigationError.message}`;
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
    
    return {
      downloadedFonts: processedFonts,
      fontFaceDeclarations,
      activeFonts
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