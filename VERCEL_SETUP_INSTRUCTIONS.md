# Vercel Environment Variable Setup

## After Upload Completes

Once the GitHub upload finishes, follow these steps:

### 1. Set Environment Variable in Vercel

**Method A: Via Vercel Dashboard (Recommended)**

1. Go to: https://vercel.com/suryasundarvadalis-projects/mina-id/settings/environment-variables
2. Click "Add New" button
3. Fill in:
   - **Key**: `NEXT_PUBLIC_CACHE_URL`
   - **Value**: `https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache`
   - **Environments**: Check all three boxes (Production, Preview, Development)
4. Click "Save"

**Method B: Via Vercel CLI**

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# Set environment variable
vercel env add NEXT_PUBLIC_CACHE_URL production
# When prompted, enter: https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache

vercel env add NEXT_PUBLIC_CACHE_URL preview
# Enter same value

vercel env add NEXT_PUBLIC_CACHE_URL development
# Enter same value
```

### 2. Trigger Redeploy

**Option A: Push empty commit**
```bash
cd /home/surya/Code/Mina/MinaID
git commit --allow-empty -m "Add external cache URL"
git push
```

**Option B: Redeploy from Vercel Dashboard**
1. Go to: https://vercel.com/suryasundarvadalis-projects/mina-id
2. Click on latest deployment
3. Click "⋯" (three dots) → "Redeploy"

### 3. Verify Deployment

After deployment completes (~5 minutes):

1. **Check cache access**:
   - Visit: https://mina-id-suryasundarvadalis-projects.vercel.app/test-cache-api
   - All files should show **Status: 200** (green)

2. **Test direct cache URL**:
   ```bash
   curl -I https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache/lagrange-basis-fp-1024
   # Should return: HTTP/2 200
   ```

3. **Check browser console**:
   - Open your app in browser
   - Open DevTools → Console
   - Look for:
     ```
     [O1JSCacheFromMerkle] Cache URL: https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache
     [O1JSCacheFromMerkle] Loading lagrange-basis-fp-1024 from IndexedDB...
     [O1JSCacheFromMerkle] ✅ Loaded 91 files
     ```

4. **Test proof generation**:
   - Generate a test proof
   - Should complete in 5-15 seconds (first time, downloading cache)
   - Subsequent proofs: 3-5 seconds (from IndexedDB)

### 4. Monitor Upload Progress

Check the upload log:
```bash
tail -f /tmp/cache-upload.log
```

Or check GitHub release page:
https://github.com/SuryaSundarVadali/MinaID/releases/tag/v1.0.0-cache

### Expected Timeline

- **Upload time**: 10-30 minutes (depending on internet speed)
- **Vercel redeploy**: ~5 minutes
- **Total**: ~15-35 minutes

### Troubleshooting

**If upload is taking too long:**
- Upload is working in background, be patient
- Large files (100MB+) take time
- Check progress: `tail -f /tmp/cache-upload.log`

**If some files fail to upload:**
- Re-run the script (it skips already uploaded files)
- Or manually upload failed files via GitHub web UI

**If test-cache-api still shows 404:**
- Verify environment variable is set correctly
- Check you've redeployed after setting the variable
- Clear browser cache and reload

**If compilation is still slow:**
- Check browser console for cache loading errors
- Verify IndexedDB is enabled (not in incognito mode)
- Try clearing IndexedDB and reloading page

## Quick Commands

```bash
# Check upload progress
tail -f /tmp/cache-upload.log

# Check GitHub release
open https://github.com/SuryaSundarVadali/MinaID/releases/tag/v1.0.0-cache

# Test cache URL directly
curl -I https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache/lagrange-basis-fp-1024

# Trigger redeploy
cd /home/surya/Code/Mina/MinaID
git commit --allow-empty -m "Use external cache"
git push

# Check Vercel deployment
open https://vercel.com/suryasundarvadalis-projects/mina-id
```

## Cache URL Format

The environment variable should be exactly:
```
NEXT_PUBLIC_CACHE_URL=https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache
```

**Note:** Do NOT include trailing slash or filename. The code will append filenames automatically.

## Success Indicators

✅ GitHub release shows all 91 files  
✅ Environment variable set in Vercel  
✅ Application redeployed  
✅ test-cache-api shows all 200 OK responses  
✅ Proof generation completes in <15 seconds  
✅ Transactions succeed without "Invalid_proof" errors
