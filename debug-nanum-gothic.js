#!/usr/bin/env node

// Debug script to examine Nanum Gothic font matching issue
const puppeteer = require('puppeteer-core');
const fs = require('fs');

async function debugNanumGothic() {
  let browser = null;
  
  try {
    console.log('🔍 Debugging Nanum Gothic font matching issue...');
    console.log('Target: https://www.fncent.com/');
    
    // Chrome paths for different platforms
    const chromePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/opt/google/chrome/chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ];
    
    let executablePath = null;
    
    for (const path of chromePaths) {
      if (fs.existsSync(path)) {
        executablePath = path;
        break;
      }
    }
    
    if (!executablePath) {
      throw new Error('Chrome executable not found');
    }
    
    browser = await puppeteer.launch({
      headless: true,
      executablePath: executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    console.log('Navigating to https://www.fncent.com/...');
    
    await page.goto('https://www.fncent.com/', { waitUntil: 'networkidle2' });
    
    // Extract active fonts
    console.log('\\n=== ACTIVE FONTS ===');
    const activeFonts = await page.evaluate(() => {
      const fontUsage = new Map();
      const elements = document.querySelectorAll('*');
      
      elements.forEach(el => {
        if (!el.textContent?.trim()) return;
        
        const style = window.getComputedStyle(el);
        const fontFamily = style.fontFamily;
        
        if (fontFamily) {
          const primaryFont = fontFamily.split(',')[0].trim().replace(/["']/g, '');
          fontUsage.set(primaryFont, (fontUsage.get(primaryFont) || 0) + 1);
        }
      });
      
      return Array.from(fontUsage.entries())
        .map(([family, elementCount]) => ({ family, elementCount }))
        .sort((a, b) => b.elementCount - a.elementCount);
    });
    
    activeFonts.forEach(font => {
      console.log(`- ${font.family}: ${font.elementCount} elements`);
    });
    
    // Extract @font-face declarations
    console.log('\\n=== @FONT-FACE DECLARATIONS ===');
    const fontFaceDeclarations = await page.evaluate(() => {
      const declarations = [];
      
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          const rules = sheet.cssRules || [];
          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            if (rule instanceof CSSFontFaceRule) {
              const cssText = rule.cssText;
              const family = cssText.match(/font-family\\s*:\\s*['"]?([^'";]+)/i)?.[1] || '';
              const sources = cssText.match(/src\\s*:([^;]+)/i)?.[1] || '';
              const weight = cssText.match(/font-weight\\s*:\\s*([^;]+)/i)?.[1] || '';
              const style = cssText.match(/font-style\\s*:\\s*([^;]+)/i)?.[1] || '';
              
              if (family && sources) {
                declarations.push({
                  family: family.trim(),
                  source: sources.trim(),
                  weight: weight.trim() || undefined,
                  style: style.trim() || undefined
                });
              }
            }
          }
        } catch (error) {
          // Skip inaccessible stylesheets
        }
      }
      
      return declarations;
    });
    
    fontFaceDeclarations.forEach((decl, index) => {
      console.log(`${index + 1}. Family: "${decl.family}"`);
      console.log(`   Weight: ${decl.weight || 'undefined'}`);
      console.log(`   Style: ${decl.style || 'undefined'}`);
      console.log(`   Source: ${decl.source.substring(0, 100)}...`);
      console.log('');
    });
    
    // Test the font matching logic
    console.log('\\n=== FONT MATCHING TEST ===');
    const nanumGothicActive = activeFonts.find(font => 
      font.family.toLowerCase().includes('nanum') || 
      font.family.toLowerCase().includes('gothic')
    );
    
    if (nanumGothicActive) {
      console.log(`Active font: "${nanumGothicActive.family}"`);
      
      // Clean font name function (from font-matching.ts)
      const cleanFontName = (fontName) => {
        return fontName
          .toLowerCase()
          .replace(/["']/g, '') // Remove quotes
          .trim();
      };
      
      const cleanActiveFontName = cleanFontName(nanumGothicActive.family);
      console.log(`Cleaned active font name: "${cleanActiveFontName}"`);
      
      // Look for matching @font-face declarations
      const matchingDeclarations = fontFaceDeclarations.filter(declaration => {
        const cleanDeclarationFamily = cleanFontName(declaration.family);
        const matches = cleanDeclarationFamily === cleanActiveFontName;
        
        console.log(`  Comparing "${cleanDeclarationFamily}" === "${cleanActiveFontName}" -> ${matches}`);
        return matches;
      });
      
      console.log(`Found ${matchingDeclarations.length} matching @font-face declarations`);
      
      if (matchingDeclarations.length === 0) {
        console.log('\\n❌ NO MATCHING @FONT-FACE DECLARATIONS FOUND');
        console.log('This explains why "No font file found" appears in the Active Fonts tab');
        
        console.log('\\nAll @font-face families:');
        fontFaceDeclarations.forEach((decl, index) => {
          const cleaned = cleanFontName(decl.family);
          console.log(`  ${index + 1}. "${decl.family}" -> cleaned: "${cleaned}"`);
        });
      } else {
        console.log('\\n✅ Found matching declarations - should work correctly');
      }
    } else {
      console.log('❌ No Nanum Gothic found in active fonts');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

debugNanumGothic();
