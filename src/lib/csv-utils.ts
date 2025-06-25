// CSV Export utility functions with enhanced debugging
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
}

export interface ActiveFont {
  family: string;
  elementCount: number;
  count?: number;
  preview?: string;
}

// Enhanced font family detection with comprehensive debugging
export function findFontFamilyFromCSS(
  fontUrl: string, 
  fontFaceDeclarations: FontFaceDeclaration[],
  debugContext: string = 'CSV Export'
): string {
  // Debug logging
  console.log(`${debugContext}: Processing font URL:`, fontUrl);
  console.log(`${debugContext}: Available @font-face declarations:`, fontFaceDeclarations?.length || 0);
  
  if (!fontFaceDeclarations?.length) {
    console.warn(`${debugContext}: No @font-face declarations available - this indicates a data retrieval issue`);
    return 'Unknown';
  }

  // Log all available font families for debugging
  const availableFamilies = fontFaceDeclarations.map(d => d.family).filter(Boolean);
  console.log(`${debugContext}: Available font families:`, availableFamilies);

  // Try to match the font URL with @font-face declarations
  for (let i = 0; i < fontFaceDeclarations.length; i++) {
    const declaration = fontFaceDeclarations[i];
    console.log(`${debugContext}: Checking declaration ${i + 1}:`, {
      family: declaration.family,
      source: declaration.source?.substring(0, 100) + '...' // Truncate for readability
    });

    if (declaration.source && declaration.family) {
      // Check if the font URL is referenced in the @font-face source
      const sourceUrls = declaration.source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
      
      if (sourceUrls) {
        console.log(`${debugContext}: Found ${sourceUrls.length} URL(s) in @font-face source`);
        
        for (const sourceUrl of sourceUrls) {
          // Extract the actual URL from url() declaration
          const urlMatch = sourceUrl.match(/url\(['"]?([^'")\s]+)['"]?\)/i);
          if (urlMatch && urlMatch[1]) {
            const cssUrl = urlMatch[1];
            console.log(`${debugContext}: Comparing font URL "${fontUrl}" with CSS URL "${cssUrl}"`);
            
            // Check if the font URL matches or ends with the CSS URL
            if (fontUrl === cssUrl || 
                fontUrl.endsWith(cssUrl) || 
                cssUrl.endsWith(fontUrl.split('/').pop() || '') ||
                fontUrl.includes(cssUrl.split('/').pop() || '')) {
              console.log(`${debugContext}: ✅ Found font family match: "${declaration.family}" for URL: ${fontUrl}`);
              return declaration.family.replace(/["']/g, '').trim();
            }
          }
        }
      } else {
        console.log(`${debugContext}: No URLs found in @font-face source`);
      }
    }
  }

  console.warn(`${debugContext}: ❌ No font family match found for URL: ${fontUrl} - using fallback`);
  
  // Enhanced fallback: try to extract meaningful name from filename
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
  
  // Headers for downloadedFonts
  csvContent += "Font Family,Font Name,Format,Size (KB),URL,Source\n";
  
  // Add downloaded fonts data
  if (downloadedFonts?.length) {
    downloadedFonts.forEach((font: FontFile, index: number) => {
      console.log(`${debugContext}: Processing font ${index + 1}/${downloadedFonts.length}:`, font.name);
      
      const fontFamily = findFontFamilyFromCSS(
        font.url, 
        fontFaceDeclarations || [], 
        `${debugContext} Font ${index + 1}`
      );
      
      const row = [
        fontFamily,
        font.name || 'Unknown',
        font.format || 'Unknown',
        (font.size / 1024).toFixed(2) || '0',
        font.url || '',
        font.source || 'Unknown'
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