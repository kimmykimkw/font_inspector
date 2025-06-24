# Font Inspector - Distribution Guide

## 📦 Build Commands

### Development
```bash
npm run electron:dev        # Run in development mode
```

### Production Build & Distribution
```bash
npm run build:prod         # Build Next.js and Electron
npm run dist              # Build for current platform
npm run dist:mac          # Build for macOS (DMG + ZIP)
npm run dist:win          # Build for Windows (NSIS + ZIP)  
npm run dist:linux        # Build for Linux (AppImage + DEB)
```

## 📱 Distribution Files

After running `npm run dist:mac`, you'll find these files in the `release/` directory:

### macOS Distribution
- **`Font Inspector-0.1.0.dmg`** - Intel Mac installer (107MB)
- **`Font Inspector-0.1.0-arm64.dmg`** - Apple Silicon installer (103MB)
- **`Font Inspector-0.1.0-mac.zip`** - Intel Mac portable (103MB)
- **`Font Inspector-0.1.0-arm64-mac.zip`** - Apple Silicon portable (99MB)

### Auto-Update Files
- **`latest-mac.yml`** - Update metadata
- **`.blockmap`** files - Efficient update deltas

## 🚀 Distribution Methods

### Method 1: Direct Distribution (Current)
1. **Choose the right file for your users:**
   - Intel Macs (2020 and earlier): Use regular `.dmg` file
   - Apple Silicon Macs (M1/M2/M3): Use `-arm64.dmg` file

2. **Share via:**
   - Email attachment (files are ~100MB each)
   - Cloud storage (Google Drive, Dropbox, etc.)
   - Your website download page
   - GitHub Releases

3. **User Installation:**
   - Download appropriate DMG file
   - Double-click to mount
   - Drag "Font Inspector" to Applications folder
   - First launch: Right-click app → "Open" → confirm in security dialog

### Method 2: Professional Distribution (Recommended)

For production apps, consider these upgrades:

#### A. Code Signing (Eliminates Security Warnings)
1. **Get Apple Developer Account** ($99/year)
2. **Generate certificates:**
   ```bash
   # Request Developer ID Application certificate
   # Download and install in Keychain
   ```
3. **Update build config:**
   ```json
   "build": {
     "mac": {
       "identity": "Developer ID Application: Your Name (TEAM_ID)"
     }
   }
   ```

#### B. Notarization (Required for macOS 10.15+)
```bash
# After code signing, notarize with Apple
npx electron-notarization
```

#### C. Auto-Updates
1. **Set up update server:**
   ```json
   "publish": {
     "provider": "github",
     "owner": "yourusername",
     "repo": "font-inspector"
   }
   ```

2. **Enable in app:**
   ```javascript
   // In main.ts
   import { autoUpdater } from "electron-updater";
   autoUpdater.checkForUpdatesAndNotify();
   ```

## 🌐 Distribution Platforms

### GitHub Releases (Free)
1. Create release on GitHub
2. Upload DMG files as assets
3. Users download directly

### Mac App Store
1. Requires Apple Developer account
2. Additional review process
3. Built-in distribution and updates

### Your Website
1. Host DMG files on your server
2. Create download page with version info
3. Implement your own update mechanism

## 🔧 Build Optimization

### Reduce File Size
```json
"build": {
  "compression": "maximum",
  "nsis": {
    "oneClick": false,
    "perMachine": false
  }
}
```

### Icon Requirements
- **macOS**: `icon.icns` (multiple sizes: 16x16 to 1024x1024)
- **Windows**: `icon.ico` (16x16, 32x32, 48x48, 256x256)
- **Linux**: `icon.png` (512x512)

## 🛠 Troubleshooting

### Common Issues

**"App can't be opened" on macOS:**
- User needs to right-click → Open on first launch
- Or get code signing certificate

**App crashes on startup:**
- Check console logs in `/Applications/Utilities/Console.app`
- Verify all dependencies are included

**Large file sizes:**
- Enable compression in build config
- Remove unused dependencies
- Consider electron-builder optimization options

### Development vs Production

| Feature | Development | Production |
|---------|-------------|------------|
| Next.js | Dev server | Built static files |
| Hot reload | ✅ | ❌ |
| DevTools | Auto-open | Disabled |
| File size | Larger | Optimized |
| Performance | Slower | Faster |

## 📋 Pre-Distribution Checklist

- [ ] Update version number in `package.json`
- [ ] Update app metadata (author, description, homepage)
- [ ] Test on clean machine
- [ ] Verify all features work in production build
- [ ] Check file sizes are reasonable
- [ ] Test installation process
- [ ] Prepare release notes
- [ ] Consider code signing for professional distribution

## 🎯 Next Steps

1. **Test your current build** - Install the DMG on a clean Mac
2. **Update metadata** - Replace placeholder info in `package.json`
3. **Consider code signing** - For wider distribution
4. **Set up GitHub releases** - For easy version management
5. **Plan updates** - How will you distribute new versions?

Your Font Inspector app is now ready for distribution! 🚀 