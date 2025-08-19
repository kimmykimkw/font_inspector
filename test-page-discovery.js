#!/usr/bin/env node

/**
 * Test script for page discovery functionality
 * Run with: node test-page-discovery.js
 */

const { PageDiscoveryService } = require('./src/lib/page-discovery.ts');

async function testPageDiscovery() {
  console.log('🧪 Testing Page Discovery Service\n');
  
  const testCases = [
    {
      url: 'https://example.com',
      pageCount: 5,
      description: 'Basic website with 5 pages'
    },
    {
      url: 'https://fonts.google.com',
      pageCount: 10,
      description: 'Google Fonts website with 10 pages'
    },
    {
      url: 'github.com',
      pageCount: 5,
      description: 'GitHub without protocol (should auto-add https)'
    }
  ];

  for (const testCase of testCases) {
    console.log(`\n📋 Test: ${testCase.description}`);
    console.log(`🔗 URL: ${testCase.url}`);
    console.log(`📄 Requested pages: ${testCase.pageCount}`);
    console.log('⏳ Discovering pages...\n');

    try {
      const startTime = Date.now();
      
      const result = await PageDiscoveryService.discoverPages(testCase.url, {
        maxPages: testCase.pageCount,
        timeout: 30000,
        includeSubdomains: false
      });

      const duration = Date.now() - startTime;

      console.log(`✅ Success! Found ${result.length} pages in ${duration}ms`);
      console.log('📋 Discovered pages:');
      
      result.forEach((page, index) => {
        console.log(`  ${index + 1}. ${page.url}`);
        console.log(`     Priority: ${page.priority}, Source: ${page.source}`);
        if (page.title) {
          console.log(`     Title: ${page.title}`);
        }
      });
      
    } catch (error) {
      console.error(`❌ Failed: ${error.message}`);
      console.error('Stack trace:', error.stack);
    }
    
    console.log('\n' + '='.repeat(80));
  }
}

// Run the test
if (require.main === module) {
  testPageDiscovery()
    .then(() => {
      console.log('\n🎉 All tests completed!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Test suite failed:', error);
      process.exit(1);
    });
}

module.exports = { testPageDiscovery };
