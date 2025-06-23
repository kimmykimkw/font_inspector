#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Helper to run a script and return a promise
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    const scriptName = path.basename(scriptPath);
    
    console.log(`\n${colors.bright}${colors.cyan}Running ${scriptName}${colors.reset}\n`);
    console.log(`${colors.yellow}${'='.repeat(50)}${colors.reset}\n`);
    
    const child = spawn('node', [scriptPath], { 
      stdio: 'inherit',
      shell: true
    });
    
    child.on('close', (code) => {
      if (code === 0) {
        console.log(`\n${colors.green}✓ ${scriptName} completed successfully${colors.reset}\n`);
        resolve();
      } else {
        console.error(`\n${colors.red}✗ ${scriptName} failed with code ${code}${colors.reset}\n`);
        resolve(); // Resolve anyway to continue to next test
      }
    });
    
    child.on('error', (err) => {
      console.error(`\n${colors.red}Error running ${scriptName}:${colors.reset}`, err);
      resolve(); // Resolve anyway to continue to next test
    });
  });
}

// Main function to run all tests
async function runAllTests() {
  console.log(`\n${colors.bright}${colors.magenta}Font Inspector Firebase Integration Tests${colors.reset}`);
  console.log(`${colors.yellow}${'='.repeat(50)}${colors.reset}\n`);
  
  const startTime = Date.now();
  
  try {
    // Test: API Integration
    await runScript(path.join(__dirname, 'test-api.js'));
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n${colors.bright}${colors.green}All tests completed in ${duration}s${colors.reset}`);
    console.log(`${colors.yellow}${'='.repeat(50)}${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.red}Error running tests:${colors.reset}`, error);
    process.exit(1);
  }
}

// Check for command line arguments
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
${colors.bright}Usage:${colors.reset}
  node run-tests.js [options]

${colors.bright}Options:${colors.reset}
  --api-only   Run only API integration tests
  --help, -h   Show this help message
  `);
  process.exit(0);
}

// Run specific tests based on arguments
if (args.includes('--api-only')) {
  runScript(path.join(__dirname, 'test-api.js'));
} else {
  runAllTests();
} 