#!/bin/bash

# Font Inspector - Release Publishing Script
# Usage: ./publish-release.sh [patch|minor|major]

set -e  # Exit on any error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Font Inspector Release Publisher${NC}"

# Check if GH_TOKEN is set
if [ -z "$GH_TOKEN" ]; then
    echo -e "${RED}❌ GH_TOKEN environment variable is not set${NC}"
    echo -e "${YELLOW}Please set it with: export GH_TOKEN=your_github_token${NC}"
    exit 1
fi

# Default to patch if no argument provided
VERSION_TYPE=${1:-patch}

# Validate version type
if [[ ! "$VERSION_TYPE" =~ ^(patch|minor|major)$ ]]; then
    echo -e "${RED}❌ Invalid version type: $VERSION_TYPE${NC}"
    echo -e "${YELLOW}Usage: $0 [patch|minor|major]${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Current status:${NC}"
git status --porcelain

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${YELLOW}⚠️  Working directory is not clean. Committing changes...${NC}"
    git add .
    git commit -m "Prepare for $VERSION_TYPE release"
fi

echo -e "${BLUE}📦 Bumping $VERSION_TYPE version...${NC}"
NEW_VERSION=$(npm version $VERSION_TYPE)
echo -e "${GREEN}✅ New version: $NEW_VERSION${NC}"

echo -e "${BLUE}🔄 Pushing to GitHub...${NC}"
git push origin main
git push origin $NEW_VERSION

echo -e "${BLUE}🏗️  Building and publishing release...${NC}"
npm run publish:mac

echo -e "${GREEN}🎉 Release $NEW_VERSION published successfully!${NC}"
echo -e "${BLUE}📱 Check your release at: https://github.com/kimmykimkw/font_inspector/releases${NC}"

echo -e "${YELLOW}🔧 To test auto-updates:${NC}"
echo -e "1. Install the previous version from GitHub releases"
echo -e "2. Run the app - it will automatically check for updates"
echo -e "3. Within an hour, it should prompt to update to $NEW_VERSION" 