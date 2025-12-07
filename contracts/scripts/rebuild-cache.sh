#!/bin/bash
# rebuild-cache.sh - Force regenerate o1js circuit caches
# Use this script when experiencing stale verification key issues

set -e

echo "🔄 Starting cache regeneration..."

# Step 1: Clear existing caches
echo "📦 Clearing existing caches..."
rm -rf cache/
rm -rf ../ui/public/cache/
rm -rf ../ui/app/cache.json

# Step 2: Rebuild contracts from scratch
echo "🔨 Rebuilding contracts..."
npm run build

# Step 3: Generate fresh cache files
echo "⚡ Generating fresh cache files..."
npm run generate-cache

# Step 4: Copy to UI
echo "📋 Copying cache to UI..."
npm run copy-cache

# Step 5: Verify integrity
echo "✅ Verifying cache integrity..."
if [ -f "cache/README.md" ]; then
    echo "Cache files generated successfully!"
    ls -la cache/
else
    echo "❌ Cache generation failed!"
    exit 1
fi

echo ""
echo "🎉 Cache regeneration complete!"
echo ""
echo "Next steps:"
echo "1. Commit the updated cache files"
echo "2. Create a new GitHub release with cache files"
echo "3. Redeploy to Vercel"
echo ""
