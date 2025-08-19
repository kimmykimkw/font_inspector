#!/usr/bin/env node

// Test script to verify Adobe Fonts detection improvements
const { inspectWebsite } = require('./temp/server/services/inspectionService.js');

async function testAdobeFontsDetection() {
  console.log('🔍 Testing Adobe Fonts detection improvements...');
  console.log('Target: https://www.ygfamily.com/');
  
  try {
    // Run inspection on YG Family website
    const result = await inspectWebsite('https://www.ygfamily.com/', {
      captureScreenshots: false
    });
    
    console.log('\n✅ Inspection completed successfully!');
    console.log('\n📊 RESULTS SUMMARY:');
    console.log(`- Downloaded Fonts: ${result.downloadedFonts?.length || 0}`);
    console.log(`- Font-Face Declarations: ${result.fontFaceDeclarations?.length || 0}`);
    console.log(`- Active Fonts: ${result.activeFonts?.length || 0}`);
    
    // Check for Adobe Fonts specifically
    const adobeFonts = result.fontFaceDeclarations?.filter(decl => decl.isDynamic && decl.service === 'Adobe Fonts') || [];
    console.log(`- Adobe Fonts Detected: ${adobeFonts.length}`);
    
    if (adobeFonts.length > 0) {
      console.log('\n🎉 ADOBE FONTS FOUND:');
      adobeFonts.forEach((font, index) => {
        console.log(`${index + 1}. Font Family: ${font.family}`);
        console.log(`   Service: ${font.service}`);
        console.log(`   Source URL: ${font.source.substring(0, 80)}...`);
        if (font.weight) console.log(`   Weight: ${font.weight}`);
        if (font.style) console.log(`   Style: ${font.style}`);
        console.log('');
      });
    } else {
      console.log('\n⚠️  No Adobe Fonts detected - checking fallback detection...');
    }
    
    // Check for klavika specifically
    const klavikaFonts = result.fontFaceDeclarations?.filter(decl => 
      decl.family.toLowerCase().includes('klavika')
    ) || [];
    
    if (klavikaFonts.length > 0) {
      console.log('🎯 KLAVIKA FONTS FOUND:');
      klavikaFonts.forEach((font, index) => {
        console.log(`${index + 1}. ${font.family}`);
        console.log(`   Source: ${font.source}`);
        console.log('');
      });
    }
    
    // Check active fonts for klavika
    const klavikaActiveFonts = result.activeFonts?.filter(font => 
      font.family.toLowerCase().includes('klavika')
    ) || [];
    
    if (klavikaActiveFonts.length > 0) {
      console.log('🎯 KLAVIKA IN ACTIVE FONTS:');
      klavikaActiveFonts.forEach((font, index) => {
        console.log(`${index + 1}. ${font.family} (${font.elementCount} elements)`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error during inspection:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testAdobeFontsDetection().then(() => {
  console.log('\n✅ Test completed');
  process.exit(0);
}).catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
