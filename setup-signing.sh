#!/bin/bash

# Font Inspector - Code Signing Environment Setup
# Usage: source setup-signing.sh

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔐 Setting up code signing environment for Font Inspector${NC}"

# Certificate is now installed in keychain - no file configuration needed
echo -e "${GREEN}✅ Using certificate from keychain:${NC}"
echo -e "  Identity: Developer ID Application: KUN WON KIM (D4D85KJ6FX)"

# Apple ID configuration for notarization
export APPLE_ID="kimmykim@kakao.com"
export APPLE_APP_SPECIFIC_PASSWORD="tzlp-zupw-kicc-wcqo"
export APPLE_TEAM_ID="D4D85KJ6FX"

# Validate certificate is available in keychain
if security find-identity -v -p codesigning | grep -q "Developer ID Application: KUN WON KIM (D4D85KJ6FX)"; then
    echo -e "${GREEN}✅ Certificate found in keychain and ready for signing${NC}"
else
    echo -e "${RED}❌ Certificate not found in keychain${NC}"
    echo -e "${YELLOW}⚠️  Please install your Developer ID certificate in Keychain Access${NC}"
    return 1
fi

# Check Apple ID configuration
if [ -z "$APPLE_APP_SPECIFIC_PASSWORD" ]; then
    echo -e "${YELLOW}⚠️  APPLE_APP_SPECIFIC_PASSWORD is not set${NC}"
    echo -e "${BLUE}ℹ️  You need to set this for notarization to work${NC}"
    echo -e "${BLUE}ℹ️  Get it from: https://appleid.apple.com/ → Security → App-Specific Passwords${NC}"
fi

echo -e "${GREEN}✅ Apple ID environment variables set:${NC}"
echo -e "  APPLE_ID: $APPLE_ID"
echo -e "  APPLE_APP_SPECIFIC_PASSWORD: [${#APPLE_APP_SPECIFIC_PASSWORD} chars]"
echo -e "  APPLE_TEAM_ID: $APPLE_TEAM_ID"

echo -e "${BLUE}🚀 Ready to build signed releases!${NC}"
echo -e "${BLUE}Run: npm run dist:mac:signed${NC}" 