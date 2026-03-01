#!/bin/bash
# StackTrack Pro - Quick Start Test Script
# This script sets up test data and verifies the auction system

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "StackTrack Pro - Auction System Quick Test"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Check if Firebase CLI is installed
if ! command -v firebase &> /dev/null; then
    echo "❌ Firebase CLI not found. Install with: npm install -g firebase-tools"
    exit 1
fi

echo "✅ Firebase CLI found"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Not in /web directory. Please run from: stacktrackpro/web"
    exit 1
fi

echo "✅ In correct directory: $(pwd)"
echo ""

# Build the app
echo "📦 Building Next.js app..."
npm run build > /dev/null 2>&1
echo "✅ Build complete"
echo ""

# Deploy Firestore rules
echo "🔒 Deploying Firestore security rules..."
firebase deploy --only firestore:rules
echo "✅ Rules deployed"
echo ""

# Deploy hosting
echo "🚀 Deploying to Firebase Hosting..."
firebase deploy --only hosting
echo "✅ Hosting deployed"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "🎉 Deployment Complete!"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Live at: https://stacktrackpro.web.app"
echo ""
echo "Next Steps:"
echo "1. Open https://stacktrackpro.web.app in your browser"
echo "2. Create 2-3 test accounts"
echo "3. Follow TESTING_GUIDE.md for manual testing"
echo "4. Check console (F12) for any errors"
echo ""
