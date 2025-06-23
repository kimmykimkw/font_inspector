#!/usr/bin/env node

const fetch = require('node-fetch');
const url = process.argv[2];

if (!url) {
  console.error('Please provide a URL to inspect');
  console.error('Usage: node test-inspection.js https://example.com');
  process.exit(1);
}

console.log(`Testing font inspection for: ${url}`);

fetch('http://localhost:3001/api/inspect', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    urls: [url]
  }),
})
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return response.json();
  })
  .then(data => {
    console.log('\n==== INSPECTION RESULTS ====\n');
    
    // Downloaded Fonts
    console.log('DOWNLOADED FONTS:');
    if (data.result.downloadedFonts.length === 0) {
      console.log('  No font files detected');
    } else {
      data.result.downloadedFonts.forEach(font => {
        console.log(`  - ${font.name} (${font.format}, ${font.size} bytes) from ${font.source}`);
        console.log(`    URL: ${font.url}`);
      });
    }
    
    // Font-Face Declarations
    console.log('\nFONT-FACE DECLARATIONS:');
    if (data.result.fontFaceDeclarations.length === 0) {
      console.log('  No @font-face declarations found');
    } else {
      data.result.fontFaceDeclarations.forEach(declaration => {
        console.log(`  - ${declaration.family}`);
        console.log(`    Source: ${declaration.source}`);
        if (declaration.weight) console.log(`    Weight: ${declaration.weight}`);
        if (declaration.style) console.log(`    Style: ${declaration.style}`);
      });
    }
    
    // Active Fonts
    console.log('\nACTIVE FONTS:');
    if (data.result.activeFonts.length === 0) {
      console.log('  No active fonts detected');
    } else {
      data.result.activeFonts.forEach(font => {
        console.log(`  - ${font.family} (used in ${font.elementCount} elements)`);
        if (font.preview) console.log(`    Preview text: "${font.preview}"`);
      });
    }
    
    console.log('\n==== END OF RESULTS ====');
  })
  .catch(error => {
    console.error('Error:', error.message);
  }); 