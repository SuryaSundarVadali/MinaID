#!/bin/bash

# Robust Cache Upload Script with Better Error Handling
# Don't exit on error - handle errors gracefully
set +e

REPO_OWNER="SuryaSundarVadali"
REPO_NAME="MinaID"
TAG_NAME="v1.0.0-cache"
CACHE_DIR="./public/cache"

echo "🚀 Robust Cache Upload to GitHub Releases"
echo "==========================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ Error: GitHub CLI (gh) is not installed"
    exit 1
fi

# Check if logged in
if ! gh auth status &> /dev/null; then
    echo "❌ Error: Not logged in to GitHub CLI"
    exit 1
fi

echo "✅ GitHub CLI is ready"
echo ""

# Get current uploaded files
echo "📊 Checking current progress..."
CURRENT_COUNT=$(curl -s https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/$TAG_NAME | jq -r '.assets | length')
echo "Currently uploaded: $CURRENT_COUNT files"
echo ""

cd "$CACHE_DIR"

UPLOADED=0
FAILED=0
SKIPPED=0
TOTAL=$(ls -1 | wc -l)

echo "📤 Starting upload of $TOTAL files..."
echo ""

for file in *; do
    if [ ! -f "$file" ]; then
        continue
    fi
    
    FILE_SIZE=$(ls -lh "$file" | awk '{print $5}')
    echo "[$((UPLOADED + SKIPPED + FAILED + 1))/$TOTAL] $file ($FILE_SIZE)"
    
    # Check if already exists
    EXISTING=$(gh release view "$TAG_NAME" --repo "$REPO_OWNER/$REPO_NAME" --json assets -q ".assets[].name" 2>/dev/null | grep -x "$file" || echo "")
    if [ -n "$EXISTING" ]; then
        echo "  ⏭️  Already uploaded, skipping..."
        ((SKIPPED++))
    else
        # Upload with retry logic
        RETRY=0
        MAX_RETRIES=3
        SUCCESS=false
        
        while [ $RETRY -lt $MAX_RETRIES ] && [ "$SUCCESS" = false ]; do
            if [ $RETRY -gt 0 ]; then
                echo "  🔄 Retry $RETRY/$MAX_RETRIES..."
                sleep 5
            fi
            
            if timeout 300 gh release upload "$TAG_NAME" "$file" --repo "$REPO_OWNER/$REPO_NAME" --clobber 2>&1; then
                echo "  ✅ Uploaded successfully"
                ((UPLOADED++))
                SUCCESS=true
            else
                ((RETRY++))
                if [ $RETRY -eq $MAX_RETRIES ]; then
                    echo "  ❌ Upload failed after $MAX_RETRIES attempts"
                    ((FAILED++))
                fi
            fi
        done
    fi
    echo ""
    
    # Show progress every 10 files
    if [ $(( (UPLOADED + SKIPPED + FAILED) % 10 )) -eq 0 ]; then
        echo "📊 Progress: $UPLOADED uploaded, $SKIPPED skipped, $FAILED failed"
        echo ""
    fi
done

cd - > /dev/null

echo ""
echo "=========================================="
echo "📊 Upload Complete"
echo "=========================================="
echo "✅ Uploaded: $UPLOADED files"
echo "⏭️  Skipped: $SKIPPED files (already uploaded)"
echo "❌ Failed: $FAILED files"
echo ""

# Get final count
FINAL_COUNT=$(curl -s https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/releases/tags/$TAG_NAME | jq -r '.assets | length')
echo "Total files in release: $FINAL_COUNT"
echo ""
echo "🔗 Release URL: https://github.com/$REPO_OWNER/$REPO_NAME/releases/tag/$TAG_NAME"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "⚠️  Some files failed to upload. You can re-run this script to retry."
    exit 1
else
    echo "✅ All files uploaded successfully!"
fi
