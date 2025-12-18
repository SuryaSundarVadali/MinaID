// lib/O1JSCacheAdapter.ts - Adapter to bridge MerkleCache with o1js Cache interface
import { Cache } from 'o1js';
import { MerkleCache } from './MerkleCache';

/**
 * Adapter that implements o1js Cache interface using MerkleCache backend
 * This allows o1js to use IndexedDB-backed Merkle cache for proving keys
 */
export class O1JSCacheAdapter implements Cache {
  private merkleCache: MerkleCache;
  private headerCache: Map<string, string> = new Map(); // persistentId -> uniqueId mapping

  constructor(merkleCache: MerkleCache) {
    this.merkleCache = merkleCache;
  }

  /**
   * Initialize adapter by loading all .header files into memory
   * Headers are small (just uniqueId strings), so we can cache them
   */
  async initialize(): Promise<void> {
    const manifest = this.merkleCache.getManifest();
    if (!manifest) {
      throw new Error('Manifest not loaded');
    }

    // Load all .header files
    const headerPromises = Object.keys(manifest.files)
      .filter(fileId => fileId.endsWith('.header'))
      .map(async (headerId) => {
        const headerData = await this.merkleCache.getFile(headerId);
        if (headerData) {
          // Header file contains the uniqueId (version string)
          const uniqueId = new TextDecoder().decode(headerData).trim();
          // Remove .header suffix to get persistentId
          const persistentId = headerId.replace('.header', '');
          this.headerCache.set(persistentId, uniqueId);
        }
      });

    await Promise.all(headerPromises);
    console.log(`[O1JSCacheAdapter] Loaded ${this.headerCache.size} header files`);
  }

  /**
   * Read cache entry - called by o1js during compilation
   */
  read({ persistentId, uniqueId, dataType }: { 
    persistentId: string; 
    uniqueId: string; 
    dataType: 'string' | 'bytes' 
  }): Uint8Array | undefined {
    // Check if header exists and matches
    const cachedUniqueId = this.headerCache.get(persistentId);
    if (!cachedUniqueId) {
      console.log(`[O1JSCacheAdapter] Cache miss (no header): ${persistentId}`);
      return undefined;
    }

    if (cachedUniqueId !== uniqueId) {
      console.log(`[O1JSCacheAdapter] Version mismatch for ${persistentId}`);
      console.log(`  Expected: ${uniqueId}`);
      console.log(`  Got: ${cachedUniqueId}`);
      return undefined;
    }

    // Note: This is called synchronously by o1js, but MerkleCache.getFile is async
    // We need to pre-load files before compile() is called
    // For now, return undefined and rely on the async preloadForCache() method
    console.warn(`[O1JSCacheAdapter] Sync read not supported: ${persistentId}`);
    console.warn(`[O1JSCacheAdapter] Use preloadForCache() before compile()`);
    return undefined;
  }

  /**
   * Write cache entry - no-op for browser
   */
  write(
    { persistentId, uniqueId, dataType }: { 
      persistentId: string; 
      uniqueId: string; 
      dataType: 'string' | 'bytes' 
    }, 
    data: Uint8Array
  ): void {
    // Browser cache is read-only
    console.log(`[O1JSCacheAdapter] Write ignored (read-only): ${persistentId}`);
  }

  canWrite = false;
}

/**
 * CRITICAL: o1js Cache.read() is SYNCHRONOUS, but IndexedDB is ASYNC
 * 
 * This is a fundamental incompatibility. Solutions:
 * 
 * 1. Pre-load all files into memory before compile() (CURRENT APPROACH via BrowserCache)
 * 2. Use a synchronous storage (not possible in browser)
 * 3. Patch o1js to support async Cache.read() (not feasible)
 * 
 * RECOMMENDED: Keep using BrowserCache (memory cache) but populate it from MerkleCache
 */

/**
 * Hybrid approach: Use MerkleCache to fetch files, then create in-memory BrowserCache
 * Downloads missing files from /api/cache if not in IndexedDB
 */
export async function createO1JSCacheFromMerkle(merkleCache: MerkleCache): Promise<Cache> {
  const manifest = merkleCache.getManifest();
  if (!manifest) {
    throw new Error('Manifest not loaded');
  }

  // Get cache URL from environment or default to localhost
  // If NEXT_PUBLIC_CACHE_URL is set (e.g., GitHub Releases), use it directly
  // Otherwise, use local API route
  const externalCacheUrl = process.env.NEXT_PUBLIC_CACHE_URL;
  const useExternalCache = externalCacheUrl && typeof window !== 'undefined';
  
  const CACHE_BASE_URL = useExternalCache 
    ? externalCacheUrl 
    : (typeof window !== 'undefined' ? `${window.location.origin}/api/cache` : 'http://localhost:3000/api/cache');

  console.log('[O1JSCacheFromMerkle] Pre-loading all cache files into memory...');
  console.log('[O1JSCacheFromMerkle] Cache URL:', CACHE_BASE_URL);
  console.log('[O1JSCacheFromMerkle] External cache:', useExternalCache ? 'Yes' : 'No (using API route)');
  
  // Load all files into memory (o1js needs sync access)
  const files: Record<string, { file: string; header: string; data: string }> = {};
  const fileIds = Object.keys(manifest.files);
  const baseFileIds = fileIds.filter((id: string) => !id.endsWith('.header'));

  let loaded = 0;
  let downloaded = 0;
  let inMemoryOnly = 0;
  let inIndexedDB = 0;
  const batchSize = 5; // Download 5 files at a time

  // Process in batches to avoid overwhelming the browser
  for (let batchStart = 0; batchStart < baseFileIds.length; batchStart += batchSize) {
    const batchEnd = Math.min(batchStart + batchSize, baseFileIds.length);
    const batch = baseFileIds.slice(batchStart, batchEnd);
    
    console.log(`[O1JSCacheFromMerkle] Processing batch ${Math.floor(batchStart / batchSize) + 1}/${Math.ceil(baseFileIds.length / batchSize)}...`);

    await Promise.all(batch.map(async (fileId: string) => {
      // Proving keys are never stored in IndexedDB (memory-only to save quota)
      const isProvingKey = fileId.includes('step-pk-') || fileId.includes('wrap-pk-');
      
      // Try to get from MerkleCache (IndexedDB) only if NOT a proving key
      let dataFile = isProvingKey ? null : await merkleCache.getFile(fileId);
      let headerFile = isProvingKey ? null : await merkleCache.getFile(`${fileId}.header`);

      // If not in cache, download from external URL (GitHub) or local API
      if (!dataFile || !headerFile) {
        console.log(`[O1JSCacheFromMerkle] Downloading ${fileId} from ${useExternalCache ? 'GitHub' : 'local API'}...`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout for large files

          // Fetch directly from cache URL (no /api/cache prefix for external URLs)
          const [dataResponse, headerResponse] = await Promise.all([
            fetch(`${CACHE_BASE_URL}/${fileId}`, { signal: controller.signal }),
            fetch(`${CACHE_BASE_URL}/${fileId}.header`, { signal: controller.signal }),
          ]);

          clearTimeout(timeoutId);

          if (dataResponse.ok && headerResponse.ok) {
            const dataArrayBuffer = await dataResponse.arrayBuffer();
            const headerArrayBuffer = await headerResponse.arrayBuffer();
            
            dataFile = new Uint8Array(dataArrayBuffer);
            headerFile = new Uint8Array(headerArrayBuffer);

            // Store in MerkleCache ONLY if it's a small file (verification keys, lagrange basis, srs)
            // Proving keys (step-pk-*, wrap-pk-*) are kept in memory only to avoid IndexedDB quota issues
            const isProvingKey = fileId.includes('step-pk-') || fileId.includes('wrap-pk-');
            
            if (!isProvingKey) {
              try {
                await merkleCache.storeFile(fileId, dataFile);
                await merkleCache.storeFileRaw(`${fileId}.header`, headerFile);
                console.log(`[O1JSCacheFromMerkle] ✅ Cached ${fileId} in IndexedDB`);
                downloaded++;
                inIndexedDB++;
              } catch (storeError) {
                console.warn(`[O1JSCacheFromMerkle] Failed to cache ${fileId}:`, storeError);
              }
            } else {
              console.log(`[O1JSCacheFromMerkle] ✅ Loaded ${fileId} (memory only, ${Math.round(dataFile.length / 1024 / 1024)}MB)`);
              downloaded++;
              inMemoryOnly++;
            }
          } else {
            console.error(`[O1JSCacheFromMerkle] HTTP error for ${fileId}: ${dataResponse.status}/${headerResponse.status}`);
            console.warn(`[O1JSCacheFromMerkle] ⚠️ Failed to download ${fileId}. Fallback to manual compilation.`);
          }
        } catch (error: any) {
          if (error.name === 'AbortError') {
            console.warn(`[O1JSCacheFromMerkle] ⏱️ Timeout downloading ${fileId}`);
          } else if (error.message?.includes('Failed to fetch') || error.message?.includes('ERR_CONNECTION_REFUSED')) {
            console.warn(`[O1JSCacheFromMerkle] 🔌 Cache server unavailable. Compilation will proceed without cache.`);
          } else {
            console.error(`[O1JSCacheFromMerkle] Failed to download ${fileId}:`, error);
          }
          return; // Skip this file - will trigger manual compilation
        }
      }

      if (dataFile && headerFile) {
        // Convert Uint8Array to string for BrowserCache compatibility
        const dataStr = new TextDecoder().decode(dataFile);
        const headerStr = new TextDecoder().decode(headerFile).trim();

        files[fileId] = {
          file: fileId,
          header: headerStr,
          data: dataStr,
        };
        loaded++;
      }
    }));

    console.log(`[O1JSCacheFromMerkle] Progress: ${loaded}/${baseFileIds.length} files loaded`);
  }

  console.log(`[O1JSCacheFromMerkle] ✅ Loaded ${loaded} files (${downloaded} downloaded)`);
  console.log(`[O1JSCacheFromMerkle] 📊 Storage: ${inIndexedDB} in IndexedDB, ${inMemoryOnly} memory-only (proving keys)`);

  // Create o1js-compatible Cache object
  return {
    read({ persistentId, uniqueId, dataType }: { 
      persistentId: string; 
      uniqueId: string; 
      dataType: 'string' | 'bytes' 
    }): Uint8Array | undefined {
      if (!files[persistentId]) {
        console.log(`[O1JSCache] Cache miss: ${persistentId}`);
        return undefined;
      }

      if (files[persistentId].header !== uniqueId) {
        console.log(`[O1JSCache] Version mismatch for ${persistentId}`);
        return undefined;
      }

      console.log(`[O1JSCache] Cache hit: ${persistentId}`);
      
      if (dataType === 'string') {
        return new TextEncoder().encode(files[persistentId].data);
      }

      // Handle bytes
      const str = files[persistentId].data;
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i);
      }
      return bytes;
    },

    write({ persistentId }: { persistentId: string }): void {
      console.log(`[O1JSCache] Write ignored: ${persistentId}`);
    },

    canWrite: false,
  };
}
