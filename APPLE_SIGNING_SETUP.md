# Apple Code Signing & Notarization Setup

## Prerequisites

You have a `.p12` certificate file and password ready. Make sure you have:
- `certificate.p12` file in your project root
- Certificate password: `uv3NKEfLck5vaal`

## Environment Variables Setup

Create a `.env.local` file in your project root with the following:

```bash
# Code Signing Certificate
CSC_LINK="./certificate.p12"
CSC_KEY_PASSWORD="uv3NKEfLck5vaal"

# Notarization (Required for App Store distribution)
APPLE_ID="your-apple-id-email@example.com"
APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
APPLE_TEAM_ID="your-team-id"
```

## Setup Steps

### 1. Get Your Team ID
1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Sign in with your Apple ID
3. Go to "Membership" section
4. Copy your Team ID (10 characters)
5. Replace `TEAM_ID_PLACEHOLDER` in `package.json` with your actual Team ID

### 2. Create App-Specific Password
1. Go to [Apple ID Account Page](https://appleid.apple.com/)
2. Sign in with your Apple ID
3. Go to "Security" → "App-Specific Passwords"
4. Click "Generate Password"
5. Label it "Font Inspector Notarization"
6. Copy the generated password

### 3. Update package.json
Replace `TEAM_ID_PLACEHOLDER` in the notarize section with your actual Team ID:

```json
"notarize": {
  "teamId": "YOUR_ACTUAL_TEAM_ID"
}
```

## Build Commands

### Development Build (No Signing)
```bash
npm run dist:mac
```

### Production Build (Signed & Notarized)
```bash
# Set environment variables and build
export CSC_LINK="./certificate.p12"
export CSC_KEY_PASSWORD="uv3NKEfLck5vaal"
export APPLE_ID="your-apple-id@example.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password"
export APPLE_TEAM_ID="your-team-id"

npm run dist:mac:signed
```

### Publish to GitHub Releases (Signed & Notarized)
```bash
# Same environment variables as above
npm run publish:mac
```

## Configuration Changes Made

### Fixed Scripts
- ✅ Removed hardcoded identity from `dist:mac:signed`
- ✅ Removed hardcoded identity from `publish:mac`
- ✅ Enabled `CSC_IDENTITY_AUTO_DISCOVERY` (removed the false flag)
- ✅ Cleaned up all signing scripts

### Fixed Build Configuration
- ✅ Removed hardcoded identity from mac build config
- ✅ Updated notarization to use teamId format
- ✅ Kept existing entitlements configuration

## Troubleshooting

### Common Issues

1. **"No identity found"**: Make sure your certificate is valid and CSC_LINK points to the correct file
2. **"Notarization failed"**: Check your Apple ID credentials and ensure 2FA is enabled
3. **"Team ID not found"**: Verify your Team ID is correct (10 characters, uppercase)

### Verification Commands

```bash
# Check if certificate is readable
security find-identity -v -p codesigning

# Test certificate password
openssl pkcs12 -in certificate.p12 -noout -passin pass:uv3NKEfLck5vaal
```

## Important Notes

- Your certificate file (`certificate.p12`) should be in your project root
- Never commit your certificate or passwords to version control
- Add `.env.local` to your `.gitignore` file
- The notarization process can take 5-10 minutes
- Keep your Apple ID credentials secure

## Security Checklist

- [ ] Certificate file is not committed to git
- [ ] Environment variables are set locally only
- [ ] App-specific password is generated and stored securely
- [ ] Team ID is correct in package.json

## 🎉 Good News: You're Almost Ready!

Your Font Inspector app is already well-configured for Apple code signing and notarization. Here's what you need to complete the setup:

## ✅ What You Already Have

- ✅ Apple Developer Certificate installed
- ✅ Code signing scripts configured
- ✅ Entitlements file created
- ✅ Notarization package installed
- ✅ Updated build configuration

## 🔧 Final Setup Steps

### Step 1: Create App-Specific Password

1. Go to [Apple ID Account Page](https://appleid.apple.com/)
2. Sign in with your Apple ID: `kimmykimcompany@gmail.com`
3. Go to **App-Specific Passwords** section
4. Generate a new password with label: "Font Inspector Notarization"
5. **Save this password securely** - you'll need it for environment variables

### Step 2: Set Environment Variables

Add these to your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
# Apple Code Signing & Notarization (Required for electron-builder 26.0.12+)
export APPLE_ID="kimmykimcompany@gmail.com"
export APPLE_APP_SPECIFIC_PASSWORD="your-app-specific-password-here"
export APPLE_TEAM_ID="D4D85KJ6FX"

# Code Signing Certificate (already configured in package.json)
export CSC_IDENTITY_AUTO_DISCOVERY=false
```

**Important**: All three Apple environment variables (`APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, and `APPLE_TEAM_ID`) are **required** for notarization to work with electron-builder 26.0.12+.

### Step 3: Test the Setup

```bash
# Reload your shell environment
source ~/.zshrc

# Test build with signing and notarization
npm run dist:mac:signed
```

## 🚀 Build Commands

### For Development/Testing (No Notarization)
```bash
npm run dist:mac              # Build without notarization
```

### For Production Release (With Notarization)
```bash
npm run dist:mac:signed       # Build with signing only
npm run publish:mac           # Build, sign, notarize, and publish
```

## 📋 Pre-Release Checklist

- [ ] App-specific password created and saved
- [ ] Environment variables set in shell profile
- [ ] Test build completes without errors
- [ ] App passes Gatekeeper assessment
- [ ] Auto-updates work correctly

## 🔍 Verification Commands

### Check Certificate
```bash
security find-identity -v -p codesigning
```

### Verify Signed App
```bash
codesign -dv --verbose=4 /path/to/Font\ Inspector.app
```

### Check Notarization Status
```bash
spctl -a -vvv -t install /path/to/Font\ Inspector.app
```

## 🎯 Expected Results

After completing setup, your users will experience:

- ✅ **No security warnings** when opening the app
- ✅ **Seamless installation** - no "right-click → Open" required
- ✅ **Professional appearance** in system dialogs
- ✅ **Automatic updates** with verified signatures
- ✅ **Gatekeeper approval** for all macOS versions

## 🆘 Troubleshooting

### If You Get "configuration.mac.notarize should be a boolean" Error
This error occurs with electron-builder 26.0.12+. The fix is:
1. Ensure `notarize: true` (not an object) in package.json ✅ Already fixed
2. Set all required environment variables (see Step 2 above)

### If Notarization Fails
1. Check all environment variables are set:
   ```bash
   echo $APPLE_ID
   echo $APPLE_APP_SPECIFIC_PASSWORD
   echo $APPLE_TEAM_ID
   ```
2. Verify app-specific password works: `xcrun altool --list-providers -u "$APPLE_ID" -p "$APPLE_APP_SPECIFIC_PASSWORD"`
3. Check build logs for detailed error messages

### If Code Signing Fails
1. Verify certificate is valid: `security find-identity -v -p codesigning`
2. Check certificate expiration date
3. Ensure Xcode command line tools are installed: `xcode-select --install`

## 📞 Support

- **Apple Developer Support**: For certificate or notarization issues
- **Electron Builder Docs**: For build configuration questions
- **macOS Gatekeeper**: For security policy questions

Your app is ready for professional distribution! 🚀 