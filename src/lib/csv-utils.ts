// CSV Export utility functions with enhanced debugging
export interface FontFaceDeclaration {
  family: string;
  source: string;
  weight?: string;
  style?: string;
}

// Font metadata interface
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

export interface FontFile {
  name: string;
  format: string;
  size: number;
  url: string;
  source: string;
  metadata: FontMetadata | null;    // Font metadata or null if not available
}

export interface ActiveFont {
  family: string;
  elementCount: number;
  count?: number;
  preview?: string;
}

// Simplified font family detection using the new matching logic
export function findFontFamilyFromCSS(
  fontUrl: string, 
  fontFaceDeclarations: FontFaceDeclaration[],
  metadata?: FontMetadata | null,
  debugContext: string = 'CSV Export'
): string {
  console.log(`${debugContext}: Processing font URL:`, fontUrl);
  
  // PRIORITY 1: Use metadata font name (most accurate)
  if (metadata?.fontName) {
    console.log(`${debugContext}: ✅ Using metadata font name: "${metadata.fontName}"`);
    return metadata.fontName;
  }
  
  if (!fontFaceDeclarations?.length) {
    console.warn(`${debugContext}: No @font-face declarations available`);
    return extractFallbackNameFromUrl(fontUrl, debugContext);
  }

  // PRIORITY 2: Match URL with @font-face declarations using simplified logic
  for (const declaration of fontFaceDeclarations) {
    if (!declaration.source || !declaration.family) continue;

    // Extract URLs from @font-face src declaration
    const sourceUrls = declaration.source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
    
    if (sourceUrls) {
      for (const sourceUrl of sourceUrls) {
        const urlMatch = sourceUrl.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
        if (urlMatch?.[1]) {
          const cssUrl = urlMatch[1];
          
          // Use simplified URL matching logic
          if (urlsMatch(fontUrl, cssUrl)) {
            console.log(`${debugContext}: ✅ Found font family match: "${declaration.family}" for URL: ${fontUrl}`);
            return declaration.family.replace(/["']/g, '').trim();
          }
        }
      }
    }
  }

  console.warn(`${debugContext}: ❌ No font family match found for URL: ${fontUrl} - using fallback`);
  return extractFallbackNameFromUrl(fontUrl, debugContext);
}

// Helper function for URL matching (extracted from font-matching.ts)
function urlsMatch(downloadedUrl: string, cssUrl: string): boolean {
  if (downloadedUrl === cssUrl) return true;
  if (downloadedUrl.endsWith(cssUrl) || cssUrl.endsWith(downloadedUrl)) return true;
  
  const downloadedFilename = downloadedUrl.split('/').pop()?.split('?')[0] || '';
  const cssFilename = cssUrl.split('/').pop()?.split('?')[0] || '';
  
  return !!(downloadedFilename && cssFilename && downloadedFilename === cssFilename);
}

// Helper function to extract fallback name from URL
function extractFallbackNameFromUrl(fontUrl: string, debugContext: string): string {
  const fileName = fontUrl.split('/').pop()?.split('?')[0] || '';
  const cleanName = fileName
    .replace(/\.(woff2?|ttf|otf|eot)$/i, '')
    .replace(/[-_](regular|bold|light|medium|semibold|extrabold|black|thin|italic|oblique|normal).*$/i, '')
    .replace(/[-_]variable.*$/i, '')
    .replace(/[-_]\d+.*$/i, '')
    .replace(/[-_]/g, ' ')
    .trim();
    
  const fallbackName = cleanName || 'Unknown';
  console.log(`${debugContext}: Using fallback font name: "${fallbackName}" from filename: ${fileName}`);
  
  return fallbackName;
}

// Enhanced CSV generation with debugging
export function generateFontInspectionCSV(
  inspection: any,
  debugContext: string = 'Inspection CSV Export'
): string {
  console.log(`${debugContext}: Starting CSV generation for inspection:`, inspection?.id || 'unknown');
  
  const result = inspection?.result;
  if (!result?.result) {
    console.error(`${debugContext}: No inspection result data found`);
    return '';
  }

  const { downloadedFonts, fontFaceDeclarations, activeFonts } = result.result;
  
  console.log(`${debugContext}: Data summary:`, {
    downloadedFontsCount: downloadedFonts?.length || 0,
    fontFaceDeclarationsCount: fontFaceDeclarations?.length || 0,
    activeFontsCount: activeFonts?.length || 0
  });

  // Prepare CSV data
  let csvContent = "data:text/csv;charset=utf-8,";
  
  // Headers for downloadedFonts with metadata
  csvContent += "Font Family,Font Name,Format,Size (KB),URL,Source,Foundry,Copyright,Version,License Info,Embedding Permissions,Designer,Creation Date\n";
  
  // Add downloaded fonts data
  if (downloadedFonts?.length) {
    downloadedFonts.forEach((font: FontFile, index: number) => {
      console.log(`${debugContext}: Processing font ${index + 1}/${downloadedFonts.length}:`, font.name);
      
      const fontFamily = findFontFamilyFromCSS(
        font.url, 
        fontFaceDeclarations || [], 
        font.metadata,
        `${debugContext} Font ${index + 1}`
      );
      
      // Extract metadata fields
      const metadata = font.metadata;
      const embeddingPerms = metadata?.embeddingPermissions ? 
        [
          metadata.embeddingPermissions.installable ? 'Installable' : '',
          metadata.embeddingPermissions.editable ? 'Editable' : '',
          metadata.embeddingPermissions.previewAndPrint ? 'Preview&Print' : '',
          metadata.embeddingPermissions.restrictedLicense ? 'Restricted' : ''
        ].filter(Boolean).join(' | ') : '';
      
      const row = [
        fontFamily,
        font.name || 'Unknown',
        font.format || 'Unknown',
        (font.size / 1024).toFixed(2) || '0',
        font.url || '',
        font.source || 'Unknown',
        metadata?.foundry || '',
        metadata?.copyright || '',
        metadata?.version || '',
        metadata?.licenseInfo || '',
        embeddingPerms,
        metadata?.designer || '',
        metadata?.creationDate || ''
      ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
      
      csvContent += row + "\n";
    });
  } else {
    console.warn(`${debugContext}: No downloaded fonts found`);
  }
  
  // Add a separator if we have active fonts data too
  if (activeFonts?.length && downloadedFonts?.length) {
    csvContent += "\n";
    csvContent += "Active Fonts\n";
    csvContent += "Font Family,Element Count\n";
    
    activeFonts.forEach((font: ActiveFont) => {
      const elementCount = font.elementCount || font.count || 0;
      const row = [
        font.family || 'Unknown',
        elementCount.toString()
      ].map(value => `"${String(value).replace(/"/g, '""')}"`).join(',');
      
      csvContent += row + "\n";
    });
  }

  console.log(`${debugContext}: CSV generation completed`);
  return csvContent;
}

// Trigger CSV download
export function downloadCSV(csvContent: string, filename: string): void {
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
} 