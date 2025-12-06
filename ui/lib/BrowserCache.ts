/**
 * BrowserCache.ts
 * 
 * Browser-compatible cache implementation for o1js prover keys.
 * Fetches cached files from /cache/ directory and provides them to o1js compile.
 * 
 * This is essential for ensuring browser-compiled contracts use the SAME
 * verification keys as the deployed on-chain contracts.
 */

import { Cache } from 'o1js';

// Import cache file list
import cacheJSONList from '../app/cache.json';

interface CacheFile {
  file: string;
  header: string;
  data: string;
}

interface CacheFiles {
  [key: string]: CacheFile;
}

/**
 * Fetch all cache files from the /cache/ directory
 * These files contain the pre-computed prover keys that match the deployed contracts
 */
export async function fetchCacheFiles(): Promise<CacheFiles> {
  console.log('[BrowserCache] Fetching cache files...');
  console.log('[BrowserCache] Cache list:', cacheJSONList.files.length, 'files');
  
  const cacheListPromises = cacheJSONList.files.map(async (file: string) => {
    try {
      const [header, data] = await Promise.all([
        fetch(`/cache/${file}.header`).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch ${file}.header: ${res.status}`);
          return res.text();
        }),
        fetch(`/cache/${file}`).then((res) => {
          if (!res.ok) throw new Error(`Failed to fetch ${file}: ${res.status}`);
          return res.text();
        }),
      ]);
      return { file, header, data };
    } catch (error) {
      console.warn(`[BrowserCache] Failed to fetch cache file ${file}:`, error);
      return null;
    }
  });

  const cacheList = await Promise.all(cacheListPromises);
  
  // Filter out failed fetches and build the cache object
  const validCacheList = cacheList.filter((item): item is CacheFile => item !== null);
  console.log('[BrowserCache] Successfully fetched', validCacheList.length, 'of', cacheJSONList.files.length, 'files');

  return validCacheList.reduce((acc: CacheFiles, { file, header, data }) => {
    acc[file] = { file, header, data };
    return acc;
  }, {});
}

/**
 * Create a browser-compatible FileSystem cache from fetched files
 * This implements the o1js Cache interface for use in compile()
 */
export function createBrowserCache(files: CacheFiles): Cache {
  return {
    read({ persistentId, uniqueId, dataType }: { persistentId: string; uniqueId: string; dataType: 'string' | 'bytes' }) {
      // Check if this file exists in our cache
      if (!files[persistentId]) {
        console.log('[BrowserCache] Cache miss:', persistentId);
        return undefined;
      }

      // Verify the uniqueId matches (ensures cache validity)
      const currentId = files[persistentId].header;
      if (currentId !== uniqueId) {
        console.log('[BrowserCache] Cache version mismatch for', persistentId);
        console.log('[BrowserCache]   Expected:', uniqueId);
        console.log('[BrowserCache]   Got:', currentId);
        return undefined;
      }

      // Return the cached data
      if (dataType === 'string') {
        console.log('[BrowserCache] Cache hit:', persistentId);
        return new TextEncoder().encode(files[persistentId].data);
      }
      
      // For binary data, we need to handle differently
      // Most cache files are strings, but handle bytes case
      console.log('[BrowserCache] Cache hit (bytes):', persistentId);
      const str = files[persistentId].data;
      const bytes = new Uint8Array(str.length);
      for (let i = 0; i < str.length; i++) {
        bytes[i] = str.charCodeAt(i);
      }
      return bytes;
    },

    write({ persistentId, uniqueId, dataType }: { persistentId: string; uniqueId: string; dataType: 'string' | 'bytes' }, data: Uint8Array) {
      // Browser cache is read-only - we don't write back
      console.log('[BrowserCache] Write ignored (read-only):', persistentId);
    },

    canWrite: false,
  };
}

/**
 * Combined helper to fetch files and create cache
 */
export async function initializeBrowserCache(): Promise<Cache> {
  const files = await fetchCacheFiles();
  return createBrowserCache(files);
}
