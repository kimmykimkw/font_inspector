import path from 'path';
import fs from 'fs-extra';
import { Page } from 'puppeteer-core';

export interface ScreenshotPaths {
  original: string;
  annotated: string;
}

export interface ScreenshotMetadata {
  inspectionId: string;
  url: string;
  capturedAt: Date;
  dimensions: {
    width: number;
    height: number;
  };
  annotationCount: number;
}

export class ScreenshotManager {
  private getBaseScreenshotDir(): string {
    // Use userData path for screenshots to persist across app updates
    // Handle case where app might not be available (e.g., during testing)
    try {
      // Dynamically import electron app to avoid import errors in non-Electron environments
      const { app } = require('electron');
      if (typeof app === 'undefined') {
        throw new Error('Electron app not available');
      }
      const userDataPath = app.getPath('userData');
      return path.join(userDataPath, 'screenshots');
    } catch (error) {
      // Fallback to temp directory if Electron app is not available
      console.warn('Electron app not available, using temp directory for screenshots');
      const os = require('os');
      return path.join(os.tmpdir(), 'font-inspector-screenshots');
    }
  }

  private getUserScreenshotDir(userId: string, type: 'inspections' | 'projects'): string {
    return path.join(this.getBaseScreenshotDir(), `user-${userId}`, type);
  }

  private getInspectionScreenshotDir(userId: string, inspectionId: string): string {
    return path.join(this.getUserScreenshotDir(userId, 'inspections'), inspectionId);
  }

  private getProjectScreenshotDir(userId: string, projectId: string, websiteDomain: string): string {
    return path.join(this.getUserScreenshotDir(userId, 'projects'), projectId, websiteDomain);
  }

  /**
   * Save screenshot for an individual inspection
   */
  async saveInspectionScreenshot(
    userId: string, 
    inspectionId: string, 
    originalScreenshot: Buffer,
    annotatedScreenshot: Buffer,
    metadata: Omit<ScreenshotMetadata, 'inspectionId'>
  ): Promise<ScreenshotPaths> {
    const dir = this.getInspectionScreenshotDir(userId, inspectionId);
    await fs.ensureDir(dir);
    
    const originalPath = path.join(dir, 'screenshot.png');
    const annotatedPath = path.join(dir, 'annotated.png');
    const metadataPath = path.join(dir, 'metadata.json');
    
    // Save screenshots
    await Promise.all([
      fs.writeFile(originalPath, originalScreenshot),
      fs.writeFile(annotatedPath, annotatedScreenshot),
      fs.writeFile(metadataPath, JSON.stringify({
        ...metadata,
        inspectionId,
        createdAt: new Date().toISOString()
      }, null, 2))
    ]);
    
    console.log(`Screenshots saved for inspection ${inspectionId} in ${dir}`);
    
    return {
      original: originalPath,
      annotated: annotatedPath
    };
  }

  /**
   * Save screenshot for a project website
   */
  async saveProjectScreenshot(
    userId: string, 
    projectId: string, 
    websiteDomain: string,
    originalScreenshot: Buffer,
    annotatedScreenshot: Buffer,
    metadata: Omit<ScreenshotMetadata, 'inspectionId'>
  ): Promise<ScreenshotPaths> {
    const dir = this.getProjectScreenshotDir(userId, projectId, websiteDomain);
    await fs.ensureDir(dir);
    
    const originalPath = path.join(dir, 'screenshot.png');
    const annotatedPath = path.join(dir, 'annotated.png');
    const metadataPath = path.join(dir, 'metadata.json');
    
    // Save screenshots
    await Promise.all([
      fs.writeFile(originalPath, originalScreenshot),
      fs.writeFile(annotatedPath, annotatedScreenshot),
      fs.writeFile(metadataPath, JSON.stringify({
        ...metadata,
        projectId,
        websiteDomain,
        createdAt: new Date().toISOString()
      }, null, 2))
    ]);
    
    console.log(`Screenshots saved for project ${projectId}, website ${websiteDomain} in ${dir}`);
    
    return {
      original: originalPath,
      annotated: annotatedPath
    };
  }

  /**
   * Check if screenshots exist for an inspection
   */
  async inspectionScreenshotsExist(userId: string, inspectionId: string): Promise<boolean> {
    const dir = this.getInspectionScreenshotDir(userId, inspectionId);
    const originalPath = path.join(dir, 'screenshot.png');
    const annotatedPath = path.join(dir, 'annotated.png');
    
    return await Promise.all([
      fs.pathExists(originalPath),
      fs.pathExists(annotatedPath)
    ]).then(results => results.every(exists => exists));
  }

  /**
   * Get screenshot paths for an inspection
   */
  getInspectionScreenshotPaths(userId: string, inspectionId: string): ScreenshotPaths {
    const dir = this.getInspectionScreenshotDir(userId, inspectionId);
    return {
      original: path.join(dir, 'screenshot.png'),
      annotated: path.join(dir, 'annotated.png')
    };
  }

  /**
   * Get screenshot paths for a project website
   */
  getProjectScreenshotPaths(userId: string, projectId: string, websiteDomain: string): ScreenshotPaths {
    const dir = this.getProjectScreenshotDir(userId, projectId, websiteDomain);
    return {
      original: path.join(dir, 'screenshot.png'),
      annotated: path.join(dir, 'annotated.png')
    };
  }

  /**
   * Delete screenshots for an inspection
   */
  async deleteInspectionScreenshots(userId: string, inspectionId: string): Promise<void> {
    const dir = this.getInspectionScreenshotDir(userId, inspectionId);
    
    try {
      if (await fs.pathExists(dir)) {
        await fs.remove(dir);
        console.log(`Deleted screenshots for inspection ${inspectionId}`);
      }
    } catch (error) {
      console.error(`Error deleting screenshots for inspection ${inspectionId}:`, error);
    }
  }

  /**
   * Delete screenshots for a project
   */
  async deleteProjectScreenshots(userId: string, projectId: string): Promise<void> {
    const projectDir = path.join(this.getUserScreenshotDir(userId, 'projects'), projectId);
    
    try {
      if (await fs.pathExists(projectDir)) {
        await fs.remove(projectDir);
        console.log(`Deleted screenshots for project ${projectId}`);
      }
    } catch (error) {
      console.error(`Error deleting screenshots for project ${projectId}:`, error);
    }
  }

  /**
   * Clean up old screenshots (older than retention days)
   */
  async cleanupOldScreenshots(userId: string, retentionDays: number = 30): Promise<void> {
    const userDir = path.join(this.getBaseScreenshotDir(), `user-${userId}`);
    
    if (!await fs.pathExists(userDir)) {
      return;
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      // Clean up old inspection screenshots
      const inspectionsDir = path.join(userDir, 'inspections');
      if (await fs.pathExists(inspectionsDir)) {
        const inspectionFolders = await fs.readdir(inspectionsDir);
        
        for (const folder of inspectionFolders) {
          const folderPath = path.join(inspectionsDir, folder);
          const stats = await fs.stat(folderPath);
          
          if (stats.isDirectory() && stats.mtime < cutoffDate) {
            await fs.remove(folderPath);
            console.log(`Cleaned up old inspection screenshots: ${folder}`);
          }
        }
      }

      // Clean up old project screenshots
      const projectsDir = path.join(userDir, 'projects');
      if (await fs.pathExists(projectsDir)) {
        const projectFolders = await fs.readdir(projectsDir);
        
        for (const folder of projectFolders) {
          const folderPath = path.join(projectsDir, folder);
          const stats = await fs.stat(folderPath);
          
          if (stats.isDirectory() && stats.mtime < cutoffDate) {
            await fs.remove(folderPath);
            console.log(`Cleaned up old project screenshots: ${folder}`);
          }
        }
      }
    } catch (error) {
      console.error(`Error cleaning up old screenshots for user ${userId}:`, error);
    }
  }

  /**
   * Get storage usage for a user's screenshots
   */
  async getStorageUsage(userId: string): Promise<number> {
    const userDir = path.join(this.getBaseScreenshotDir(), `user-${userId}`);
    
    if (!await fs.pathExists(userDir)) {
      return 0;
    }

    let totalSize = 0;

    try {
      const calculateDirSize = async (dirPath: string): Promise<number> => {
        let size = 0;
        const items = await fs.readdir(dirPath);
        
        for (const item of items) {
          const itemPath = path.join(dirPath, item);
          const stats = await fs.stat(itemPath);
          
          if (stats.isDirectory()) {
            size += await calculateDirSize(itemPath);
          } else {
            size += stats.size;
          }
        }
        
        return size;
      };

      totalSize = await calculateDirSize(userDir);
    } catch (error) {
      console.error(`Error calculating storage usage for user ${userId}:`, error);
    }

    return totalSize;
  }

  /**
   * Export screenshots to user-chosen location
   */
  async exportScreenshots(userId: string, inspectionId: string, exportPath: string): Promise<void> {
    const sourceDir = this.getInspectionScreenshotDir(userId, inspectionId);
    
    if (!await fs.pathExists(sourceDir)) {
      throw new Error('Screenshots not found for this inspection');
    }

    try {
      await fs.copy(sourceDir, exportPath);
      console.log(`Screenshots exported to ${exportPath}`);
    } catch (error) {
      console.error(`Error exporting screenshots:`, error);
      throw error;
    }
  }
}

/**
 * Create font usage annotations on a webpage
 * Only annotates meaningful web fonts on visible text elements
 */
export async function addFontAnnotations(page: Page, fontAnalysisResult: any): Promise<number> {
  try {
    console.log('Adding font annotations to page...');
    
    // Debug: Log what we're working with
    console.log('🔍 Font analysis result summary:');
    console.log(`  - Active fonts: ${fontAnalysisResult.activeFonts?.length || 0}`);
    console.log(`  - Downloaded fonts: ${fontAnalysisResult.downloadedFonts?.length || 0}`);
    
    if (fontAnalysisResult.activeFonts?.length > 0) {
      console.log('🔍 Active fonts available for annotation:');
      fontAnalysisResult.activeFonts.forEach((font: any, index: number) => {
        console.log(`  ${index + 1}. "${font.family}" (${font.elementCount} elements)`);
      });
    }
    
    // Inject annotation script into the page
    const annotationCount = await page.evaluate((data) => {
      const { activeFonts, downloadedFonts } = data;
      
      // Extract downloaded font families (the interesting ones)
      const downloadedFontFamilies = new Set<string>();
      if (downloadedFonts && downloadedFonts.length > 0) {
        downloadedFonts.forEach((font: any) => {
          // First try metadata font name
          if (font.metadata?.fontName) {
            downloadedFontFamilies.add(font.metadata.fontName.toLowerCase());
          }
          
          // Then try filename-based name
          const cleanName = font.name
            .replace(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, '')
            .replace(/[-_]/g, ' ')
            .trim()
            .toLowerCase();
          if (cleanName.length > 2) {
            downloadedFontFamilies.add(cleanName);
          }
        });
      }
      
      // Filter active fonts to include all meaningful fonts (including system fonts)
      let meaningfulFonts = activeFonts.filter((font: any) => {
        const familyLower = font.family.toLowerCase().replace(/["']/g, '').trim();
        
        // Skip if no elements use this font
        if (!font.elementCount || font.elementCount === 0) {
          return false;
        }
        
        // Only skip obviously invalid font names (single characters, common CSS artifacts)
        if (familyLower.length <= 2 || ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'].includes(familyLower)) {
          console.log(`⚠️ Skipping suspicious font name: "${font.family}"`);
          return false;
        }
        
        // If we have downloaded fonts, try to match
        if (downloadedFontFamilies.size > 0) {
          console.log(`🔍 Trying to match active font "${familyLower}" with downloaded fonts...`);
          // Check if this font family matches any of our downloaded fonts
          for (const downloadedFont of downloadedFontFamilies) {
            // Direct match
            if (familyLower === downloadedFont) {
              console.log(`✅ Matched "${familyLower}" with "${downloadedFont}" (direct match)`);
              return true;
            }
            
            // Font name is contained within family or vice versa
            if (familyLower.includes(downloadedFont) || downloadedFont.includes(familyLower)) {
              console.log(`✅ Matched "${familyLower}" with "${downloadedFont}" (substring match)`);
              return true;
            }
            
            // Word-based match for compound names
            const familyWords = familyLower.split(/[-_\s]+/);
            const downloadedWords = downloadedFont.split(/[-_\s]+/);
            
            // Check for word matches
            if (familyWords.some((word: string) => downloadedWords.includes(word)) ||
                downloadedWords.some((word: string) => familyWords.includes(word))) {
              console.log(`✅ Matched "${familyLower}" with "${downloadedFont}" (word match)`);
              return true;
            }
            
            // Check for compound word matches (e.g., "noto sans kr" vs "notosanskr")
            const familyCompound = familyLower.replace(/[-_\s]+/g, '');
            const downloadedCompound = downloadedFont.replace(/[-_\s]+/g, '');
            if (familyCompound.includes(downloadedCompound) || downloadedCompound.includes(familyCompound)) {
              console.log(`✅ Matched "${familyLower}" with "${downloadedFont}" (compound match)`);
              return true;
            }
            
            // Check for partial compound matches (e.g., "notosanskr" contains "noto", "sans", "kr")
            if (familyWords.length > 1 && familyWords.every(word => downloadedCompound.includes(word))) {
              console.log(`✅ Matched "${familyLower}" with "${downloadedFont}" (compound word match)`);
              return true;
            }
            if (downloadedWords.length > 1 && downloadedWords.every(word => familyCompound.includes(word))) {
              console.log(`✅ Matched "${familyLower}" with "${downloadedFont}" (reverse compound word match)`);
              return true;
            }
            
            // Special case: Check for common font aliases and brand names
            const aliases = new Map([
              ['big hit', 'hybe'],
              ['bighit', 'hybe'],
              ['201110', 'hybe'],
              ['notosanscjkkr', 'notosanskr'],
              ['noto sans cjk kr', 'notosanskr'],
              ['noto sans cjk', 'notosanskr']
            ]);
            
            for (const [alias, canonical] of aliases.entries()) {
              if ((familyCompound.includes(alias) || familyLower.includes(alias)) && 
                  (downloadedCompound.includes(canonical) || downloadedFont.includes(canonical))) {
                console.log(`✅ Matched "${familyLower}" with "${downloadedFont}" (alias match: ${alias} → ${canonical})`);
                return true;
              }
            }
          }
          console.log(`❌ No match found for active font "${familyLower}"`);
          return false;
        } else {
          // If no downloaded fonts detected, include all fonts (including system fonts)
          return true;
        }
      });
      
      // If no meaningful fonts found but we have active fonts, use the top active fonts (including system fonts)
      if (meaningfulFonts.length === 0 && activeFonts.length > 0) {
        meaningfulFonts = activeFonts
          .filter((font: any) => {
            const familyLower = font.family.toLowerCase().replace(/["']/g, '').trim();
            const isSuspicious = familyLower.length <= 2 || ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'].includes(familyLower);
            return !isSuspicious && font.elementCount > 0;
          })
          .slice(0, 8); // Increased limit to accommodate more fonts including system fonts
      }
      
      console.log(`Filtered to ${meaningfulFonts.length} meaningful fonts from ${activeFonts.length} total`);
      console.log('🔍 Meaningful fonts for annotation:', meaningfulFonts.map(f => f.family));
      console.log('🔍 Downloaded font families detected:', Array.from(downloadedFontFamilies));
      
      // Create colors for meaningful fonts - expanded palette for more font types
      const fontColors = new Map();
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
        '#F39C12', '#E74C3C', '#9B59B6', '#3498DB', '#1ABC9C',
        '#2ECC71', '#F1C40F', '#E67E22', '#95A5A6', '#34495E'
      ];
      
      let colorIndex = 0;
      meaningfulFonts.forEach((font: any) => {
        if (!fontColors.has(font.family)) {
          fontColors.set(font.family, colors[colorIndex % colors.length]);
          console.log(`🎨 Added font to color map: "${font.family}" -> ${colors[colorIndex % colors.length]}`);
          colorIndex++;
        }
      });
      
      console.log('🗺️ Final fontColors Map entries:', Array.from(fontColors.entries()));
      
      // Find text elements that use meaningful fonts
      const candidateElements = Array.from(document.querySelectorAll(
        'h1, h2, h3, h4, h5, h6, p, span, div, a, button, label, li, td, th, blockquote, figcaption'
      ));
      
      const annotations: Array<{
        element: HTMLElement;
        font: string;
        color: string;
        rect: DOMRect;
        priority: number;
      }> = [];
      
      candidateElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          const computedStyle = window.getComputedStyle(element);
          const fontFamily = computedStyle.fontFamily;
          
          // Check visibility
          if (computedStyle.display === 'none' || 
              computedStyle.visibility === 'hidden' ||
              computedStyle.opacity === '0') {
            return;
          }
          
          // Enhanced text element validation - check for direct text content
          const hasDirectText = Array.from(element.childNodes).some(node => 
            node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim().length >= 3
          );
          
          // Skip if no direct text content (likely a container)
          if (!hasDirectText) {
            return;
          }
          
          // Additional validation for div elements to avoid containers
          const tagName = element.tagName.toLowerCase();
          if (tagName === 'div') {
            const childCount = element.children.length;
            const hasBlockChildren = Array.from(element.children).some(child => 
              ['DIV', 'P', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'NAV'].includes(child.tagName)
            );
            
            // Skip divs that are likely containers
            if (childCount > 2 || hasBlockChildren) {
              return;
            }
            
            // Also check if div has mostly non-text content
            const textLength = element.textContent?.trim().length || 0;
            const childTextLength = Array.from(element.children)
              .reduce((total, child) => total + (child.textContent?.length || 0), 0);
            
            // If most text comes from children rather than direct text, skip
            if (childTextLength > textLength * 0.7) {
              return;
            }
          }
          
          // Final text content check
          const textContent = element.textContent?.trim();
          if (!textContent || textContent.length < 3) {
            return;
          }
          
          // Check element size
          const rect = element.getBoundingClientRect();
          if (rect.width < 10 || rect.height < 10) {
            return;
          }
          
          // Check if element is in viewport (roughly) - increased to 10x viewport height
          if (rect.bottom < 0 || rect.top > window.innerHeight * 10) {
            return;
          }
          
          // Check if this element uses one of our meaningful fonts
          for (const [familyName, color] of fontColors.entries()) {
            console.log(`🔍 Checking font match: element font="${fontFamily}" vs meaningful font="${familyName}"`);
            
            // Clean up both font names for comparison
            const cleanElementFont = fontFamily.toLowerCase().replace(/["']/g, '').trim();
            const cleanMeaningfulFont = familyName.toLowerCase().replace(/["']/g, '').trim();
            
            // Try multiple matching strategies
            const directMatch = cleanElementFont.includes(cleanMeaningfulFont) || cleanMeaningfulFont.includes(cleanElementFont);
            const firstWordMatch = cleanElementFont.split(/[\s,]+/)[0] === cleanMeaningfulFont.split(/[\s,]+/)[0];
            const wordBasedMatch = cleanElementFont.split(/[\s,]+/).some(word => 
              cleanMeaningfulFont.split(/[\s,]+/).includes(word)
            );
            
            if (directMatch || firstWordMatch || wordBasedMatch) {
              console.log(`✅ Font match found: "${familyName}" will be used in annotation (match type: ${directMatch ? 'direct' : firstWordMatch ? 'first-word' : 'word-based'})`);
              
              // Enhanced priority calculation for better representative selection
              let priority = 1;
              
              // Semantic importance (highest priority)
              if (tagName.match(/^h[1-6]$/)) {
                const headingLevel = parseInt(tagName.charAt(1));
                priority += 15 - headingLevel; // h1 gets 14, h2 gets 13, etc.
              }
              
              // Semantic text elements get moderate boost
              if (['p', 'span', 'a', 'button', 'label', 'strong', 'em'].includes(tagName)) {
                priority += 3;
              }
              
              // Size and visibility factors - more balanced scoring
              if (rect.width * rect.height > 1000) priority += 4;
              if (rect.top < window.innerHeight) priority += 3; // Reduced from 5
              if (rect.top < window.innerHeight / 2) priority += 1; // Reduced from 2
              
              // Add priority for elements further down the page to balance distribution
              const viewportPosition = rect.top / window.innerHeight;
              if (viewportPosition > 1 && viewportPosition <= 3) priority += 2;
              if (viewportPosition > 3 && viewportPosition <= 6) priority += 3;
              if (viewportPosition > 6) priority += 4;
              
              // Text content quality
              const textContent = element.textContent?.trim() || '';
              if (textContent.length > 20) priority += 2; // Substantial text content
              if (textContent.length < 5) priority -= 2; // Very short text (likely not meaningful)
              
              // Position-based priority (consider both left and right alignment)
              if (rect.left < window.innerWidth / 3) priority += 1; // Left side of screen
              if (rect.left > (window.innerWidth * 2/3)) priority += 1; // Right side of screen
              
              // Avoid generic/repetitive text
              const genericTexts = ['click here', 'read more', 'learn more', 'more', 'menu'];
              if (genericTexts.some(generic => textContent.toLowerCase().includes(generic))) {
                priority -= 3;
              }
              
              annotations.push({
                element,
                font: familyName,
                color,
                rect,
                priority
              });
              console.log(`📝 Created annotation with font: "${familyName}" for element with text: "${element.textContent?.trim().substring(0, 30)}..."`);
              break;
            }
          }
        }
      });
      
      // Sort by priority and apply sectional selection
      annotations.sort((a, b) => b.priority - a.priority);
      
      // Categorize annotations by page sections for better distribution
      const sectionAnnotations = {
        header: [] as typeof annotations,
        main: [] as typeof annotations,
        footer: [] as typeof annotations,
        sidebar: [] as typeof annotations,
        other: [] as typeof annotations
      };
      
      const viewportHeight = window.innerHeight;
      const documentHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
      
      annotations.forEach(annotation => {
        const element = annotation.element;
        const rect = annotation.rect;
        
        // Check if element is in a semantic section
        const inHeader = element.closest('header, nav, [role="banner"], [class*="header"], [class*="nav"], [id*="header"], [id*="nav"]');
        const inFooter = element.closest('footer, [role="contentinfo"], [class*="footer"], [id*="footer"]');
        const inSidebar = element.closest('aside, [role="complementary"], [class*="sidebar"], [class*="aside"], [id*="sidebar"]');
        const inMain = element.closest('main, [role="main"], [class*="main"], [class*="content"]');
        
        // Position-based classification as fallback
        const topThird = rect.top < documentHeight * 0.33;
        const bottomThird = rect.top > documentHeight * 0.67;
        
        if (inHeader || (topThird && rect.top < viewportHeight)) {
          sectionAnnotations.header.push(annotation);
        } else if (inFooter || bottomThird) {
          sectionAnnotations.footer.push(annotation);
        } else if (inSidebar) {
          sectionAnnotations.sidebar.push(annotation);
        } else if (inMain || (!topThird && !bottomThird)) {
          sectionAnnotations.main.push(annotation);
        } else {
          sectionAnnotations.other.push(annotation);
        }
      });
      
      console.log(`📊 Section distribution: Header(${sectionAnnotations.header.length}), Main(${sectionAnnotations.main.length}), Footer(${sectionAnnotations.footer.length}), Sidebar(${sectionAnnotations.sidebar.length}), Other(${sectionAnnotations.other.length})`);
      
      // Select annotations ensuring at least one per major section
      const selectedAnnotations = [];
      const minPerSection = 1;
      const maxPerSection = 15; // Reasonable limit per section
      
      // Ensure at least one annotation from each section that has content
      Object.entries(sectionAnnotations).forEach(([sectionName, sectionAnns]) => {
        if (sectionAnns.length > 0) {
          // Sort section annotations by priority
          sectionAnns.sort((a, b) => b.priority - a.priority);
          
          // Take at least minPerSection, up to maxPerSection
          const takeCount = Math.min(
            Math.max(minPerSection, Math.ceil(sectionAnns.length * 0.3)), // Take 30% of section annotations, but at least 1
            maxPerSection
          );
          
          selectedAnnotations.push(...sectionAnns.slice(0, takeCount));
          console.log(`📍 Selected ${takeCount} annotations from ${sectionName} section`);
        }
      });
      
      // If we have too few annotations overall, add more from the highest priority remaining
      const maxTotalAnnotations = 80;
      if (selectedAnnotations.length < 20 && annotations.length > selectedAnnotations.length) {
        const remaining = annotations.filter(ann => !selectedAnnotations.includes(ann));
        const additionalNeeded = Math.min(maxTotalAnnotations - selectedAnnotations.length, remaining.length);
        selectedAnnotations.push(...remaining.slice(0, additionalNeeded));
        console.log(`📍 Added ${additionalNeeded} additional annotations for better coverage`);
      }
      
      // Final limit
      const finalAnnotations = selectedAnnotations.slice(0, maxTotalAnnotations);
      console.log(`📍 Final selection: ${finalAnnotations.length} annotations from ${annotations.length} candidates`);
      
      // Step 2: Group annotations by semantic similarity using fingerprints
      const semanticGroups = new Map<string, typeof finalAnnotations>();
      
      finalAnnotations.forEach((annotation) => {
        const computedStyle = window.getComputedStyle(annotation.element);
        const fingerprint = createElementFingerprint(annotation.element, computedStyle, annotation.font);
        
        if (!semanticGroups.has(fingerprint)) {
          semanticGroups.set(fingerprint, []);
        }
        semanticGroups.get(fingerprint)!.push(annotation);
      });
      
      console.log(`Grouped ${finalAnnotations.length} annotations into ${semanticGroups.size} semantic groups`);
      
      // Debug: Show group details
      let groupIndex = 0;
      semanticGroups.forEach((group, fingerprint) => {
        if (group.length > 1) {
          console.log(`Group ${++groupIndex} (${fingerprint}): ${group.length} similar elements - "${group[0].element.textContent?.trim().substring(0, 30)}..."`);
        }
      });
      
      // Step 3: Select best representative from each semantic group
      const groupedAnnotations = Array.from(semanticGroups.values()).map(group => {
        // Sort by priority (highest first) to select the best representative
        const representative = group.sort((a, b) => b.priority - a.priority)[0];
        
        // Debug: Log when we're selecting a representative from multiple candidates
        if (group.length > 1) {
          console.log(`Selected representative: "${representative.element.textContent?.trim().substring(0, 40)}" (priority: ${representative.priority}) from ${group.length} similar elements`);
        }
        
        return representative;
      });
      
      // Step 1: Create element fingerprints to identify similar elements
      function createElementFingerprint(element: HTMLElement, computedStyle: CSSStyleDeclaration, fontFamily: string): string {
        const textLength = element.textContent?.trim().length || 0;
        const textCategory = textLength <= 10 ? 'short' : textLength <= 30 ? 'medium' : 'long';
        const fontSize = parseInt(computedStyle.fontSize);
        const sizeCategory = fontSize < 14 ? 'small' : fontSize <= 18 ? 'medium' : 'large';
        const tagName = element.tagName.toLowerCase();
        const parentTag = element.parentElement?.tagName.toLowerCase() || 'none';
        
        // Create a comprehensive fingerprint
        return `${tagName}-${fontFamily}-${textCategory}-${sizeCategory}-${parentTag}`;
      }
      
      console.log(`Semantic grouping results: ${finalAnnotations.length} candidates → ${semanticGroups.size} groups → ${groupedAnnotations.length} final annotations`);
      
             // Create visual annotations with borders and labels
       let annotationCount = 0;
       groupedAnnotations.forEach((annotation) => {
         // Add colored border to the actual text element
         annotation.element.style.outline = `3px solid ${annotation.color}`;
         annotation.element.style.outlineOffset = '2px';
         
                 // Create always-visible font label
        const label = document.createElement('div');
        console.log(`🏷️ Creating label with font name: "${annotation.font}"`);
        label.textContent = annotation.font;
         label.style.position = 'absolute';
         label.style.left = `${annotation.rect.left + window.scrollX}px`;
         label.style.top = `${annotation.rect.top + window.scrollY - 25}px`;
         label.style.fontSize = '11px';
         label.style.backgroundColor = annotation.color;
         label.style.color = 'white';
         label.style.padding = '2px 6px';
         label.style.borderRadius = '3px';
         label.style.whiteSpace = 'nowrap';
         label.style.fontFamily = 'Arial, sans-serif';
         label.style.fontWeight = 'bold';
         label.style.pointerEvents = 'none';
         label.style.zIndex = '999999';
         label.style.boxShadow = '0 2px 4px rgba(0,0,0,0.4)';
         label.style.lineHeight = '1.2';
         
         // Ensure label doesn't go off-screen
         if (annotation.rect.top < 30) {
           // If element is too close to top, put label below
           label.style.top = `${annotation.rect.bottom + window.scrollY + 5}px`;
         }
         if (annotation.rect.left < 0) {
           // If element is off left edge, align label to left edge
           label.style.left = `${window.scrollX + 5}px`;
         }
         
         // Add small connecting line from label to element
         const connector = document.createElement('div');
         connector.style.position = 'absolute';
         connector.style.left = `${annotation.rect.left + window.scrollX + annotation.rect.width / 2 - 1}px`;
         
         if (annotation.rect.top >= 30) {
           // Line from label to element (top)
           connector.style.top = `${annotation.rect.top + window.scrollY - 5}px`;
           connector.style.height = '5px';
         } else {
           // Line from element to label (bottom)
           connector.style.top = `${annotation.rect.bottom + window.scrollY}px`;
           connector.style.height = '5px';
         }
         
         connector.style.width = '2px';
         connector.style.backgroundColor = annotation.color;
         connector.style.pointerEvents = 'none';
         connector.style.zIndex = '999998';
         
         document.body.appendChild(label);
         document.body.appendChild(connector);
         annotationCount++;
       });
      
      // Return debug info along with count
      return {
        annotationCount,
        debug: {
          activeFontsCount: activeFonts.length,
          downloadedFontsCount: downloadedFonts.length,
          meaningfulFontsCount: meaningfulFonts.length,
          meaningfulFontNames: meaningfulFonts.map(f => f.family),
          downloadedFontFamilies: Array.from(downloadedFontFamilies),
          fontColorsEntries: Array.from(fontColors.entries()).map(([name, color]) => ({ name, color }))
        }
      };
    }, {
      activeFonts: fontAnalysisResult.activeFonts || [],
      downloadedFonts: fontAnalysisResult.downloadedFonts || []
    });
    
    // Extract results and debug info
    const actualAnnotationCount = typeof annotationCount === 'object' ? annotationCount.annotationCount : annotationCount;
    const debugInfo = typeof annotationCount === 'object' ? annotationCount.debug : null;
    
    console.log(`Added ${actualAnnotationCount} clean font annotations to page`);
    
    // Debug: Show what happened inside page.evaluate
    if (debugInfo) {
      console.log('🔍 Browser-side debug info:');
      console.log(`  - Active fonts processed: ${debugInfo.activeFontsCount}`);
      console.log(`  - Downloaded fonts processed: ${debugInfo.downloadedFontsCount}`);
      console.log(`  - Meaningful fonts selected: ${debugInfo.meaningfulFontsCount}`);
      console.log(`  - Meaningful font names: [${debugInfo.meaningfulFontNames.join(', ')}]`);
      console.log(`  - Downloaded font families: [${debugInfo.downloadedFontFamilies.join(', ')}]`);
      console.log(`  - Font color map: ${debugInfo.fontColorsEntries.map(e => `"${e.name}"`).join(', ')}`);
    }
    
    // Debug: If no annotations were added, let's understand why
    if (actualAnnotationCount === 0) {
      console.log('⚠️ No annotations were added! This suggests a font matching issue.');
    }
    
    return actualAnnotationCount;
    
  } catch (error) {
    console.error('Error adding font annotations:', error);
    return 0;
  }
}

// Export singleton instance
export const screenshotManager = new ScreenshotManager(); 