# Compilation Error Handling Guide

This guide explains how to handle and fix compilation errors in MinaID, based on the improved error handling architecture.

## 🎯 Quick Fixes

### Problem: `ERR_CONNECTION_REFUSED` when loading cache

**Error in console:**
```
GET http://localhost:3000/api/cache/... net::ERR_CONNECTION_REFUSED
```

**Cause:** The cache server is not running or unavailable.

**Solutions:**

1. **For Development:**
   ```bash
   # Make sure your Next.js dev server is running
   cd ui
   npm run dev
   ```

2. **For Production:**
   - Set `NEXT_PUBLIC_CACHE_URL` in `.env.local` to your deployed URL
   - Or deploy cache files to a CDN (recommended)

3. **Fallback Mode:**
   - The app will automatically fall back to manual compilation
   - Takes longer (30-60s) but will work without cache server

### Problem: `Version mismatch` or `not in manifest`

**Error in console:**
```
[O1JSCache] Version mismatch for step-vk-didregistry-registerdid
File wrap-vk-didregistry.header not in manifest
```

**Cause:** You modified contract code but the cached keys are outdated.

**Solution:**

1. **Quick Fix - Use the UI:**
   - Click the "Reset Cache" button when it appears
   - Or use browser DevTools: Application → Storage → Clear Site Data

2. **Manual Fix:**
   ```bash
   # Rebuild contracts to generate fresh keys
   cd contracts
   npm run build
   
   # Copy fresh cache to UI
   npm run copy-cache
   
   # Clear browser cache
   # Open DevTools (F12) → Application → Clear Site Data
   ```

3. **Emergency Reset:**
   - Open browser console and run:
   ```javascript
   indexedDB.deleteDatabase('MinaID_Cache_DB');
   localStorage.clear();
   location.reload();
   ```

### Problem: Out of Memory / Page Crashes

**Symptoms:** White screen, "Aw, Snap!", or frozen browser

**Cause:** ZK circuit compilation is memory-intensive (1-2GB RAM)

**Solutions:**

1. **Immediate:**
   - Close other browser tabs
   - Close other applications
   - Reload the page

2. **Verify COOP/COEP Headers:**
   - Check `next.config.mjs` has headers configured (✅ already done)
   - These enable `SharedArrayBuffer` for better memory efficiency

3. **Browser Settings:**
   - Use Chrome/Brave (best o1js support)
   - Enable hardware acceleration
   - Increase browser memory limit if possible

## 🏗️ Architecture Improvements

### 1. Enhanced Error Handling in ZkappWorker

The worker now catches compilation errors and provides helpful context:

```typescript
async compileDIDRegistry() {
  try {
    await state.DIDRegistryInstance.compile({ cache });
    // Success!
  } catch (error) {
    // Categorize error and provide helpful message
    if (error.message?.includes('version') || error.message?.includes('cache')) {
      throw new Error('Cache version mismatch. Please reset cache and try again.');
    } else if (error.message?.includes('memory')) {
      throw new Error('Out of memory. Close other tabs and reload.');
    }
  }
}
```

### 2. Graceful Cache Fallback

`O1JSCacheAdapter.ts` now handles network failures gracefully:

- **10-second timeout** on fetch requests
- **Informative error messages** categorized by type
- **Silent fallback** to manual compilation when cache unavailable
- **Configurable cache URL** via `NEXT_PUBLIC_CACHE_URL`

```typescript
// Timeout protection
const controller = new AbortController();
setTimeout(() => controller.abort(), 10000);

// Fetch with timeout
const response = await fetch(url, { signal: controller.signal });

// Categorized error handling
catch (error) {
  if (error.name === 'AbortError') {
    console.warn('⏱️ Timeout downloading cache');
  } else if (error.message?.includes('ERR_CONNECTION_REFUSED')) {
    console.warn('🔌 Cache server unavailable. Proceeding with manual compilation.');
  }
}
```

### 3. Cache Reset Component

New `CacheResetButton` component with multiple variants:

**Banner Variant** (auto-shows after 2 failures):
```tsx
<CacheResetButton variant="banner" reason={errorMessage} />
```

**Button Variant** (manual trigger):
```tsx
<CacheResetButton variant="button" onReset={() => console.log('Reset!')} />
```

**Minimal Variant** (inline link):
```tsx
<CacheResetButton variant="minimal" />
```

**Hook for automatic detection:**
```tsx
const { showResetPrompt, recordFailure, resetPrompt } = useCacheReset();

try {
  await compile();
} catch (error) {
  recordFailure(error.message);
}

return (
  <>
    {resetPrompt}
    {/* Your component */}
  </>
);
```

## 🔧 Configuration

### Environment Variables

Create `.env.local` from `.env.example`:

```bash
cp .env.example .env.local
```

Add cache URL configuration:

```env
# Use localhost for development
NEXT_PUBLIC_CACHE_URL=http://localhost:3000

# Use your deployed URL for production
# NEXT_PUBLIC_CACHE_URL=https://minaid.vercel.app

# Or use a CDN for better performance
# NEXT_PUBLIC_CACHE_URL=https://minaid-cache.s3.amazonaws.com
```

### Cache Server Setup

**Option A: Next.js API Route (Current)**
- Cache served from `/api/cache/*`
- Works for development and small deployments
- Limited by server resources

**Option B: Static CDN (Recommended for Production)**
1. Build contracts: `cd contracts && npm run build`
2. Upload `contracts/cache/*` to S3/CloudFlare/etc.
3. Set `NEXT_PUBLIC_CACHE_URL=https://your-cdn.com`
4. Benefits: Parallel downloads, high availability, no server load

## 📊 Error Categories

### Cache-Related Errors
- `version mismatch`
- `cache miss`
- `not in manifest`
- `.header` file issues
- `uniqueId`/`persistentId` errors

**Action:** Reset cache

### Network Errors
- `ERR_CONNECTION_REFUSED`
- `Failed to fetch`
- Timeout errors

**Action:** Check server is running, verify URL

### Memory Errors
- `Out of memory`
- Browser crashes
- `Aw, Snap!`

**Action:** Close tabs, reload, check COOP/COEP headers

### Contract Code Errors
- Syntax errors in contracts
- Invalid ZK constraints
- Type errors

**Action:** Fix contract code, rebuild

## 🚨 Emergency Procedures

### Procedure A: "Nothing Works"

1. Stop all terminals
2. Clear browser cache completely:
   ```javascript
   // Run in browser console
   indexedDB.deleteDatabase('MinaID_Cache_DB');
   localStorage.clear();
   sessionStorage.clear();
   ```
3. Rebuild contracts:
   ```bash
   cd contracts
   rm -rf build cache
   npm run build
   ```
4. Restart dev server:
   ```bash
   cd ui
   npm run dev
   ```
5. Reload browser (hard refresh: Ctrl+Shift+R)

### Procedure B: "Compilation Loops Forever"

1. Check browser console for specific error
2. If cache-related: Use "Reset Cache" button in UI
3. If memory-related: Close other tabs and reload
4. If persistent: Follow Procedure A

### Procedure C: "Cache Server Down"

1. App will automatically fall back to manual compilation
2. Compilation will take 30-60 seconds (normal)
3. Subsequent loads will use browser cache (faster)
4. Optional: Set up CDN for cache files (see Configuration)

## 🎯 Best Practices

### For Development
1. Keep dev server running at all times
2. Use cache reset after modifying contracts
3. Monitor console for cache warnings
4. Close unused tabs to free memory

### For Production
1. Deploy cache files to CDN
2. Set `NEXT_PUBLIC_CACHE_URL` appropriately
3. Monitor user reports of compilation errors
4. Provide clear "Reset Cache" option in UI

### For Users
1. Clear instructions in UI when errors occur
2. Auto-show reset button after multiple failures
3. Progress indicators during compilation
4. Fallback to manual compilation always works

## 📝 Checklist: After Modifying Contracts

- [ ] Rebuild contracts: `npm run build`
- [ ] Copy cache to UI: `npm run copy-cache` (if applicable)
- [ ] Clear browser IndexedDB
- [ ] Clear localStorage
- [ ] Reload application
- [ ] Verify compilation succeeds
- [ ] Check console for warnings

## 🔍 Debugging Tips

**Enable verbose logging:**
```typescript
// In ZkappWorker.ts or your component
console.log('Compilation starting...');
console.log('Cache status:', cache);
console.log('Contract instance:', contractInstance);
```

**Check IndexedDB contents:**
1. Open DevTools → Application → Storage → IndexedDB
2. Look for `MinaID_Cache_DB` or `merkle_cache_db`
3. Inspect stored files and versions

**Monitor network requests:**
1. Open DevTools → Network tab
2. Filter by "cache"
3. Check if cache files are loading (200 OK) or failing (404, 500, ERR)

**Test manual compilation:**
```typescript
// Bypass cache to test compilation
const result = await DIDRegistry.compile(); // No cache parameter
```

## 📚 Related Documentation

- [FRONTEND_IMPROVEMENTS.md](FRONTEND_IMPROVEMENTS.md) - Overall architecture
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Implementation details
- [QUICK_REFERENCE_FRONTEND.md](QUICK_REFERENCE_FRONTEND.md) - Quick code snippets
- [o1js Docs - Caching](https://docs.minaprotocol.com/zkapps/o1js/caching)
