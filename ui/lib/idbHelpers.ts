/**
 * idbHelpers.ts
 * IndexedDB utilities for cache storage with LRU tracking
 */

const DB_NAME = 'zk-cache-db';
const DB_VERSION = 3;
const CHUNKS_STORE = 'chunks';
const META_STORE = 'meta';
const LRU_STORE = 'lru';

export interface ChunkRecord {
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  hash: string;
  size: number;
  timestamp: number;
}

export interface MetaRecord {
  fileId: string;
  totalChunks: number;
  fileSize: number;
  fileMerkleRoot: string;
  chunkHashes: string[];
  ready: boolean;
  createdAt: number;
  lastAccessed: number;
}

export interface LRURecord {
  fileId: string;
  lastAccessed: number;
  fileSize: number;
}

let dbInstance: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open IndexedDB connection with proper upgrade handling
 */
export async function openCacheDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('[IDB] Failed to open database:', request.error);
      reject(new Error('Failed to open IndexedDB'));
    };
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create chunks store
      if (!db.objectStoreNames.contains(CHUNKS_STORE)) {
        const chunkStore = db.createObjectStore(CHUNKS_STORE, {
          keyPath: ['fileId', 'chunkIndex']
        });
        chunkStore.createIndex('fileId', 'fileId', { unique: false });
        chunkStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      // Create metadata store
      if (!db.objectStoreNames.contains(META_STORE)) {
        const metaStore = db.createObjectStore(META_STORE, { keyPath: 'fileId' });
        metaStore.createIndex('ready', 'ready', { unique: false });
        metaStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
      
      // Create LRU tracking store
      if (!db.objectStoreNames.contains(LRU_STORE)) {
        const lruStore = db.createObjectStore(LRU_STORE, { keyPath: 'fileId' });
        lruStore.createIndex('lastAccessed', 'lastAccessed', { unique: false });
      }
      
      console.log('[IDB] Database upgraded to version', db.version);
    };
    
    request.onsuccess = () => {
      dbInstance = request.result;
      console.log('[IDB] ✅ Database opened successfully');
      resolve(dbInstance);
    };
  });
  
  return dbPromise;
}

/**
 * Store a chunk with atomic transaction
 */
export async function storeChunk(chunk: ChunkRecord): Promise<void> {
  const db = await openCacheDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readwrite');
    const store = tx.objectStore(CHUNKS_STORE);
    const request = store.put(chunk);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a specific chunk
 */
export async function getChunk(fileId: string, chunkIndex: number): Promise<ChunkRecord | null> {
  const db = await openCacheDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CHUNKS_STORE, 'readonly');
    const store = tx.objectStore(CHUNKS_STORE);
    const request = store.get([fileId, chunkIndex]);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Store file metadata (only after all chunks are verified)
 */
export async function storeMeta(meta: MetaRecord): Promise<void> {
  const db = await openCacheDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, LRU_STORE], 'readwrite');
    const metaStore = tx.objectStore(META_STORE);
    const lruStore = tx.objectStore(LRU_STORE);
    
    // Store metadata
    metaStore.put(meta);
    
    // Update LRU tracking
    lruStore.put({
      fileId: meta.fileId,
      lastAccessed: meta.lastAccessed,
      fileSize: meta.fileSize
    });
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get file metadata
 */
export async function getMeta(fileId: string): Promise<MetaRecord | null> {
  const db = await openCacheDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const request = store.get(fileId);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update LRU timestamp when file is accessed
 */
export async function touchFile(fileId: string): Promise<void> {
  const db = await openCacheDB();
  const now = Date.now();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, LRU_STORE], 'readwrite');
    
    // Update meta
    const metaStore = tx.objectStore(META_STORE);
    const metaRequest = metaStore.get(fileId);
    
    metaRequest.onsuccess = () => {
      const meta = metaRequest.result;
      if (meta) {
        meta.lastAccessed = now;
        metaStore.put(meta);
      }
    };
    
    // Update LRU
    const lruStore = tx.objectStore(LRU_STORE);
    const lruRequest = lruStore.get(fileId);
    
    lruRequest.onsuccess = () => {
      const lru = lruRequest.result;
      if (lru) {
        lru.lastAccessed = now;
        lruStore.put(lru);
      }
    };
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Delete a file and all its chunks
 */
export async function deleteFile(fileId: string): Promise<void> {
  const db = await openCacheDB();
  
  return new Promise(async (resolve, reject) => {
    const meta = await getMeta(fileId);
    if (!meta) {
      resolve();
      return;
    }
    
    const tx = db.transaction([CHUNKS_STORE, META_STORE, LRU_STORE], 'readwrite');
    
    // Delete all chunks
    const chunkStore = tx.objectStore(CHUNKS_STORE);
    for (let i = 0; i < meta.totalChunks; i++) {
      chunkStore.delete([fileId, i]);
    }
    
    // Delete metadata
    tx.objectStore(META_STORE).delete(fileId);
    
    // Delete LRU record
    tx.objectStore(LRU_STORE).delete(fileId);
    
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get total storage usage
 */
export async function getStorageStats(): Promise<{
  totalFiles: number;
  totalChunks: number;
  totalSize: number;
  readyFiles: number;
}> {
  const db = await openCacheDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([META_STORE, CHUNKS_STORE], 'readonly');
    
    const metaRequest = tx.objectStore(META_STORE).getAll();
    const chunkRequest = tx.objectStore(CHUNKS_STORE).count();
    
    let stats = {
      totalFiles: 0,
      totalChunks: 0,
      totalSize: 0,
      readyFiles: 0
    };
    
    metaRequest.onsuccess = () => {
      const metas: MetaRecord[] = metaRequest.result;
      stats.totalFiles = metas.length;
      stats.totalSize = metas.reduce((sum, m) => sum + m.fileSize, 0);
      stats.readyFiles = metas.filter(m => m.ready).length;
    };
    
    chunkRequest.onsuccess = () => {
      stats.totalChunks = chunkRequest.result;
    };
    
    tx.oncomplete = () => resolve(stats);
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get least recently used files for eviction
 */
export async function getLRUFiles(count: number): Promise<LRURecord[]> {
  const db = await openCacheDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction(LRU_STORE, 'readonly');
    const store = tx.objectStore(LRU_STORE);
    const index = store.index('lastAccessed');
    const request = index.openCursor();
    
    const lruFiles: LRURecord[] = [];
    
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor && lruFiles.length < count) {
        lruFiles.push(cursor.value);
        cursor.continue();
      } else {
        resolve(lruFiles);
      }
    };
    
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all stores
 */
export async function clearAll(): Promise<void> {
  const db = await openCacheDB();
  
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CHUNKS_STORE, META_STORE, LRU_STORE], 'readwrite');
    
    tx.objectStore(CHUNKS_STORE).clear();
    tx.objectStore(META_STORE).clear();
    tx.objectStore(LRU_STORE).clear();
    
    tx.oncomplete = () => {
      console.log('[IDB] ✅ All stores cleared');
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}
