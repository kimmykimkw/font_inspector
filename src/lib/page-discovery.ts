import puppeteer, { Browser, Page } from 'puppeteer-core';

export interface DiscoveredPage {
  url: string;
  title?: string;
  priority: number; // Higher number = higher priority
  source: 'original' | 'internal-link' | 'sitemap' | 'common-path';
}

export interface PageDiscoveryOptions {
  maxPages: number;
  timeout?: number;
  includeSubdomains?: boolean;
}

export class PageDiscoveryService {
  private static getChromePath(): string {
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

    if (!chromeExecutablePath || !fs.existsSync(chromeExecutablePath)) {
      throw new Error('Chrome/Chromium not found. Please install Google Chrome or set CHROME_PATH environment variable.');
    }

    return chromeExecutablePath;
  }

  static async discoverPages(baseUrl: string, options: PageDiscoveryOptions): Promise<DiscoveredPage[]> {
    const { maxPages, timeout = 30000, includeSubdomains = false } = options;
    
    // Normalize the base URL
    const normalizedBaseUrl = this.normalizeUrl(baseUrl);
    const baseDomain = new URL(normalizedBaseUrl);
    
    console.log(`🔍 Starting page discovery for ${normalizedBaseUrl} (max: ${maxPages} pages)`);
    
    let browser: Browser | null = null;
    const discoveredPages: Map<string, DiscoveredPage> = new Map();
    
    // Always include the original URL with highest priority
    discoveredPages.set(normalizedBaseUrl, {
      url: normalizedBaseUrl,
      priority: 100,
      source: 'original'
    });

    try {
      // Launch browser
      const chromeExecutablePath = this.getChromePath();
      browser = await puppeteer.launch({
        headless: true,
        executablePath: chromeExecutablePath,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-web-security',
          '--disable-cache',
          '--disk-cache-size=0',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-plugins'
        ],
        timeout: 60000
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36');

      // Step 1: Try to get sitemap.xml
      await this.discoverFromSitemap(baseDomain.origin, discoveredPages, maxPages);

      // Step 2: Crawl the main page for internal links
      await this.discoverFromMainPage(page, normalizedBaseUrl, baseDomain, discoveredPages, includeSubdomains, timeout);

      // Step 3: Try common paths
      await this.discoverCommonPaths(baseDomain.origin, discoveredPages, maxPages);

      console.log(`📊 Discovery complete: found ${discoveredPages.size} unique pages`);

    } catch (error) {
      console.error('❌ Page discovery error:', error);
      // Even if discovery fails, we still have the original URL
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    // Sort by priority and return top results
    const sortedPages = Array.from(discoveredPages.values())
      .sort((a, b) => b.priority - a.priority)
      .slice(0, maxPages);

    console.log(`✅ Returning ${sortedPages.length} pages:`, sortedPages.map(p => `${p.url} (${p.source})`));
    
    return sortedPages;
  }

  private static normalizeUrl(url: string): string {
    let normalized = url.trim();
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      normalized = `https://${normalized}`;
    }
    
    try {
      const urlObj = new URL(normalized);
      
      // Remove hash fragments (anchor links) - they don't represent different pages
      if (urlObj.hash) {
        console.log(`🔗 Removing hash fragment from: ${normalized} -> ${urlObj.origin + urlObj.pathname + urlObj.search}`);
      }
      urlObj.hash = '';
      
      // Remove common tracking/session parameters that don't change page content
      const paramsToRemove = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'fbclid', 'gclid', 'ref', 'source', 'campaign',
        'sessionid', 'sid', '_ga', '_gid', 'timestamp'
      ];
      
      paramsToRemove.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      normalized = urlObj.toString();
    } catch (error) {
      console.warn(`Failed to parse URL for normalization: ${normalized}`, error);
    }
    
    // Remove trailing slash for consistency
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    
    return normalized;
  }

  private static async discoverFromSitemap(baseOrigin: string, discoveredPages: Map<string, DiscoveredPage>, maxPages: number): Promise<void> {
    try {
      console.log('🗺️ Checking sitemap.xml...');
      
      const sitemapUrls = [
        `${baseOrigin}/sitemap.xml`,
        `${baseOrigin}/sitemap_index.xml`,
        `${baseOrigin}/sitemaps.xml`
      ];

      for (const sitemapUrl of sitemapUrls) {
        try {
          const response = await fetch(sitemapUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (compatible; FontInspector/1.0; +https://fontinspector.com)'
            },
            signal: AbortSignal.timeout(10000)
          });

          if (response.ok) {
            const sitemapText = await response.text();
            const urls = this.parseSitemap(sitemapText, baseOrigin);
            
            console.log(`📄 Found ${urls.length} URLs in sitemap`);
            
            urls.forEach((url, index) => {
              // Normalize the sitemap URL to prevent duplicates
              const normalizedUrl = this.normalizeUrl(url);
              
              if (discoveredPages.size < maxPages && !discoveredPages.has(normalizedUrl)) {
                discoveredPages.set(normalizedUrl, {
                  url: normalizedUrl,
                  priority: 80 - index, // Decrease priority for later items
                  source: 'sitemap'
                });
              }
            });
            
            break; // Stop after first successful sitemap
          }
        } catch (error) {
          // Try next sitemap URL
          continue;
        }
      }
    } catch (error) {
      console.log('⚠️ Sitemap discovery failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private static parseSitemap(sitemapXml: string, baseOrigin: string): string[] {
    const urls: string[] = [];
    
    // Simple regex to extract URLs from sitemap XML
    const urlMatches = sitemapXml.match(/<loc>(.*?)<\/loc>/g);
    
    if (urlMatches) {
      urlMatches.forEach(match => {
        const url = match.replace(/<\/?loc>/g, '').trim();
        if (url.startsWith(baseOrigin)) {
          urls.push(url);
        }
      });
    }
    
    return urls.slice(0, 50); // Limit sitemap results
  }

  private static async discoverFromMainPage(
    page: Page,
    baseUrl: string,
    baseDomain: URL,
    discoveredPages: Map<string, DiscoveredPage>,
    includeSubdomains: boolean,
    timeout: number
  ): Promise<void> {
    try {
      console.log('🏠 Crawling main page for links...');
      
      await page.goto(baseUrl, {
        waitUntil: 'networkidle2',
        timeout
      });

      // Get page title
      const pageTitle = await page.title().catch(() => undefined);
      
      // Update the original page with title
      const originalPage = discoveredPages.get(baseUrl);
      if (originalPage) {
        originalPage.title = pageTitle;
      }

      // Extract all internal links
      const links = await page.evaluate((baseOrigin, includeSubdomains) => {
        const links: { url: string; text: string }[] = [];
        const anchorElements = document.querySelectorAll('a[href]');
        
        anchorElements.forEach(anchor => {
          const href = anchor.getAttribute('href');
          if (!href) return;
          
          let absoluteUrl: string;
          
          try {
            if (href.startsWith('http')) {
              absoluteUrl = href;
            } else if (href.startsWith('/')) {
              absoluteUrl = baseOrigin + href;
            } else if (href.startsWith('#')) {
              return; // Skip anchor links
            } else {
              absoluteUrl = new URL(href, window.location.href).href;
            }
            
            const linkDomain = new URL(absoluteUrl);
            const baseDomainObj = new URL(baseOrigin);
            
            // Check if it's the same domain (or subdomain if allowed)
            const isSameDomain = includeSubdomains 
              ? linkDomain.hostname.endsWith(baseDomainObj.hostname)
              : linkDomain.hostname === baseDomainObj.hostname;
            
            if (isSameDomain && linkDomain.protocol.startsWith('http')) {
              links.push({
                url: absoluteUrl,
                text: (anchor.textContent || '').trim()
              });
            }
          } catch (error) {
            // Skip invalid URLs
          }
        });
        
        return links;
      }, baseDomain.origin, includeSubdomains);

      console.log(`🔗 Found ${links.length} internal links`);

      // Add discovered links with priority based on content
      links.forEach((link, index) => {
        // Normalize the link URL to prevent duplicates
        const normalizedUrl = this.normalizeUrl(link.url);
        
        if (!discoveredPages.has(normalizedUrl) && discoveredPages.size < 100) {
          const priority = this.calculateLinkPriority(normalizedUrl, link.text);
          discoveredPages.set(normalizedUrl, {
            url: normalizedUrl,
            title: link.text,
            priority: priority - (index * 0.1), // Slight penalty for later links
            source: 'internal-link'
          });
        }
      });

    } catch (error) {
      console.log('⚠️ Main page crawling failed:', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  private static async discoverCommonPaths(baseOrigin: string, discoveredPages: Map<string, DiscoveredPage>, maxPages: number): Promise<void> {
    console.log('📁 Checking common paths...');
    
    const commonPaths = [
      '/about',
      '/about-us',
      '/contact',
      '/contact-us',
      '/services',
      '/products',
      '/portfolio',
      '/blog',
      '/news',
      '/team',
      '/careers',
      '/support',
      '/help',
      '/faq',
      '/pricing',
      '/features'
    ];

    const checkPromises = commonPaths.map(async (path) => {
      if (discoveredPages.size >= maxPages) return;
      
      const url = `${baseOrigin}${path}`;
      if (discoveredPages.has(url)) return;

      try {
        const response = await fetch(url, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; FontInspector/1.0; +https://fontinspector.com)'
          },
          signal: AbortSignal.timeout(5000)
        });

        if (response.ok && response.status === 200) {
          // Normalize the common path URL to prevent duplicates
          const normalizedUrl = this.normalizeUrl(url);
          const priority = this.calculatePathPriority(path);
          
          if (!discoveredPages.has(normalizedUrl)) {
            discoveredPages.set(normalizedUrl, {
              url: normalizedUrl,
              priority,
              source: 'common-path'
            });
            console.log(`✅ Found common path: ${path}`);
          }
        }
      } catch (error) {
        // Path doesn't exist or is unreachable
      }
    });

    await Promise.allSettled(checkPromises);
  }

  private static calculateLinkPriority(url: string, linkText: string): number {
    let priority = 50; // Base priority for internal links
    
    const urlLower = url.toLowerCase();
    const textLower = linkText.toLowerCase();
    
    // Higher priority for important pages
    const highPriorityKeywords = ['about', 'contact', 'service', 'product', 'home', 'main'];
    const mediumPriorityKeywords = ['blog', 'news', 'team', 'portfolio', 'gallery'];
    
    highPriorityKeywords.forEach(keyword => {
      if (urlLower.includes(keyword) || textLower.includes(keyword)) {
        priority += 20;
      }
    });
    
    mediumPriorityKeywords.forEach(keyword => {
      if (urlLower.includes(keyword) || textLower.includes(keyword)) {
        priority += 10;
      }
    });
    
    // Lower priority for certain types
    const lowPriorityKeywords = ['login', 'register', 'admin', 'api', 'download', 'pdf'];
    lowPriorityKeywords.forEach(keyword => {
      if (urlLower.includes(keyword) || textLower.includes(keyword)) {
        priority -= 20;
      }
    });
    
    return Math.max(priority, 10); // Minimum priority of 10
  }

  private static calculatePathPriority(path: string): number {
    const priorityMap: Record<string, number> = {
      '/about': 70,
      '/about-us': 70,
      '/contact': 65,
      '/contact-us': 65,
      '/services': 60,
      '/products': 60,
      '/portfolio': 55,
      '/team': 50,
      '/blog': 45,
      '/news': 45,
      '/careers': 40,
      '/support': 40,
      '/help': 40,
      '/faq': 35,
      '/pricing': 35,
      '/features': 35
    };
    
    return priorityMap[path] || 30;
  }
}
