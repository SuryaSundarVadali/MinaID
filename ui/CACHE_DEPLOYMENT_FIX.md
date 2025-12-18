# Cache Deployment Fix for Production

## Problem

The cache files in `public/cache/` are **1.3GB total**, which exceeds Vercel's deployment size limits:
- **Free plan**: 100MB total deployment size
- **Pro plan**: 500MB total deployment size  
- **Enterprise plan**: Custom limits

Result: Cache files return 404 in production, causing:
- Contract compilation takes 92+ seconds (without cache)
- Transactions fail with "Invalid_proof (In progress)" error
- Users cannot submit proofs successfully

## Solution: External Cache Hosting

### Step 1: Host Cache Files Separately

Cache files need to be hosted on:
- **CDN** (Cloudflare R2, AWS S3, etc.)
- **GitHub Releases** (free, 2GB limit per file)
- **External server** with proper CORS headers

### Step 2: Update Environment Variable

Set `NEXT_PUBLIC_CACHE_URL` to point to external cache:

```env
NEXT_PUBLIC_CACHE_URL=https://your-cdn.com/mina-zkp-cache
# or
NEXT_PUBLIC_CACHE_URL=https://github.com/username/repo/releases/download/v1.0.0
```

### Step 3: Deploy Cache Files

#### Option A: GitHub Releases (Recommended - Free)

1. Create a GitHub release:
```bash
cd /home/surya/Code/Mina/MinaID
git tag v1.0.0-cache
git push origin v1.0.0-cache
```

2. Upload cache files to release:
   - Go to GitHub → Releases → Create new release
   - Tag: `v1.0.0-cache`
   - Upload files from `ui/public/cache/`
   - Publish release

3. Update `.env.local`:
```env
NEXT_PUBLIC_CACHE_URL=https://github.com/username/MinaID/releases/download/v1.0.0-cache
```

#### Option B: Cloudflare R2 (10GB free)

1. Create R2 bucket:
   - Go to Cloudflare Dashboard
   - R2 → Create bucket → `mina-zkp-cache`

2. Upload files:
```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Upload cache
cd ui/public/cache
for file in *; do
  wrangler r2 object put mina-zkp-cache/$file --file $file
done
```

3. Configure CORS:
```json
{
  "AllowedOrigins": ["*"],
  "AllowedMethods": ["GET"],
  "AllowedHeaders": ["*"],
  "MaxAgeSeconds": 31536000
}
```

4. Get public URL and update `.env.local`:
```env
NEXT_PUBLIC_CACHE_URL=https://pub-xxxxx.r2.dev
```

#### Option C: AWS S3

1. Create S3 bucket with public read access
2. Upload cache files
3. Configure CORS policy
4. Update environment variable with CloudFront/S3 URL

### Step 4: Update API Route (Already Compatible)

The current API route at `/api/cache/[...path]/route.ts` falls back to remote fetching if local files don't exist. No changes needed.

### Step 5: Verify Deployment

After deploying with external cache URL:

1. Visit: `https://your-app.vercel.app/test-cache-api`
2. All files should return status 200
3. Contract compilation should complete in <5 seconds

## Alternative: Remove Cache from Deployment

If you cannot host externally, remove cache from git:

```bash
cd ui
echo "public/cache/*.pk*" >> .gitignore
echo "public/cache/srs-*" >> .gitignore
echo "public/cache/lagrange-*" >> .gitignore

git rm --cached public/cache/step-pk-*
git rm --cached public/cache/wrap-pk-*
git rm --cached public/cache/srs-*
git rm --cached public/cache/lagrange-*
git commit -m "Remove large cache files from repo"
```

Keep only verification keys (small files):
- `step-vk-*` and `wrap-vk-*` (a few KB each)
- `.header` files (24 bytes each)

The code will fallback to downloading from `NEXT_PUBLIC_CACHE_URL` or compile locally.

## Testing

Test cache access in production:
```bash
curl -I https://your-app.vercel.app/api/cache/lagrange-basis-fp-1024
# Should return 200 OK with Content-Length header
```

Test with external cache:
```bash
NEXT_PUBLIC_CACHE_URL=https://github.com/.../releases/download/v1.0.0-cache npm run dev
```

Visit `/test-cache-api` to verify all files are accessible.

## Current Status

✅ Local cache works (files in `public/cache/`)  
✅ API route handles cache serving  
✅ Code supports external cache via `NEXT_PUBLIC_CACHE_URL`  
❌ Cache files exceed Vercel deployment limit (1.3GB > 100MB)  
❌ Cache returns 404 in production (files not deployed)  

## Next Steps

1. Choose hosting option (GitHub Releases recommended)
2. Upload cache files to external host
3. Set `NEXT_PUBLIC_CACHE_URL` environment variable in Vercel
4. Redeploy application
5. Test with `/test-cache-api` page
6. Verify proof submission works without errors
