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
 * Hybrid approach: Use MerkleCache to fetch files, then create lazy-loading cache
 * Downloads files on-demand when o1js requests them (NOT preloaded to avoid memory issues)
 */
export async function createO1JSCacheFromMerkle(merkleCache: MerkleCache): Promise<Cache> {
  const manifest = merkleCache.getManifest();
  if (!manifest) {
    throw new Error('Manifest not loaded');
  }

  // GitHub Release CDN URLs support CORS!
  // We use release-assets.githubusercontent.com which is CORS-enabled
  // These are resolved by following GitHub's redirects
  const isProduction = typeof window !== 'undefined' && !window.location.hostname.includes('localhost');
  
  // Helper to resolve GitHub release URL to CORS-enabled CDN URL
  const resolveGitHubCDNUrl = async (githubUrl: string): Promise<string> => {
    try {
      const response = await fetch(githubUrl, { 
        method: 'HEAD',
        redirect: 'manual' // Don't auto-follow, get the redirect URL
      });
      const location = response.headers.get('location');
      if (location) {
        console.log(`[O1JSCache] Resolved CDN URL for ${githubUrl.split('/').pop()}`);
        return location;
      }
      // Fallback to original URL if no redirect
      return githubUrl;
    } catch (error) {
      console.warn(`[O1JSCache] Failed to resolve CDN URL, using original:`, error);
      return githubUrl;
    }
  };
  
  const GITHUB_RELEASES_BASE = 'https://github.com/SuryaSundarVadali/MinaID/releases/download/v1.0.0-cache';
  const LOCAL_API_URL = typeof window !== 'undefined' 
    ? `${window.location.origin}/api/cache` 
    : 'http://localhost:3000/api/cache';
  
  // In production, we'll resolve CDN URLs on-the-fly for each file
  const USE_CDN_RESOLUTION = isProduction;
  
  console.log('[O1JSCache] Cache source:', isProduction ? 'GitHub CDN (CORS-enabled)' : 'Local API');
  console.log('[O1JSCache] Using lazy loading (files loaded on-demand, not preloaded)');
  
  // In-memory cache for loaded files (loaded on first read)
  const loadedFiles: Record<string, { header: string; data: string }> = {};
  
  // Helper to load a file on-demand
  const loadFileOnDemand = async (fileId: string): Promise<{ header: string; data: string } | null> => {
    // Check if already loaded in memory
    if (loadedFiles[fileId]) {
      console.log(`[O1JSCache] Cache hit (memory): ${fileId}`);
      return loadedFiles[fileId];
    }

    console.log(`[O1JSCache] Loading on-demand: ${fileId}`);
    
    // Proving keys are never stored in IndexedDB (memory-only to save quota)
    const isProvingKey = fileId.includes('step-pk-') || fileId.includes('wrap-pk-');
    
    // Try to get from MerkleCache (IndexedDB) only if NOT a proving key
    let dataFile = isProvingKey ? null : await merkleCache.getFile(fileId);
    let headerFile = isProvingKey ? null : await merkleCache.getFile(`${fileId}.header`);

    // If not in cache, download from cache source
    if (!dataFile || !headerFile) {
      console.log(`[O1JSCache] Downloading ${fileId} from remote...`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 90000); // 90s for large proving keys

        // Resolve CDN URLs dynamically if in production
        // This converts GitHub releases URLs to CORS-enabled CDN URLs
        const dataUrl = USE_CDN_RESOLUTION 
          ? await resolveGitHubCDNUrl(`${GITHUB_RELEASES_BASE}/${fileId}`)
          : `${LOCAL_API_URL}/${fileId}`;
        const headerUrl = USE_CDN_RESOLUTION
          ? await resolveGitHubCDNUrl(`${GITHUB_RELEASES_BASE}/${fileId}.header`)
          : `${LOCAL_API_URL}/${fileId}.header`;

        const [dataResponse, headerResponse] = await Promise.all([
          fetch(dataUrl, { 
            signal: controller.signal,
            redirect: 'follow', // Follow any additional redirects
            cache: 'force-cache' // Use browser cache if available
          }),
          fetch(headerUrl, { 
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
              console.log(`[O1JSCache] ${fileId}: ${progress}% (${(dataSize / 1024 / 1024).toFixed(1)} MB)`);
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
          if (!isProvingKey) {
            try {
              await merkleCache.storeFile(fileId, dataFile);
              await merkleCache.storeFileRaw(`${fileId}.header`, headerFile);
              console.log(`[O1JSCache] ✅ Cached ${fileId} in IndexedDB (${Math.round(dataFile.length / 1024 / 1024)}MB)`);
            } catch (storeError) {
              console.warn(`[O1JSCache] Failed to cache ${fileId} in IndexedDB:`, storeError);
            }
          } else {
            console.log(`[O1JSCache] ✅ Loaded ${fileId} (memory only, ${Math.round(dataFile.length / 1024 / 1024)}MB)`);
          }
        } else {
          console.error(`[O1JSCache] HTTP error for ${fileId}: ${dataResponse.status}/${headerResponse.status}`);
          return null;
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.warn(`[O1JSCache] ⏱️ Timeout downloading ${fileId}`);
        } else {
          console.error(`[O1JSCache] Failed to download ${fileId}:`, error);
        }
        return null;
      }
    } else {
      console.log(`[O1JSCache] Cache hit (IndexedDB): ${fileId}`);
    }

    if (dataFile && headerFile) {
      // Convert Uint8Array to string for BrowserCache compatibility
      const dataStr = new TextDecoder().decode(dataFile);
      const headerStr = new TextDecoder().decode(headerFile).trim();

      // Cache in memory for future reads
      loadedFiles[fileId] = {
        header: headerStr,
        data: dataStr,
      };
      
      return loadedFiles[fileId];
    }

    return null;
  };

  
  // Create o1js-compatible Cache object with lazy loading
  // NOTE: o1js Cache.read() is synchronous, so we pre-load ONLY headers (tiny)
  // and load data files on-demand before compilation starts
  return {
    read({ persistentId, uniqueId, dataType }: { 
      persistentId: string; 
      uniqueId: string; 
      dataType: 'string' | 'bytes' 
    }): Uint8Array | undefined {
      const file = loadedFiles[persistentId];
      
      if (!file) {
        console.log(`[O1JSCache] Cache miss: ${persistentId} (not loaded yet - will compile instead)`);
        return undefined;
      }

      if (file.header !== uniqueId) {
        console.log(`[O1JSCache] Version mismatch for ${persistentId} (expected: ${uniqueId}, got: ${file.header})`);
        return undefined;
      }

      console.log(`[O1JSCache] Cache hit: ${persistentId}`);
      
      if (dataType === 'string') {
        return new TextEncoder().encode(file.data);
      }

      // Handle bytes
      const str = file.data;
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
    
    // Custom method to preload specific files before compilation
    async preloadFiles(fileIds: string[]): Promise<void> {
      console.log(`[O1JSCache] Preloading ${fileIds.length} files for compilation...`);
      const results = await Promise.all(
        fileIds.map(fileId => loadFileOnDemand(fileId))
      );
      const loaded = results.filter(r => r !== null).length;
      console.log(`[O1JSCache] ✅ Preloaded ${loaded}/${fileIds.length} files`);
    }
  } as Cache & { preloadFiles: (fileIds: string[]) => Promise<void> };
}
