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

  // GitHub Release assets are public and CORS-friendly!
  // In production: download directly from GitHub (faster, no proxy overhead)
  // In development: use local API route (serves from public/cache/)
  const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
  
  const GITHUB_RELEASES_URL = 'https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache';
  const LOCAL_API_URL = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/cache` 
    : 'http://localhost:3000/api/cache';
  
  const CACHE_BASE_URL = isProduction ? GITHUB_RELEASES_URL : LOCAL_API_URL;
  
  console.log('[O1JSCacheFromMerkle] Cache source:', isProduction ? 'GitHub Releases (direct)' : 'Local API');

  console.log('[O1JSCacheFromMerkle] Pre-loading all cache files into memory...');
  console.log('[O1JSCacheFromMerkle] Cache URL:', CACHE_BASE_URL);
  
  // Load all files into memory (o1js needs sync access)
  const files: Record<string, { file: string; header: string; data: string }> = {};
  const fileIds = Object.keys(manifest.files);
  const baseFileIds = fileIds.filter((id: string) => !id.endsWith('.header'));

  let loaded = 0;
  let downloaded = 0;
  let inMemoryOnly = 0;
  let inIndexedDB = 0;
  const batchSize = 3; // Optimal: 3-4 parallel downloads (avoid browser throttling)

  // Process in batches for optimal throughput
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

      // If not in cache, download from cache source
      if (!dataFile || !headerFile) {
        console.log(`[O1JSCacheFromMerkle] Downloading ${fileId} from cache...`);
        
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s for large proving keys

          // Fetch from cache URL with streaming
          // GitHub Releases: Direct download (302 redirect to CDN, automatically followed)
          // Local API: Serves from public/cache/
          const [dataResponse, headerResponse] = await Promise.all([
            fetch(`${CACHE_BASE_URL}/${fileId}`, { 
              signal: controller.signal,
              redirect: 'follow', // Explicitly follow redirects (default behavior)
              cache: 'force-cache' // Use browser cache if available
            }),
            fetch(`${CACHE_BASE_URL}/${fileId}.header`, { 
              signal: controller.signal,
              redirect: 'follow',
              cache: 'force-cache'
            }),
          ]);

          clearTimeout(timeoutId);

          if (dataResponse.ok && headerResponse.ok) {
            // Stream download with chunking for large files
            const contentLength = parseInt(dataResponse.headers.get('content-length') || '0');
            const dataReader = dataResponse.body?.getReader();
            
            if (!dataReader) {
              throw new Error(`No readable stream for ${fileId}`);
            }

            const dataChunks: Uint8Array[] = [];
            let dataSize = 0;
            
            // Stream data file
            while (true) {
              const { done, value } = await dataReader.read();
              if (done) break;
              
              dataChunks.push(value);
              dataSize += value.byteLength;
              
              // Progress logging for large files (>10MB)
              if (contentLength > 10 * 1024 * 1024 && dataSize % (5 * 1024 * 1024) < value.byteLength) {
                const progress = ((dataSize / contentLength) * 100).toFixed(0);
                console.log(`[O1JSCacheFromMerkle] ${fileId}: ${progress}% (${(dataSize / 1024 / 1024).toFixed(1)} MB)`);
              }
            }

            // Concatenate chunks
            dataFile = new Uint8Array(dataSize);
            let offset = 0;
            for (const chunk of dataChunks) {
              dataFile.set(chunk, offset);
              offset += chunk.byteLength;
            }
            
            // Header is small, can read directly
            const headerArrayBuffer = await headerResponse.arrayBuffer();
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
