# Quick Fix Guide: Cache 404 Error in Production

## Problem
Transactions fail with "Invalid_proof (In progress)" because cache files return 404 in production.

## Root Cause  
Cache files are **1.3GB total** but Vercel free plan only allows **100MB** deployment size.

## Immediate Solution (Choose One)

### Option 1: Use GitHub Releases (Recommended - Free & Easy)

1. **Install GitHub CLI** (if not installed):
   ```bash
   # macOS
   brew install gh
   
   # Linux
   curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | sudo dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg
   echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" | sudo tee /etc/apt/sources.list.d/github-cli.list > /dev/null
   sudo apt update
   sudo apt install gh
   ```

2. **Login to GitHub**:
   ```bash
   gh auth login
   ```

3. **Edit the upload script** with your GitHub username:
   ```bash
   cd /home/surya/Code/Mina/MinaID/ui
   nano scripts/upload-cache-to-github.sh
   # Change line 7: REPO_OWNER="your-github-username" to your actual username
   ```

4. **Run the upload script**:
   ```bash
   cd /home/surya/Code/Mina/MinaID/ui
   ./scripts/upload-cache-to-github.sh
   ```

5. **Set environment variable in Vercel**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Add: `NEXT_PUBLIC_CACHE_URL`
   - Value: `https://github.com/YOUR-USERNAME/MinaID/releases/download/v1.0.0-cache`
   - Apply to: Production, Preview, and Development

6. **Redeploy**:
   ```bash
   git commit --allow-empty -m "Trigger Vercel redeploy with external cache"
   git push
   ```

### Option 2: Reduce Deployment Size (Temporary Fix)

Remove large proving keys from git (keep verification keys only):

```bash
cd /home/surya/Code/Mina/MinaID/ui

# Add proving keys to gitignore
cat >> .gitignore << 'EOF'

# Large cache files (served from external CDN)
public/cache/step-pk-*
public/cache/wrap-pk-*
public/cache/srs-fp-65536
public/cache/srs-fq-32768
public/cache/lagrange-basis-fp-16384
public/cache/lagrange-basis-fq-16384
EOF

# Remove from git
git rm --cached public/cache/step-pk-* public/cache/wrap-pk-* \
  public/cache/srs-fp-65536 public/cache/srs-fq-32768 \
  public/cache/lagrange-basis-fp-16384 public/cache/lagrange-basis-fq-16384

git commit -m "Remove large cache files from deployment"
git push
```

**Note:** This will make proof generation slower (90+ seconds) until you set up external cache hosting.

### Option 3: Upgrade Vercel Plan

Upgrade to **Vercel Pro** ($20/month) which allows **500MB** deployments.
The cache is 1.3GB so you'd need to:
1. Upgrade to Pro
2. Remove some proving keys OR
3. Still use external hosting for very large files

## Verification Steps

1. **Test cache access**:
   Visit: `https://your-app.vercel.app/test-cache-api`
   All files should show status 200.

2. **Test proof generation**:
   - Generate a proof in the UI
   - Should complete in <10 seconds (with cache)
   - Submit transaction
   - Should succeed without "Invalid_proof" errors

3. **Check browser console**:
   ```
   [O1JSCacheFromMerkle] Pre-loading all cache files into memory...
   [O1JSCacheFromMerkle] Loading lagrange-basis-fp-1024 from IndexedDB...
   [O1JSCacheFromMerkle] ✅ Loaded 75 files (0 downloads, 75 from cache)
   [ContractInterface] ✅ All contracts compiled successfully with cached keys
   ```

## Files Sizes Reference

```
Total: 1.3GB
├── step-pk-didregistry-registerdid: 139MB
├── step-pk-didregistry-registerdidsimple: 114MB  
├── step-pk-age-verification-composeageproofs: 112MB
├── step-pk-age-verification-proveageaboveminimum: 68MB
├── step-pk-age-verification-proveageinrange: 68MB
├── srs-fp-65536: 11MB
├── srs-fq-32768: 5.5MB
├── lagrange-basis-fp-16384: 3MB
├── lagrange-basis-fq-16384: 3MB
└── ... (other smaller files)
```

## What Each File Does

- **step-pk-\***: Proving keys (needed to create proofs) - LARGE
- **step-vk-\***: Verification keys (needed to verify proofs) - small (8KB each)
- **wrap-pk-\***: Wrapper proving keys - LARGE  
- **wrap-vk-\***: Wrapper verification keys - small
- **srs-\***: Structured Reference String (cryptographic parameters) - LARGE
- **lagrange-basis-\***: Polynomial basis for FFT - LARGE
- **.header**: Metadata files (24 bytes each) - tiny

## Performance Impact

| Scenario | Cache Size | Compilation Time |
|----------|------------|------------------|
| Full cache (1.3GB) | 1.3GB | 3-5 seconds |
| Verification keys only (1MB) | 1MB | 90-120 seconds |
| No cache | 0 | 90-120 seconds |

## Recommended Setup

**Development:**
- Keep full cache locally in `public/cache/`
- Fast compilation (3-5 seconds)

**Production:**
- Host cache on GitHub Releases (free, unlimited bandwidth)
- Set `NEXT_PUBLIC_CACHE_URL` environment variable
- Same performance as local cache

## Troubleshooting

### Cache files still return 404
- Check `NEXT_PUBLIC_CACHE_URL` is set correctly
- Verify GitHub Release is public
- Test direct URL: `$NEXT_PUBLIC_CACHE_URL/lagrange-basis-fp-1024`

### Compilation still slow
- Check browser console for cache loading errors
- Verify IndexedDB is enabled (not in incognito mode)
- Clear IndexedDB and reload page

### "Invalid_proof (In progress)" error persists
- Ensure `tx.prove()` completes before sending transaction
- Check browser console for proving errors
- Verify wallet connection is stable

## Support

If issues persist:
1. Check browser console logs
2. Visit `/test-cache-api` to diagnose
3. Check Vercel build logs for deployment errors
