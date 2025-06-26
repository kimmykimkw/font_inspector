#!/bin/bash

# Font Inspector - Remove macOS Quarantine Script
# This script removes the quarantine attribute that prevents Font Inspector from running
# Use this if you get security warnings when trying to open the app

echo "🔓 Font Inspector - Remove macOS Quarantine"
echo "=========================================="
echo ""

# Check if Font Inspector is installed
if [ ! -d "/Applications/Font Inspector.app" ]; then
    echo "❌ Font Inspector.app not found in /Applications/"
    echo "Please make sure Font Inspector is installed in your Applications folder."
    echo ""
    echo "If it's installed elsewhere, you can run:"
    echo "xattr -rd com.apple.quarantine \"/path/to/Font Inspector.app\""
    exit 1
fi

echo "📱 Found Font Inspector in Applications folder"
echo "🔧 Removing quarantine attribute..."
echo ""

# Remove quarantine attribute
xattr -rd com.apple.quarantine "/Applications/Font Inspector.app"

# Check if the command was successful
if [ $? -eq 0 ]; then
    echo "✅ Successfully removed quarantine attribute!"
    echo "🚀 Font Inspector should now open without security warnings."
    echo ""
    echo "Note: You may still need to right-click → Open the first time"
    echo "if you haven't done so already."
else
    echo "❌ Failed to remove quarantine attribute."
    echo "You may need to run this script with sudo:"
    echo "sudo ./remove-quarantine.sh"
fi

echo ""
echo "🎯 You can now launch Font Inspector normally!" 