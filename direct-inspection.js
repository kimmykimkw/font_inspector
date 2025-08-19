#!/usr/bin/env node

// Direct inspection script to get font-face declarations
const { inspectWebsite } = require('./src/server/services/inspectionService.ts');

async function runInspection() {
  try {
    console.log('Starting direct inspection of https://www.ygfamily.com/');
    
    const result = await inspectWebsite('https://www.ygfamily.com/', {
      captureScreenshots: false
    });
    
    console.log('\n==== FONT-FACE DECLARATIONS ====\n');
    
    if (result.fontFaceDeclarations.length === 0) {
      console.log('No @font-face declarations found');
    } else {
      result.fontFaceDeclarations.forEach((declaration, index) => {
        console.log(`${index + 1}. Font Family: ${declaration.family}`);
        console.log(`   Source: ${declaration.source}`);
        if (declaration.weight) console.log(`   Weight: ${declaration.weight}`);
        if (declaration.style) console.log(`   Style: ${declaration.style}`);
        console.log('');
        
        // Extract URLs from the source
        const urlMatches = declaration.source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
        if (urlMatches) {
          console.log('   Font URLs:');
          urlMatches.forEach(urlMatch => {
            const url = urlMatch.match(/url\(['"]?([^'")\s]+)['"]?\)/i)?.[1];
            if (url) {
              console.log(`     - ${url}`);
            }
          });
          console.log('');
        }
      });
    }
    
    // Specifically look for klavika-web
    console.log('\n==== KLAVIKA-WEB FONT SEARCH ====\n');
    const klavikaDeclaration = result.fontFaceDeclarations.find(d => 
      d.family.toLowerCase().includes('klavika')
    );
    
    if (klavikaDeclaration) {
      console.log('✅ Found klavika-web font declaration:');
      console.log(`Family: ${klavikaDeclaration.family}`);
      console.log(`Source: ${klavikaDeclaration.source}`);
      
      // Extract the specific URLs
      const urlMatches = klavikaDeclaration.source.match(/url\(['"]?([^'")\s]+)['"]?\)/gi);
      if (urlMatches) {
        console.log('\nKlavika Font File URLs:');
        urlMatches.forEach(urlMatch => {
          const url = urlMatch.match(/url\(['"]?([^'")\s]+)['"]?\)/i)?.[1];
          if (url) {
            console.log(`🔗 ${url}`);
          }
        });
      }
    } else {
      console.log('❌ No klavika-web font declaration found');
    }
    
  } catch (error) {
    console.error('Error during inspection:', error);
  }
}

runInspection();
