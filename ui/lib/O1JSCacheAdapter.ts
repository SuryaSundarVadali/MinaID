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
 */
export async function createO1JSCacheFromMerkle(merkleCache: MerkleCache): Promise<Cache> {
  const manifest = merkleCache.getManifest();
  if (!manifest) {
    throw new Error('Manifest not loaded');
  }

  console.log('[O1JSCacheFromMerkle] Pre-loading all cache files into memory...');
  
  // Load all files into memory (o1js needs sync access)
  const files: Record<string, { file: string; header: string; data: string }> = {};
  const fileIds = Object.keys(manifest.files);

  let loaded = 0;
  for (const fileId of fileIds) {
    // Skip .header files, we'll load them with their base files
    if (fileId.endsWith('.header')) continue;

    const [dataFile, headerFile] = await Promise.all([
      merkleCache.getFile(fileId),
      merkleCache.getFile(`${fileId}.header`),
    ]);

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

      if (loaded % 5 === 0) {
        console.log(`[O1JSCacheFromMerkle] Loaded ${loaded}/${fileIds.length / 2} files...`);
      }
    }
  }

  console.log(`[O1JSCacheFromMerkle] ✅ Loaded ${loaded} files into memory`);

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
