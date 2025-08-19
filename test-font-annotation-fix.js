#!/usr/bin/env node

import { inspectWebsite } from './src/server/services/inspectionService.js';

async function testFontAnnotationFix() {
  console.log('🔍 Testing font annotation fix for HYBE website...');
  console.log('This test will inspect https://hybecorp.com/ and check if font names are properly detected\n');

  try {
    const result = await inspectWebsite('https://hybecorp.com/');
    
    console.log('\n📊 INSPECTION RESULTS:');
    console.log('='.repeat(50));
    
    // Show active fonts
    if (result.activeFonts && result.activeFonts.length > 0) {
      console.log('\n🎯 ACTIVE FONTS DETECTED:');
      result.activeFonts.forEach((font, index) => {
        console.log(`${index + 1}. "${font.family}" (${font.elementCount} elements)`);
        if (font.preview) {
          console.log(`   Preview: "${font.preview.substring(0, 30)}${font.preview.length > 30 ? '...' : ''}"`);
        }
      });
    } else {
      console.log('❌ No active fonts detected');
    }
    
    // Show downloaded fonts
    if (result.downloadedFonts && result.downloadedFonts.length > 0) {
      console.log('\n📥 DOWNLOADED FONTS:');
      result.downloadedFonts.forEach((font, index) => {
        console.log(`${index + 1}. ${font.name} (${font.format})`);
        if (font.metadata) {
          console.log(`   Metadata font name: ${font.metadata.fontName || 'null'}`);
          console.log(`   Version: ${font.metadata.version || 'unknown'}`);
        }
      });
    } else {
      console.log('❌ No downloaded fonts detected');
    }
    
    // Show font face declarations
    if (result.fontFaceDeclarations && result.fontFaceDeclarations.length > 0) {
      console.log(`\n📝 FONT-FACE DECLARATIONS: ${result.fontFaceDeclarations.length} found`);
    }
    
    console.log('\n✅ Test completed successfully!');
    console.log('Check the logs above to see if font names are now properly detected.');
    
  } catch (error) {
    console.error('❌ Error during inspection:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testFontAnnotationFix().then(() => {
  console.log('\n🏁 Font annotation fix test finished.');
  process.exit(0);
}).catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
