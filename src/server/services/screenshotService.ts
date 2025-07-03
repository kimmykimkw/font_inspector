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
    
    // Inject annotation script into the page
    const annotationCount = await page.evaluate((data) => {
      const { activeFonts, downloadedFonts } = data;
      
      // System fonts to ignore (not interesting for users)
      const systemFonts = new Set([
        '-apple-system', 'system-ui', 'blinkmacsystemfont', 'segoe ui', 'roboto',
        'helvetica neue', 'arial', 'noto sans', 'sans-serif', 'apple color emoji',
        'segoe ui emoji', 'segoe ui symbol', 'times', 'times new roman', 'serif',
        'courier', 'courier new', 'monospace', 'georgia', 'palatino', 'book antiqua',
        'trebuchet ms', 'lucida grande', 'helvetica', 'verdana', 'tahoma'
      ]);
      
      // Extract downloaded font families (the interesting ones)
      const downloadedFontFamilies = new Set();
      if (downloadedFonts && downloadedFonts.length > 0) {
        downloadedFonts.forEach((font: any) => {
          if (font.metadata?.fontName) {
            downloadedFontFamilies.add(font.metadata.fontName.toLowerCase());
          }
          // Also try to extract from filename
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
      
      // Filter active fonts to only meaningful ones
      const meaningfulFonts = activeFonts.filter((font: any) => {
        const familyLower = font.family.toLowerCase().replace(/["']/g, '').trim();
        
        // Skip system fonts
        if (systemFonts.has(familyLower)) {
          return false;
        }
        
        // Skip if no elements use this font
        if (!font.elementCount || font.elementCount === 0) {
          return false;
        }
        
        return true;
      });
      
      console.log(`Filtered to ${meaningfulFonts.length} meaningful fonts from ${activeFonts.length} total`);
      
      // Create colors for meaningful fonts
      const fontColors = new Map();
      const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
        '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
      ];
      
      let colorIndex = 0;
      meaningfulFonts.forEach((font: any) => {
        if (!fontColors.has(font.family)) {
          fontColors.set(font.family, colors[colorIndex % colors.length]);
          colorIndex++;
        }
      });
      
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
          
          // Check if element is in viewport (roughly)
          if (rect.bottom < 0 || rect.top > window.innerHeight * 3) {
            return;
          }
          
          // Check if this element uses one of our meaningful fonts
          for (const [familyName, color] of fontColors.entries()) {
            if (fontFamily.includes(familyName) || 
                fontFamily.toLowerCase().includes(familyName.toLowerCase())) {
              
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
              
              // Size and visibility factors
              if (rect.width * rect.height > 1000) priority += 4;
              if (rect.top < window.innerHeight) priority += 5; // In initial viewport
              if (rect.top < window.innerHeight / 2) priority += 2; // Above the fold
              
              // Text content quality
              const textContent = element.textContent?.trim() || '';
              if (textContent.length > 20) priority += 2; // Substantial text content
              if (textContent.length < 5) priority -= 2; // Very short text (likely not meaningful)
              
              // Position-based priority (favor left-aligned and top elements)
              if (rect.left < window.innerWidth / 3) priority += 1; // Left side of screen
              
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
              break;
            }
          }
        }
      });
      
      // Sort by priority and limit to reasonable number
      annotations.sort((a, b) => b.priority - a.priority);
      const maxAnnotations = Math.min(50, annotations.length);
      const selectedAnnotations = annotations.slice(0, maxAnnotations);
      
      // Step 2: Group annotations by semantic similarity using fingerprints
      const semanticGroups = new Map<string, typeof selectedAnnotations>();
      
      selectedAnnotations.forEach((annotation) => {
        const computedStyle = window.getComputedStyle(annotation.element);
        const fingerprint = createElementFingerprint(annotation.element, computedStyle, annotation.font);
        
        if (!semanticGroups.has(fingerprint)) {
          semanticGroups.set(fingerprint, []);
        }
        semanticGroups.get(fingerprint)!.push(annotation);
      });
      
      console.log(`Grouped ${selectedAnnotations.length} annotations into ${semanticGroups.size} semantic groups`);
      
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
      
      console.log(`Semantic grouping results: ${selectedAnnotations.length} candidates → ${semanticGroups.size} groups → ${groupedAnnotations.length} final annotations`);
      
             // Create visual annotations with borders and labels
       let annotationCount = 0;
       groupedAnnotations.forEach((annotation) => {
         // Add colored border to the actual text element
         annotation.element.style.outline = `3px solid ${annotation.color}`;
         annotation.element.style.outlineOffset = '2px';
         
         // Create always-visible font label
         const label = document.createElement('div');
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
      
      return annotationCount;
    }, {
      activeFonts: fontAnalysisResult.activeFonts || [],
      downloadedFonts: fontAnalysisResult.downloadedFonts || []
    });
    
    console.log(`Added ${annotationCount} clean font annotations to page`);
    return annotationCount;
    
  } catch (error) {
    console.error('Error adding font annotations:', error);
    return 0;
  }
}

// Export singleton instance
export const screenshotManager = new ScreenshotManager(); 