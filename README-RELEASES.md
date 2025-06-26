# Font Inspector - Release Guide

## 🚀 Quick Release Commands

### Build Windows + macOS + Linux Release
```bash
# Set your GitHub token
export GH_TOKEN=your_github_token

# Release patch version for all platforms
./publish-release.sh patch all

# Release minor version for Windows only
./publish-release.sh minor win

# Release major version for macOS only
./publish-release.sh major mac
```

## 📦 Platform Support

### ✅ macOS (Complete Auto-Update Support)
- **Intel Macs**: `Font Inspector-X.X.X.dmg` and `Font Inspector-X.X.X-mac.zip`
- **Apple Silicon**: `Font Inspector-X.X.X-arm64.dmg` and `Font Inspector-X.X.X-arm64-mac.zip`
- **Auto-Updates**: Full support via menu bar "Check for Updates..." and hourly checks
- **Manual Updates**: Menu → Font Inspector → Check for Updates...

### ✅ Windows (Complete Auto-Update Support)
- **x64 Windows**: `Font Inspector Setup X.X.X.exe` (NSIS installer) and `Font Inspector-X.X.X-win.zip`
- **x86 Windows**: `Font Inspector-X.X.X-ia32-win.zip`
- **Auto-Updates**: Automatic download and installation
- **Manual Updates**: Check via app menu (same as macOS)

### ✅ Linux (Basic Support)
- **x64 Linux**: `Font Inspector-X.X.X.AppImage` and `Font Inspector-X.X.X.deb`
- **Auto-Updates**: Basic support

## 🛠 Release Script Usage

```bash
./publish-release.sh [VERSION_TYPE] [PLATFORM]
```

### Version Types
- `patch` - Bug fixes (0.1.2 → 0.1.3)
- `minor` - New features (0.1.2 → 0.2.0)
- `major` - Breaking changes (0.1.2 → 1.0.0)

### Platform Options
- `mac` - macOS only (Intel + Apple Silicon)
- `win` - Windows only (x64 + x86)
- `linux` - Linux only (x64)
- `all` - All platforms (default)

## 📋 Examples

```bash
# Release patch for Windows users
./publish-release.sh patch win

# Release minor update for all platforms
./publish-release.sh minor all

# Release major version for macOS only
./publish-release.sh major mac
```

## 🔄 Auto-Update Behavior

### Windows Users
1. **Installer**: Users download `Font Inspector Setup X.X.X.exe`
2. **Installation**: Standard Windows installer with shortcuts
3. **Auto-Updates**: App checks hourly and downloads updates automatically
4. **Manual Check**: Available through app menu
5. **Installation**: Updates install automatically on app restart

### macOS Users
1. **Installer**: Users download appropriate DMG file
2. **Installation**: Drag to Applications folder
3. **Auto-Updates**: App checks hourly for updates
4. **Manual Check**: Font Inspector → Check for Updates...
5. **Installation**: Downloads in background, installs on restart

### Linux Users
1. **AppImage**: Download and run directly
2. **DEB Package**: Install via package manager
3. **Auto-Updates**: Basic support

## 🎯 Distribution Files

After running the release script, check these files are created in `release/`:

### Windows
- `Font Inspector Setup X.X.X.exe` (NSIS installer)
- `Font Inspector-X.X.X-win.zip` (x64 portable)
- `Font Inspector-X.X.X-ia32-win.zip` (x86 portable)
- `latest.yml` (Windows auto-update metadata)

### macOS
- `Font Inspector-X.X.X.dmg` (Intel installer)
- `Font Inspector-X.X.X-arm64.dmg` (Apple Silicon installer)
- `Font Inspector-X.X.X-mac.zip` (Intel portable)
- `Font Inspector-X.X.X-arm64-mac.zip` (Apple Silicon portable)
- `latest-mac.yml` (macOS auto-update metadata)

### Linux
- `Font Inspector-X.X.X.AppImage` (Universal)
- `Font Inspector-X.X.X.deb` (Debian/Ubuntu)

## 🔐 GitHub Token Setup

1. Go to GitHub Settings → Developer settings → Personal access tokens
2. Generate new token with `repo` scope
3. Set the token:
   ```bash
   export GH_TOKEN=your_github_token
   ```

## 🧪 Testing Auto-Updates

### Windows Testing
1. Install previous version from GitHub releases
2. Run the app
3. Updates should be checked automatically within an hour
4. Or manually trigger via app menu

### macOS Testing
1. Install previous DMG version
2. Run the app
3. Use "Font Inspector → Check for Updates..." to test manual updates
4. Or wait for automatic hourly check

## 🚨 Troubleshooting

### "Failed to build for Windows"
- Ensure you have the latest electron-builder
- Check that icon.ico exists in electron/assets/

### "GitHub upload failed"
- Verify GH_TOKEN is set correctly
- Check repository name in package.json publish section

### "Auto-updates not working"
- Ensure latest.yml/latest-mac.yml are uploaded to GitHub
- Check that users are running a version from GitHub releases

## 📊 Release Checklist

- [ ] Update version in package.json
- [ ] Test build locally: `npm run dist:win` or `npm run dist:mac`
- [ ] Set GitHub token: `export GH_TOKEN=token`
- [ ] Run release script: `./publish-release.sh patch all`
- [ ] Verify files uploaded to GitHub releases
- [ ] Test auto-update on previous version
- [ ] Update documentation if needed

## 🎉 Windows Support Complete!

Your Font Inspector app now has full Windows support with:
- ✅ Professional NSIS installer
- ✅ Portable ZIP versions (x64 & x86)
- ✅ Automatic update checking and installation
- ✅ Native Windows icons and branding
- ✅ Proper Windows user experience 