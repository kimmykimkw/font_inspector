#!/usr/bin/env node

// Test the real API to verify enhanced Google Fonts solution
const fetch = require('node-fetch');

async function testRealInspection() {
  try {
    console.log('🔍 Testing Real API with Enhanced Google Fonts Solution');
    console.log('Target: https://www.fncent.com/');
    console.log('Checking if Nanum Gothic now shows proper font files...\n');
    
    // Make a real API call to the inspection endpoint
    const response = await fetch('http://localhost:3000/api/inspect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: 'https://www.fncent.com/'
      })
    });
    
    if (!response.ok) {
      console.log(`❌ API Error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
      return;
    }
    
    const result = await response.json();
    
    console.log('✅ API Response received successfully!\n');
    
    // Check if we have inspection data
    if (!result.inspectionId) {
      console.log('❌ No inspection ID returned');
      return;
    }
    
    console.log(`📝 Inspection ID: ${result.inspectionId}`);
    
    // Wait a moment for the inspection to complete
    console.log('⏳ Waiting for inspection to complete...');
    await new Promise(resolve => setTimeout(resolve, 15000)); // 15 second wait
    
    // Fetch the results
    const resultsResponse = await fetch(`http://localhost:3000/api/results/${result.inspectionId}`);
    
    if (!resultsResponse.ok) {
      console.log(`❌ Results API Error: ${resultsResponse.status} ${resultsResponse.statusText}`);
      return;
    }
    
    const inspectionData = await resultsResponse.json();
    
    console.log('\n📊 INSPECTION RESULTS ANALYSIS:');
    console.log(`- Downloaded Fonts: ${inspectionData.downloadedFonts?.length || 0}`);
    console.log(`- Font-Face Declarations: ${inspectionData.fontFaceDeclarations?.length || 0}`);
    console.log(`- Active Fonts: ${inspectionData.activeFonts?.length || 0}`);
    
    // Check for Google Fonts in font-face declarations
    const googleFontDeclarations = inspectionData.fontFaceDeclarations?.filter(decl => 
      decl.service === 'Google Fonts' || decl.source?.includes('fonts.gstatic.com')
    ) || [];
    
    console.log(`- Google Fonts @font-face declarations: ${googleFontDeclarations.length}`);
    
    // Check for Nanum Gothic specifically
    const nanumGothicDeclarations = inspectionData.fontFaceDeclarations?.filter(decl =>
      decl.family?.toLowerCase().includes('nanum') || 
      decl.family?.toLowerCase().includes('gothic')
    ) || [];
    
    console.log(`- Nanum Gothic @font-face declarations: ${nanumGothicDeclarations.length}`);
    
    // Check active fonts
    const nanumGothicActive = inspectionData.activeFonts?.find(font =>
      font.family?.toLowerCase().includes('nanum') || 
      font.family?.toLowerCase().includes('gothic')
    );
    
    if (nanumGothicActive) {
      console.log(`✅ Nanum Gothic found in active fonts: "${nanumGothicActive.family}" (${nanumGothicActive.elementCount} elements)`);
    } else {
      console.log('❌ Nanum Gothic not found in active fonts');
    }
    
    // Check if Google Fonts reconstruction worked
    if (googleFontDeclarations.length > 0) {
      console.log('\n🎉 SUCCESS! Google Fonts @font-face reconstruction is working!');
      console.log('Sample Google Fonts declarations:');
      googleFontDeclarations.slice(0, 3).forEach((decl, index) => {
        console.log(`  ${index + 1}. Family: "${decl.family}" (${decl.service || 'Google Fonts'})`);
        console.log(`     Weight: ${decl.weight}, Style: ${decl.style}`);
      });
    } else {
      console.log('\n⚠️  No Google Fonts @font-face declarations found - checking fallback matching...');
    }
    
    // Check if Nanum Gothic reconstruction worked
    if (nanumGothicDeclarations.length > 0) {
      console.log('\n🎯 NANUM GOTHIC SPECIFIC RESULTS:');
      console.log('✅ Nanum Gothic @font-face declarations found!');
      nanumGothicDeclarations.forEach((decl, index) => {
        console.log(`  ${index + 1}. Family: "${decl.family}"`);
        console.log(`     Source: ${decl.source?.substring(0, 60)}...`);
        console.log(`     Weight: ${decl.weight}, Style: ${decl.style}`);
        console.log(`     Service: ${decl.service || 'Unknown'}`);
      });
      
      console.log('\n🎉 The "No font file found" issue should now be FIXED!');
      console.log('Nanum Gothic will now properly show downloaded font files in the Active Fonts tab.');
    } else {
      console.log('\n❌ Nanum Gothic @font-face declarations not found');
      console.log('This suggests the enhanced solution may need debugging.');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testRealInspection();
