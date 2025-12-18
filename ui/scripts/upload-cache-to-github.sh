#!/bin/bash

# Upload ZKP Cache Files to GitHub Releases
# This script helps deploy large cache files to GitHub Releases (free, 2GB per file limit)

set -e

REPO_OWNER="SuryaSundarVadali"  # Change this
REPO_NAME="MinaID"
TAG_NAME="v1.0.0-cache"
RELEASE_NAME="ZKP Cache Files v1.0.0"
CACHE_DIR="./public/cache"

echo "🚀 Uploading ZKP Cache Files to GitHub Releases"
echo "================================================"
echo ""
echo "Repository: $REPO_OWNER/$REPO_NAME"
echo "Tag: $TAG_NAME"
echo "Cache Directory: $CACHE_DIR"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check if logged in
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not logged in to GitHub CLI"
    echo "Run: gh auth login"
    exit 1
fi

echo "✅ GitHub CLI is ready"
echo ""

# Check if cache directory exists
if [ ! -d "$CACHE_DIR" ]; then
    echo "❌ Error: Cache directory not found: $CACHE_DIR"
    exit 1
fi

echo "📁 Cache files found:"
ls -lh "$CACHE_DIR" | grep -v "^total" | awk '{print "  "$9" ("$5")"}'
echo ""

# Count files
FILE_COUNT=$(ls -1 "$CACHE_DIR" | wc -l)
echo "Total files: $FILE_COUNT"
echo ""

# Calculate total size
TOTAL_SIZE=$(du -sh "$CACHE_DIR" | cut -f1)
echo "Total size: $TOTAL_SIZE"
echo ""

read -p "Continue with upload? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled."
    exit 0
fi

echo ""
echo "Creating GitHub Release..."

# Create or update release
if gh release view "$TAG_NAME" --repo "$REPO_OWNER/$REPO_NAME" &> /dev/null; then
    echo "ℹ️  Release $TAG_NAME already exists. Using existing release."
else
    echo "Creating new release: $TAG_NAME"
    gh release create "$TAG_NAME" \
        --repo "$REPO_OWNER/$REPO_NAME" \
        --title "$RELEASE_NAME" \
        --notes "ZKP cache files for Mina o1js circuit compilation. These files are used to speed up proof generation from 90+ seconds to <5 seconds.

**Usage:**
Set the following environment variable in your deployment:
\`\`\`
NEXT_PUBLIC_CACHE_URL=https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$TAG_NAME
\`\`\`

**Files included:**
- Lagrange basis polynomials (fp/fq)
- SRS (Structured Reference String)  
- Verification keys (step-vk-*, wrap-vk-*)
- Proving keys (step-pk-*, wrap-pk-*)
- Header files (.header)

**Total size:** $TOTAL_SIZE
**File count:** $FILE_COUNT
" \
        --draft=false \
        --prerelease=false
    
    echo "✅ Release created"
fi

echo ""
echo "📤 Uploading cache files..."
echo ""

UPLOADED=0
FAILED=0

cd "$CACHE_DIR"

for file in *; do
    if [ -f "$file" ]; then
        FILE_SIZE=$(ls -lh "$file" | awk '{print $5}')
        echo "Uploading: $file ($FILE_SIZE)"
        
        # Check if file already exists in release
        if gh release view "$TAG_NAME" --repo "$REPO_OWNER/$REPO_NAME" --json assets -q ".assets[].name" | grep -q "^$file$"; then
            echo "  ⚠️  File already exists, skipping..."
        else
            if gh release upload "$TAG_NAME" "$file" --repo "$REPO_OWNER/$REPO_NAME" --clobber; then
                echo "  ✅ Uploaded successfully"
                ((UPLOADED++))
            else
                echo "  ❌ Upload failed"
                ((FAILED++))
            fi
        fi
        echo ""
    fi
done

cd - > /dev/null

echo ""
echo "================================================"
echo "📊 Upload Summary"
echo "================================================"
echo "Uploaded: $UPLOADED files"
echo "Failed: $FAILED files"
echo "Release URL: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/$TAG_NAME"
echo ""
echo "✅ Done!"
echo ""
echo "Next steps:"
echo "1. Add this to your Vercel environment variables:"
echo "   NEXT_PUBLIC_CACHE_URL=https://github.com/$REPO_OWNER/$REPO_NAME/releases/download/$TAG_NAME"
echo ""
echo "2. Redeploy your application"
echo ""
echo "3. Test cache access at: https://mina-id-suryasundarvadalis-projects.vercel.app/test-cache-api"
echo ""
