import opentype from 'opentype.js';
import decompress from 'woff2-encoder/decompress';

// Font metadata interface (matches the one in models)
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

/**
 * Extract comprehensive metadata from a font buffer
 * @param fontBuffer - ArrayBuffer containing the font data
 * @param fontUrl - Optional URL for debugging context
 * @returns Promise<FontMetadata> - Extracted metadata
 */
export async function extractFontMetadata(
  fontBuffer: ArrayBuffer, 
  fontUrl?: string
): Promise<FontMetadata> {
  const debugContext = fontUrl || 'Unknown font';
  
  try {
    console.log(`Font Metadata Extractor: Processing font from ${debugContext}`);
    
    // Check if this is a WOFF2 font and decompress if needed
    let processedBuffer = fontBuffer;
    
    // Check font signature to determine if it's WOFF2
    const signature = new Uint8Array(fontBuffer.slice(0, 4));
    const signatureString = String.fromCharCode(...signature);
    
    if (signatureString === 'wOF2') {
      console.log(`Font Metadata Extractor: Detected WOFF2 format, decompressing...`);
      try {
        const decompressed = await decompress(fontBuffer);
        // Convert Uint8Array to ArrayBuffer
        processedBuffer = new ArrayBuffer(decompressed.length);
        new Uint8Array(processedBuffer).set(decompressed);
        console.log(`Font Metadata Extractor: Successfully decompressed WOFF2 font`);
      } catch (decompressError) {
        console.error(`Font Metadata Extractor: Failed to decompress WOFF2:`, decompressError);
        throw new Error(`WOFF2 decompression failed: ${decompressError instanceof Error ? decompressError.message : 'Unknown error'}`);
      }
    }
    
    // Parse font using opentype.js
    console.log(`Font Metadata Extractor: Parsing font with OpenType.js...`);
    const font = opentype.parse(processedBuffer);
    
    if (!font) {
      throw new Error('OpenType.js returned null - invalid font file');
    }
    
    console.log(`Font Metadata Extractor: Font parsed successfully. Available properties:`, {
      hasNames: !!font.names,
      hasTables: !!font.tables,
      nameKeysCount: font.names ? Object.keys(font.names).length : 0,
      tableKeysCount: font.tables ? Object.keys(font.tables).length : 0
    });
    
    // Extract metadata from various font tables
    const metadata: FontMetadata = {
      fontName: extractFontName(font),
      foundry: extractFoundry(font),
      copyright: extractCopyright(font),
      version: extractVersion(font),
      licenseInfo: extractLicenseInfo(font),
      embeddingPermissions: extractEmbeddingPermissions(font),
      uniqueIdentifier: extractUniqueIdentifier(font),
      creationDate: extractCreationDate(font),
      designer: extractDesigner(font)
    };
    
    console.log(`Font Metadata Extractor: Successfully extracted metadata for ${debugContext}:`, {
      fontName: metadata.fontName,
      foundry: metadata.foundry,
      copyright: metadata.copyright?.substring(0, 50) + (metadata.copyright && metadata.copyright.length > 50 ? '...' : ''),
      version: metadata.version,
      hasLicenseInfo: !!metadata.licenseInfo,
      hasEmbeddingPermissions: !!metadata.embeddingPermissions,
      designer: metadata.designer,
      creationDate: metadata.creationDate,
      uniqueIdentifier: metadata.uniqueIdentifier?.substring(0, 30) + (metadata.uniqueIdentifier && metadata.uniqueIdentifier.length > 30 ? '...' : '')
    });
    
    return metadata;
    
  } catch (error) {
    console.error(`Font Metadata Extractor: Error processing font from ${debugContext}:`, error);
    console.error(`Font Metadata Extractor: Error stack:`, error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to extract font metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract font name from name table
 */
function extractFontName(font: any): string | null {
  return getNameTableValue(font, 1) || // Font Family Name
         getNameTableValue(font, 4) || // Full Font Name
         null;
}

/**
 * Extract foundry/manufacturer information
 */
function extractFoundry(font: any): string | null {
  return getNameTableValue(font, 8) || // Manufacturer Name
         getNameTableValue(font, 11) || // URL Vendor
         null;
}

/**
 * Extract copyright notice
 */
function extractCopyright(font: any): string | null {
  return getNameTableValue(font, 0) || null; // Copyright Notice
}

/**
 * Extract version information
 */
function extractVersion(font: any): string | null {
  return getNameTableValue(font, 5) || null; // Version String
}

/**
 * Extract license information
 */
function extractLicenseInfo(font: any): string | null {
  return getNameTableValue(font, 13) || // License Description
         getNameTableValue(font, 14) || // License Info URL
         null;
}

/**
 * Extract unique identifier
 */
function extractUniqueIdentifier(font: any): string | null {
  return getNameTableValue(font, 3) || null; // Unique Font Identifier
}

/**
 * Extract creation date from head table
 */
function extractCreationDate(font: any): string | null {
  try {
    if (font.tables.head?.created) {
      // Convert from Mac epoch (1904) to Unix epoch (1970)
      const macEpochOffset = 2082844800; // seconds between 1904 and 1970
      const unixTimestamp = (font.tables.head.created - macEpochOffset) * 1000;
      return new Date(unixTimestamp).toISOString();
    }
  } catch (error) {
    console.warn('Error extracting creation date:', error);
  }
  return null;
}

/**
 * Extract designer information
 */
function extractDesigner(font: any): string | null {
  return getNameTableValue(font, 9) || null; // Designer
}

/**
 * Extract embedding permissions from OS/2 table
 */
function extractEmbeddingPermissions(font: any): FontMetadata['embeddingPermissions'] | null {
  try {
    const os2Table = font.tables.os2;
    if (!os2Table || typeof os2Table.fsType === 'undefined') {
      return null;
    }
    
    const fsType = os2Table.fsType;
    
    return {
      installable: (fsType & 0x0001) === 0,     // Bit 0: Installable embedding allowed
      editable: (fsType & 0x0008) === 0,        // Bit 3: Editable embedding allowed
      previewAndPrint: (fsType & 0x0004) === 0, // Bit 2: Preview & Print embedding allowed
      restrictedLicense: (fsType & 0x0002) !== 0 // Bit 1: Restricted License embedding
    };
  } catch (error) {
    console.warn('Error extracting embedding permissions:', error);
    return null;
  }
}

/**
 * Helper function to extract values from name table
 * Prioritizes English language entries and tries multiple access methods
 */
function getNameTableValue(font: any, nameId: number): string | undefined {
  try {
    // Method 1: Direct property access (common for basic properties)
    if (nameId === 1 && font.familyName) {
      return cleanNameValue(font.familyName);
    }
    if (nameId === 4 && font.fullName) {
      return cleanNameValue(font.fullName);
    }
    
    // Method 2: Check if font.names exists and has the nameId
    if (font.names && font.names[nameId]) {
      const nameRecord = font.names[nameId];
      
      // If it's a simple string, return it
      if (typeof nameRecord === 'string') {
        return cleanNameValue(nameRecord);
      }

      // If it's an object with language/platform entries
      if (typeof nameRecord === 'object') {
        // Try to get English entries first
        const preferredKeys = ['en', 'en-US', 'en-us', '1033', '0', 'default'];
        
        for (const key of preferredKeys) {
          if (nameRecord[key] && typeof nameRecord[key] === 'string') {
            return cleanNameValue(nameRecord[key]);
          }
        }
        
        // Fallback to first available value
        const values = Object.values(nameRecord);
        const firstStringValue = values.find(v => typeof v === 'string') as string;
        if (firstStringValue) {
          return cleanNameValue(firstStringValue);
        }
      }
    }

    // Method 3: Try accessing via name table directly
    if (font.tables && font.tables.name) {
      // Method 3a: Direct name table access
      if (font.tables.name.names) {
        const nameTableEntries = font.tables.name.names;
        
        // Find entries with matching nameID
        const matchingEntries = nameTableEntries.filter((entry: any) => entry.nameID === nameId);
        
        if (matchingEntries.length > 0) {
          // Prefer English entries (platformID 3 is Microsoft, languageID 1033 is English US)
          const englishEntry = matchingEntries.find((entry: any) => 
            entry.platformID === 3 && (entry.languageID === 1033 || entry.languageID === 0)
          );
          
          if (englishEntry && englishEntry.text) {
            return cleanNameValue(englishEntry.text);
          }
          
          // Fallback to first available entry
          const firstEntry = matchingEntries[0];
          if (firstEntry && firstEntry.text) {
            return cleanNameValue(firstEntry.text);
          }
        }
      }
      
      // Method 3b: Check if name table has direct properties
      const nameIdToProperty: { [key: number]: string } = {
        0: 'copyright',
        1: 'fontFamily', 
        2: 'fontSubfamily',
        3: 'uniqueID',
        4: 'fullName',
        5: 'version',
        6: 'postScriptName',
        8: 'manufacturer',
        9: 'designer',
        10: 'description',
        11: 'vendorURL',
        12: 'designerURL',
        13: 'licenseDescription',
        14: 'licenseURL'
      };
      
      const propertyName = nameIdToProperty[nameId];
      if (propertyName && font.tables.name[propertyName]) {
        return cleanNameValue(font.tables.name[propertyName]);
      }
    }
    
    return undefined;
  } catch (error) {
    console.warn(`Error extracting name table value for ID ${nameId}:`, error);
    return undefined;
  }
}

/**
 * Clean and normalize name table values
 * Handles both strings and OpenType.js name objects
 */
function cleanNameValue(value: any): string {
  // If it's already a string, clean it normally
  if (typeof value === 'string') {
    return value
      .replace(/\0/g, '') // Remove null characters
      .trim()
      .replace(/\s+/g, ' '); // Normalize whitespace
  }
  
  // If it's an object (OpenType.js name record), extract the text
  if (typeof value === 'object' && value !== null) {
    // Try different ways to extract text from OpenType.js name objects
    
    // Method 1: Direct text property
    if (value.text && typeof value.text === 'string') {
      return value.text
        .replace(/\0/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    }
    
    // Method 2: Value property
    if (value.value && typeof value.value === 'string') {
      return value.value
        .replace(/\0/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    }
    
    // Method 3: Try to find a string property in the object
    const stringProps = Object.values(value).filter(v => typeof v === 'string');
    if (stringProps.length > 0) {
      const firstString = stringProps[0] as string;
      return firstString
        .replace(/\0/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    }
    
    // Method 4: If it has en or similar language properties
    if (value.en && typeof value.en === 'string') {
      return value.en
        .replace(/\0/g, '')
        .trim()
        .replace(/\s+/g, ' ');
    }
    
    // Method 5: Try toString as last resort
    if (value.toString && typeof value.toString === 'function') {
      const stringValue = value.toString();
      if (stringValue !== '[object Object]') {
        return stringValue
          .replace(/\0/g, '')
          .trim()
          .replace(/\s+/g, ' ');
      }
    }
    
    console.warn(`Could not extract string from font metadata object:`, value);
    return 'Not available';
  }
  
  // If it's neither string nor object, convert to string
  return String(value)
    .replace(/\0/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Determine if a font buffer is likely to contain parseable metadata
 * This is a quick check before attempting full parsing
 */
export function isLikelyParseable(fontBuffer: ArrayBuffer): boolean {
  try {
    // Check for common font format headers
    const view = new DataView(fontBuffer);
    
    // Check for OpenType/TrueType signatures
    const signature = view.getUint32(0, false);
    
    // Common font signatures:
    // 0x00010000 - TrueType
    // 0x4F54544F - 'OTTO' (CFF-based OpenType)
    // 0x74727565 - 'true' (Mac TrueType)
    // 0x74797031 - 'typ1' (PostScript Type 1)
    const validSignatures = [
      0x00010000, // TrueType
      0x4F54544F, // OTTO
      0x74727565, // true
      0x74797031  // typ1
    ];
    
    return validSignatures.includes(signature);
  } catch (error) {
    return false;
  }
}

/**
 * Get a summary of metadata for logging/debugging
 */
export function getMetadataSummary(metadata: FontMetadata): string {
  const parts = [];
  
  if (metadata.fontName) parts.push(`Name: ${metadata.fontName}`);
  if (metadata.foundry) parts.push(`Foundry: ${metadata.foundry}`);
  if (metadata.version) parts.push(`Version: ${metadata.version}`);
  if (metadata.embeddingPermissions) {
    const perms = metadata.embeddingPermissions;
    const permissionSummary = [
      perms.installable ? 'Installable' : '',
      perms.editable ? 'Editable' : '',
      perms.previewAndPrint ? 'Preview&Print' : '',
      perms.restrictedLicense ? 'Restricted' : ''
    ].filter(Boolean).join(', ');
    
    if (permissionSummary) parts.push(`Permissions: ${permissionSummary}`);
  }
  
  return parts.join(' | ') || 'No metadata available';
} 