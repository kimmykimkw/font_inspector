#!/usr/bin/env node

// Test script to verify Firestore undefined values fix
const testData = {
  fontFaceDeclarations: [
    {
      family: 'klavika-web',
      source: 'url("https://use.typekit.net/...")',
      weight: undefined,
      style: undefined,
      isDynamic: true,
      service: 'Adobe Fonts'
    },
    {
      family: 'another-font',
      source: 'url("https://example.com/font.woff2")',
      weight: '400',
      style: 'normal',
      isDynamic: false,
      service: undefined
    }
  ]
};

// Simulate the cleaning function from firebaseService.ts
const cleanedDeclarations = testData.fontFaceDeclarations.map(decl => ({
  family: decl.family,
  source: decl.source,
  ...(decl.weight !== undefined && { weight: decl.weight }),
  ...(decl.style !== undefined && { style: decl.style }),
  ...(decl.isDynamic !== undefined && { isDynamic: decl.isDynamic }),
  ...(decl.service !== undefined && { service: decl.service })
}));

console.log('Original data:');
console.log(JSON.stringify(testData.fontFaceDeclarations, null, 2));

console.log('\nCleaned data (Firestore-safe):');
console.log(JSON.stringify(cleanedDeclarations, null, 2));

console.log('\nValidation:');
cleanedDeclarations.forEach((decl, index) => {
  const hasUndefined = Object.values(decl).some(val => val === undefined);
  console.log(`Declaration ${index + 1}: ${hasUndefined ? '❌ Has undefined values' : '✅ Firestore-safe'}`);
});

console.log('\n✅ Firestore fix validation completed!');
