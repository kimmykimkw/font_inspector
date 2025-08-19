// Simplified font matching logic using CSS @font-face declarations
export interface FontFaceDeclaration {
  family: string;
  source: string;
  weight?: string;
  style?: string;
}

export interface FontFile {
  name: string;
  format: string;
  size: number;
  url: string;
  source: string;
  metadata?: any;
}

export interface ActiveFont {
  family: string;
  elementCount?: number;
  count?: number;
  preview?: string;
}

/**
 * Simplified font matching: Active Font CSS Name → @font-face Declaration → Downloaded Font URL
 * This is much more reliable than trying to match filenames
 */
export function findMatchingFontFile(
  activeFont: ActiveFont, 
  downloadedFonts: FontFile[], 
  fontFaceDeclarations: FontFaceDeclaration[]
): FontFile | null {
  if (!downloadedFonts?.length) {
    return null;
  }

  // Clean and normalize the active font name for comparison
  const cleanActiveFontName = cleanFontName(activeFont.family);

  // STRATEGY 1: Traditional @font-face declaration matching
  if (fontFaceDeclarations?.length) {
    const matchingDeclaration = fontFaceDeclarations.find(declaration => {
      const cleanDeclarationFamily = cleanFontName(declaration.family);
      return cleanDeclarationFamily === cleanActiveFontName;
    });

    if (matchingDeclaration?.source) {
      const sourceUrls = extractUrlsFromFontFaceSource(matchingDeclaration.source);
      
      if (sourceUrls.length) {
        const matchingFont = downloadedFonts.find(downloadedFont => {
          return sourceUrls.some(cssUrl => urlsMatch(downloadedFont.url, cssUrl));
        });
        
        if (matchingFont) {
          return matchingFont;
        }
      }
    }
  }

  // STRATEGY 2: Fallback - Direct font metadata/filename matching
  // This handles cases where @font-face declarations are missing (like CORS-blocked Google Fonts)
  const metadataMatch = findMatchingFontByMetadata(activeFont, downloadedFonts);
  if (metadataMatch) {
    return metadataMatch;
  }

  // STRATEGY 3: Final fallback - Direct name matching between active font and downloaded font metadata
  // This handles cases where all other strategies fail
  return findMatchingFontByDirectNameMatch(activeFont, downloadedFonts);
}

/**
 * Get the correct font family name using the simplified matching approach
 */
export function getCorrectFontFamily(
  activeFont: ActiveFont, 
  downloadedFonts: FontFile[], 
  fontFaceDeclarations: FontFaceDeclaration[]
): string {
  // Step 1: Try to find matching font file via @font-face declarations
  const matchingFont = findMatchingFontFile(activeFont, downloadedFonts, fontFaceDeclarations);
  
  if (matchingFont) {
    // PRIORITY 1: Use metadata font family if available
    if (matchingFont.metadata?.fontFamily) {
      return matchingFont.metadata.fontFamily;
    }
    
    // PRIORITY 2: Use metadata font name if available
    if (matchingFont.metadata?.fontName) {
      return matchingFont.metadata.fontName;
    }
    
    // PRIORITY 3: Use the original CSS font-family name from @font-face
    const cleanActiveFontName = cleanFontName(activeFont.family);
    const matchingDeclaration = fontFaceDeclarations.find(declaration => {
      const cleanDeclarationFamily = cleanFontName(declaration.family);
      return cleanDeclarationFamily === cleanActiveFontName;
    });
    
    if (matchingDeclaration) {
      return matchingDeclaration.family.replace(/["']/g, '').trim();
    }
  }
  
  // Fallback to original active font family name
  return activeFont.family;
}

/**
 * Find all downloaded font files that match an active font
 */
export function findAllMatchingFontFiles(
  activeFont: ActiveFont,
  downloadedFonts: FontFile[],
  fontFaceDeclarations: FontFaceDeclaration[]
): FontFile[] {
  if (!downloadedFonts?.length) {
    return [];
  }

  const cleanActiveFontName = cleanFontName(activeFont.family);

  // STRATEGY 1: Traditional @font-face declaration matching
  if (fontFaceDeclarations?.length) {
    const matchingDeclarations = fontFaceDeclarations.filter(declaration => {
      const cleanDeclarationFamily = cleanFontName(declaration.family);
      return cleanDeclarationFamily === cleanActiveFontName;
    });

    if (matchingDeclarations.length) {
      const allSourceUrls = matchingDeclarations.flatMap(declaration => 
        extractUrlsFromFontFaceSource(declaration.source)
      );

      const matchedFonts = downloadedFonts.filter(downloadedFont => {
        return allSourceUrls.some(cssUrl => urlsMatch(downloadedFont.url, cssUrl));
      });

      if (matchedFonts.length) {
        return matchedFonts;
      }
    }
  }

  // STRATEGY 2: Fallback to metadata matching
  const metadataMatches = downloadedFonts.filter(font => {
    return findMatchingFontByMetadata(activeFont, [font]) !== null;
  });

  if (metadataMatches.length) {
    return metadataMatches;
  }

  // STRATEGY 3: Final fallback to direct name matching
  const directMatches = downloadedFonts.filter(font => {
    return findMatchingFontByDirectNameMatch(activeFont, [font]) !== null;
  });

  return directMatches;
}

/**
 * Clean and normalize font names for comparison
 */
function cleanFontName(fontName: string): string {
  return fontName
    .toLowerCase()
    .replace(/["']/g, '') // Remove quotes
    .trim();
}

/**
 * Extract URLs from @font-face src declaration
 */
function extractUrlsFromFontFaceSource(source: string): string[] {
  const sourceUrls = source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
  
  if (!sourceUrls) {
    return [];
  }

  return sourceUrls
    .map(sourceUrl => {
      const urlMatch = sourceUrl.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
      return urlMatch?.[1] || '';
    })
    .filter(url => url.length > 0);
}

/**
 * Smart URL matching that handles Google Fonts and other web font services
 * Uses hybrid approach: domain + font family path matching
 */
function urlsMatch(downloadedUrl: string, cssUrl: string): boolean {
  // Direct match (fastest check)
  if (downloadedUrl === cssUrl) {
    return true;
  }

  try {
    const downloadedUrlObj = new URL(downloadedUrl);
    const cssUrlObj = new URL(cssUrl);

    // Must be from the same domain
    if (downloadedUrlObj.hostname !== cssUrlObj.hostname) {
      return false;
    }

    // For Google Fonts specifically
    if (downloadedUrlObj.hostname === 'fonts.gstatic.com') {
      return matchGoogleFontsUrls(downloadedUrlObj.pathname, cssUrlObj.pathname);
    }

    // For other font services, use path-based matching
    return matchFontServiceUrls(downloadedUrlObj.pathname, cssUrlObj.pathname);

  } catch (error) {
    // Fallback to simple string matching if URL parsing fails
    return simpleUrlMatch(downloadedUrl, cssUrl);
  }
}

/**
 * Match Google Fonts URLs by font family path pattern
 * Example: /s/notosanstc/v37/... should match other /s/notosanstc/v37/... URLs
 */
function matchGoogleFontsUrls(downloadedPath: string, cssPath: string): boolean {
  // Extract font family path pattern: /s/fontname/version/
  const downloadedMatch = downloadedPath.match(/^\/s\/([^\/]+)\/([^\/]+)\//);
  const cssMatch = cssPath.match(/^\/s\/([^\/]+)\/([^\/]+)\//);

  if (!downloadedMatch || !cssMatch) {
    return false;
  }

  // Must have same font family and version
  return downloadedMatch[1] === cssMatch[1] && downloadedMatch[2] === cssMatch[2];
}

/**
 * Match other font service URLs by checking common path patterns
 */
function matchFontServiceUrls(downloadedPath: string, cssPath: string): boolean {
  // Check if paths share significant common segments
  const downloadedSegments = downloadedPath.split('/').filter(s => s);
  const cssSegments = cssPath.split('/').filter(s => s);

  // Must share at least 2 path segments (e.g., font family identifier)
  let commonSegments = 0;
  const minLength = Math.min(downloadedSegments.length, cssSegments.length);
  
  for (let i = 0; i < minLength; i++) {
    if (downloadedSegments[i] === cssSegments[i]) {
      commonSegments++;
    } else {
      break; // Stop at first difference
    }
  }

  return commonSegments >= 2;
}

/**
 * Fallback simple URL matching for when URL parsing fails
 */
function simpleUrlMatch(downloadedUrl: string, cssUrl: string): boolean {
  // Check if one URL ends with the other (handles relative vs absolute)
  if (downloadedUrl.endsWith(cssUrl) || cssUrl.endsWith(downloadedUrl)) {
    return true;
  }

  // Check filename match (last resort)
  const downloadedFilename = downloadedUrl.split('/').pop()?.split('?')[0] || '';
  const cssFilename = cssUrl.split('/').pop()?.split('?')[0] || '';
  
  if (downloadedFilename && cssFilename && downloadedFilename === cssFilename) {
    return true;
  }

  return false;
}

/**
 * Fallback font matching using metadata and intelligent filename patterns
 * Used when @font-face declarations are not available (e.g., CORS-blocked Google Fonts)
 */
function findMatchingFontByMetadata(activeFont: ActiveFont, downloadedFonts: FontFile[]): FontFile | null {
  const cleanActiveFontName = cleanFontName(activeFont.family);
  
  // Strategy 1: Direct metadata family name matching
  let matchingFont = downloadedFonts.find(font => {
    if (font.metadata?.fontFamily) {
      return cleanFontName(font.metadata.fontFamily) === cleanActiveFontName;
    }
    return false;
  });
  
  if (matchingFont) {
    return matchingFont;
  }
  
  // Strategy 2: Metadata font name matching (fallback)
  matchingFont = downloadedFonts.find(font => {
    if (font.metadata?.fontName) {
      return cleanFontName(font.metadata.fontName) === cleanActiveFontName;
    }
    return false;
  });
  
  if (matchingFont) {
    return matchingFont;
  }
  
  // Strategy 3: Google Fonts URL pattern matching
  // Extract font family from Google Fonts URL: /s/nanumgothic/v17/...
  matchingFont = downloadedFonts.find(font => {
    if (font.url.includes('fonts.gstatic.com')) {
      const urlMatch = font.url.match(/\/s\/([^\/]+)\//);
      if (urlMatch) {
        const urlFontName = urlMatch[1];
        
        // Convert Google Fonts slug to readable name
        const readableName = urlFontName
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Add spaces before capitals
          .replace(/^\w/, c => c.toUpperCase()); // Capitalize first letter
        
        const cleanUrlName = cleanFontName(readableName);
        
        // Also try direct slug matching (e.g., "nanumgothic" matches "Nanum Gothic")
        const cleanSlugName = cleanFontName(urlFontName);
        const activeFontSlug = cleanActiveFontName.replace(/\s+/g, '').toLowerCase();
        
        return cleanUrlName === cleanActiveFontName || 
               cleanSlugName === activeFontSlug ||
               cleanActiveFontName.replace(/\s+/g, '').toLowerCase().includes(cleanSlugName);
      }
    }
    return false;
  });
  
  if (matchingFont) {
    return matchingFont;
  }
  
  // Strategy 4: Font source service matching + fuzzy name matching
  matchingFont = downloadedFonts.find(font => {
    // Check if the font is from a known service that matches the active font
    if (font.source === 'Google Fonts') {
      // For Google Fonts, try fuzzy matching on the font name
      const fontName = font.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      const activeName = cleanActiveFontName.replace(/[^a-z0-9]/g, '');
      
      // Check if font name contains the active font name or vice versa
      return fontName.includes(activeName) || activeName.includes(fontName);
    }
    
    return false;
  });
  
  return matchingFont || null;
}

/**
 * Final fallback: Direct name matching between active font and downloaded font metadata
 * This is the most permissive matching strategy for when everything else fails
 */
function findMatchingFontByDirectNameMatch(activeFont: ActiveFont, downloadedFonts: FontFile[]): FontFile | null {
  const cleanActiveFontName = cleanFontName(activeFont.family);
  
  // Strategy 1: Exact match with font metadata names
  let matchingFont = downloadedFonts.find(font => {
    if (font.metadata) {
      const metadata = font.metadata as any;
      
      // Check fontName property
      if (metadata.fontName) {
        const cleanMetadataName = cleanFontName(metadata.fontName);
        if (cleanMetadataName === cleanActiveFontName) {
          return true;
        }
      }
      
      // Check fontFamily property  
      if (metadata.fontFamily) {
        const cleanMetadataFamily = cleanFontName(metadata.fontFamily);
        if (cleanMetadataFamily === cleanActiveFontName) {
          return true;
        }
      }
      
      // Check uniqueIdentifier property
      if (metadata.uniqueIdentifier) {
        const cleanIdentifier = cleanFontName(metadata.uniqueIdentifier);
        if (cleanIdentifier === cleanActiveFontName) {
          return true;
        }
      }
    }
    return false;
  });
  
  if (matchingFont) {
    return matchingFont;
  }
  
  // Strategy 2: Partial/fuzzy matching for compound names
  // This handles cases like "NanumGothic" vs "Nanum Gothic" or "Roboto Medium" vs "Roboto"
  matchingFont = downloadedFonts.find(font => {
    if (font.metadata) {
      const metadata = font.metadata as any;
      
      // Check if any metadata name contains or is contained in the active font name
      const metadataNames = [
        metadata.fontName,
        metadata.fontFamily,
        metadata.uniqueIdentifier
      ].filter(name => name && typeof name === 'string');
      
      for (const metadataName of metadataNames) {
        const cleanMetadataName = cleanFontName(metadataName);
        
        // Remove spaces and compare
        const activeNoSpaces = cleanActiveFontName.replace(/\s+/g, '');
        const metadataNoSpaces = cleanMetadataName.replace(/\s+/g, '');
        
        // Bidirectional partial matching
        if (activeNoSpaces.includes(metadataNoSpaces) || 
            metadataNoSpaces.includes(activeNoSpaces)) {
          return true;
        }
        
        // Word-based matching (e.g., "Nanum Gothic" matches "NanumGothic")
        const activeWords = cleanActiveFontName.split(/\s+/);
        const metadataWords = cleanMetadataName.split(/\s+/);
        
        // Check if all words from active font exist in metadata name
        const allActiveWordsMatch = activeWords.every(word => 
          metadataWords.some(metaWord => 
            metaWord.includes(word) || word.includes(metaWord)
          )
        );
        
        if (allActiveWordsMatch && activeWords.length > 0) {
          return true;
        }
      }
    }
    return false;
  });
  
  if (matchingFont) {
    return matchingFont;
  }
  
  // Strategy 3: Ultra-permissive matching as last resort
  // Match if any significant part of the names overlap
  matchingFont = downloadedFonts.find(font => {
    if (font.metadata) {
      const metadata = font.metadata as any;
      const metadataNames = [
        metadata.fontName,
        metadata.fontFamily,
        metadata.uniqueIdentifier
      ].filter(name => name && typeof name === 'string');
      
      for (const metadataName of metadataNames) {
        const cleanMetadataName = cleanFontName(metadataName);
        
        // Extract the main font family name (first word usually)
        const activeMainName = cleanActiveFontName.split(/\s+/)[0];
        const metadataMainName = cleanMetadataName.split(/\s+/)[0];
        
        // Match if main names are similar (length > 3 to avoid false positives)
        if (activeMainName.length > 3 && metadataMainName.length > 3) {
          if (activeMainName.toLowerCase() === metadataMainName.toLowerCase()) {
            return true;
          }
        }
      }
    }
    return false;
  });
  
  return matchingFont || null;
}
