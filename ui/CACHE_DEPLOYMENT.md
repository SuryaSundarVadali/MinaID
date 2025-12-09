# Cache File Deployment for registerDIDSimple

## Problem
The `step-pk-didregistry-registerdidsimple` proving key is 114MB, exceeding GitHub's 100MB limit.

## Solution Options

### Option 1: Use External CDN (Recommended)
Upload cache files to Cloudflare R2, AWS S3, or similar:

```bash
# Upload to your CDN
aws s3 cp contracts/cache/step-pk-didregistry-registerdidsimple s3://your-bucket/cache/
aws s3 cp contracts/cache/step-pk-didregistry-registerdidsimple.header s3://your-bucket/cache/
aws s3 cp contracts/cache/step-vk-didregistry-registerdidsimple s3://your-bucket/cache/
aws s3 cp contracts/cache/step-vk-didregistry-registerdidsimple.header s3://your-bucket/cache/
```

Then update `ui/app/cache.json` to point to CDN URLs.

### Option 2: Generate During Vercel Build
Add to `ui/package.json`:

```json
"scripts": {
  "vercel-build": "npm run generate-cache && next build --no-lint"
}
```

**Caveat**: This requires ~2-3 minutes of build time on Vercel.

### Option 3: Split into Smaller Chunks
Split the 114MB file into <100MB chunks and reassemble on load.

### Option 4: Use Git LFS
```bash
git lfs install
git lfs track "ui/public/cache/step-pk-didregistry-registerdidsimple"
git add .gitattributes
git add ui/public/cache/step-pk-didregistry-registerdidsimple
git commit -m "Add large cache file with LFS"
```

**Caveat**: GitHub LFS has bandwidth limits (1GB/month free).

## Current Workaround
For development, cache files are in `contracts/cache/` and copied locally via `npm run copy-cache`.

For production deployment, you must choose one of the options above.
