# Cache Directory

This directory contains pre-compiled ZK circuit cache files that are:

1. **Generated** during contract build (`contracts/scripts/generate-cache.js`)
2. **Copied** from `contracts/cache/` to here during build (`contracts/scripts/copy-cache-to-ui.js`)
3. **Served** via `/api/cache/` route at runtime
4. **NOT committed** to git (too large, generated files)

## Files

- `step-pk-*` - Proving keys for circuit methods (large, 100MB+)
- `step-vk-*` - Verification keys for circuit methods (small, KB)
- `*.header` - Header files for cache validation

## Build Process

```bash
# In contracts/
npm run build          # Compiles TypeScript
npm run generate-cache # Generates cache files
npm run copy-cache     # Copies to ui/public/cache/

# Or run all at once from ui/
npm run build:all      # Builds contracts (with cache copy) then UI
```

## Vercel Deployment

The `vercel.json` configuration runs `build:all` which ensures cache files are present before the UI build.

## Session Management

Cache files are NOT in git due to size (114MB+ for some files). They are:
- Generated fresh on each build
- Served from `public/cache/` via Next.js API route
- Cached by browsers for 1 year (immutable)
- Re-generated only when contracts change
