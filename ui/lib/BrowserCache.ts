/**
 * BrowserCache.ts
 * 
 * Browser-compatible cache implementation for o1js prover keys.
 * Fetches cached files via Next.js API route that proxies GitHub releases.
 * 
 * This is essential for ensuring browser-compiled contracts use the SAME
 * verification keys as the deployed on-chain contracts.
 */

import { Cache } from 'o1js';

// Import cache file list
import cacheJSONList from '../app/cache.json';

// Local API proxy URL that handles CORS
const CACHE_PROXY_URL = '/api/cache';

interface CacheFile {
  file: string;
  header: string;
  data: string;
}

interface CacheFiles {
  [key: string]: CacheFile;
}

// In-memory cache to avoid refetching
let memoryCache: CacheFiles | null = null;
let cachePromise: Promise<CacheFiles> | null = null;

/**
 * Fetch a single file with retry logic and no browser caching
 */
async function fetchWithRetry(url: string, retries = 3): Promise<string> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      // Use cache: 'no-store' to bypass browser HTTP cache which causes ERR_CACHE_WRITE_FAILURE
      const response = await fetch(url, { 
        cache: 'no-store',
        headers: {
          'Accept': 'text/plain, application/octet-stream',
        }
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.text();
    } catch (error: any) {
      lastError = error;
      console.warn(`[BrowserCache] Fetch attempt ${i + 1}/${retries} failed for ${url}:`, error.message);
      
      // Wait before retry with exponential backoff
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)));
      }
    }
  }
  
  throw lastError || new Error(`Failed to fetch ${url} after ${retries} attempts`);
}

/**
 * Fetch all cache files via the API proxy
 * These files contain the pre-computed prover keys that match the deployed contracts
 */
export async function fetchCacheFiles(): Promise<CacheFiles> {
  // Return cached result if available
  if (memoryCache) {
    console.log('[BrowserCache] Using in-memory cached files');
    return memoryCache;
  }
  
  // If already fetching, wait for that promise
  if (cachePromise) {
    console.log('[BrowserCache] Waiting for existing fetch...');
    return cachePromise;
  }
  
  cachePromise = (async () => {
    console.log('[BrowserCache] Fetching cache files via API proxy...');
    console.log('[BrowserCache] Cache list:', cacheJSONList.files.length, 'files');
    
    const result: CacheFiles = {};
    const batchSize = 5; // Fetch 5 files at a time to avoid overwhelming the browser
    const files = cacheJSONList.files;
    
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize);
      console.log(`[BrowserCache] Fetching batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(files.length / batchSize)}...`);
      
      const batchPromises = batch.map(async (file: string) => {
        try {
          const [header, data] = await Promise.all([
            fetchWithRetry(`${CACHE_PROXY_URL}/${file}.header`),
            fetchWithRetry(`${CACHE_PROXY_URL}/${file}`),
          ]);
          return { file, header, data };
        } catch (error) {
          console.warn(`[BrowserCache] Failed to fetch cache file ${file}:`, error);
          return null;
        }
      });

      const batchResults = await Promise.all(batchPromises);
      
      for (const item of batchResults) {
        if (item) {
          result[item.file] = item;
        }
      }
    }
    
    const successCount = Object.keys(result).length;
    console.log('[BrowserCache] Successfully fetched', successCount, 'of', files.length, 'files');
    
    if (successCount < files.length * 0.5) {
      console.error('[BrowserCache] ⚠️ Less than 50% of cache files loaded - compilation may fail');
    }
    
    memoryCache = result;
    return result;
  })();
  
  try {
    return await cachePromise;
  } finally {
    cachePromise = null;
  }
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
