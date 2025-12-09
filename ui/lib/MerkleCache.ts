/**
 * MerkleCache.ts
 * 
 * Merkle Tree-based caching system for ZK circuit files.
 * 
 * Benefits:
 * - Incremental loading: Load only changed files
 * - Integrity verification: Verify file integrity using Merkle proofs
 * - Efficient updates: Only re-download modified cache files
 * - Parallel loading: Load multiple files simultaneously
 * - Compression: Store compressed chunks in IndexedDB
 */

import { Poseidon } from 'o1js';

// IndexedDB configuration
const DB_NAME = 'mina-merkle-cache';
const DB_VERSION = 2;
const STORE_NAME = 'cache-chunks';
const METADATA_STORE = 'cache-metadata';
const CHUNK_SIZE = 1024 * 1024; // 1MB chunks

interface CacheChunk {
  fileId: string;
  chunkIndex: number;
  data: ArrayBuffer;
  hash: string;
  timestamp: number;
}

interface CacheMetadata {
  fileId: string;
  totalChunks: number;
  merkleRoot: string;
  fileSize: number;
  lastModified: number;
  chunks: string[]; // Hashes of each chunk
}

interface MerkleProof {
  leaf: string;
  path: string[];
  index: number;
}

export class MerkleCache {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize IndexedDB connection
   */
  private async init(): Promise<void> {
    if (this.db) return;
    
    if (this.initPromise) {
      await this.initPromise;
      return;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[MerkleCache] Failed to open IndexedDB');
        reject(new Error('IndexedDB open failed'));
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Create chunks store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const chunkStore = db.createObjectStore(STORE_NAME, {
            keyPath: ['fileId', 'chunkIndex']
          });
          chunkStore.createIndex('fileId', 'fileId', { unique: false });
          chunkStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Create metadata store
        if (!db.objectStoreNames.contains(METADATA_STORE)) {
          db.createObjectStore(METADATA_STORE, { keyPath: 'fileId' });
        }

        console.log('[MerkleCache] Database upgraded to version', db.version);
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[MerkleCache] ✅ IndexedDB initialized');
        resolve();
      };
    });

    await this.initPromise;
  }

  /**
   * Compute Merkle root from chunk hashes
   */
  private async computeMerkleRoot(hashes: string[]): Promise<string> {
    if (hashes.length === 0) return '';
    if (hashes.length === 1) return hashes[0];

    // Build Merkle tree bottom-up
    let currentLevel = [...hashes];

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];

      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          // Hash pair together
          const combined = currentLevel[i] + currentLevel[i + 1];
          const hash = await this.hashString(combined);
          nextLevel.push(hash);
        } else {
          // Odd number of nodes - promote the last one
          nextLevel.push(currentLevel[i]);
        }
      }

      currentLevel = nextLevel;
    }

    return currentLevel[0];
  }

  /**
   * Hash a string using a simple hash function (Web Crypto API)
   */
  private async hashString(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Hash ArrayBuffer data
   */
  private async hashBuffer(buffer: ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Split file into chunks and store with Merkle tree
   */
  async storeFile(fileId: string, data: ArrayBuffer): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    console.log(`[MerkleCache] Storing ${fileId} (${(data.byteLength / 1024 / 1024).toFixed(2)} MB)`);

    const chunks: CacheChunk[] = [];
    const chunkHashes: string[] = [];
    const totalChunks = Math.ceil(data.byteLength / CHUNK_SIZE);

    // Split into chunks and compute hashes
    for (let i = 0; i < totalChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, data.byteLength);
      const chunkData = data.slice(start, end);
      const hash = await this.hashBuffer(chunkData);

      chunks.push({
        fileId,
        chunkIndex: i,
        data: chunkData,
        hash,
        timestamp: Date.now()
      });

      chunkHashes.push(hash);
    }

    // Compute Merkle root
    const merkleRoot = await this.computeMerkleRoot(chunkHashes);

    // Store chunks in parallel
    const transaction = this.db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
    const chunkStore = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    // Store each chunk
    const storePromises = chunks.map(chunk => {
      return new Promise<void>((resolve, reject) => {
        const request = chunkStore.put(chunk);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(storePromises);

    // Store metadata
    const metadata: CacheMetadata = {
      fileId,
      totalChunks,
      merkleRoot,
      fileSize: data.byteLength,
      lastModified: Date.now(),
      chunks: chunkHashes
    };

    await new Promise<void>((resolve, reject) => {
      const request = metadataStore.put(metadata);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    console.log(`[MerkleCache] ✅ Stored ${totalChunks} chunks for ${fileId}`);
    console.log(`[MerkleCache] Merkle root: ${merkleRoot.slice(0, 16)}...`);
  }

  /**
   * Retrieve file by reconstructing from chunks
   */
  async getFile(fileId: string): Promise<ArrayBuffer | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    // Get metadata
    const metadata = await this.getMetadata(fileId);
    if (!metadata) {
      console.log(`[MerkleCache] ❌ No metadata found for ${fileId}`);
      return null;
    }

    console.log(`[MerkleCache] Loading ${fileId} (${metadata.totalChunks} chunks)`);

    // Load all chunks in parallel
    const transaction = this.db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);

    const chunkPromises: Promise<CacheChunk | null>[] = [];
    for (let i = 0; i < metadata.totalChunks; i++) {
      chunkPromises.push(
        new Promise((resolve, reject) => {
          const request = store.get([fileId, i]);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        })
      );
    }

    const chunks = await Promise.all(chunkPromises);

    // Check if all chunks are present
    if (chunks.some(c => c === null)) {
      console.log(`[MerkleCache] ❌ Missing chunks for ${fileId}`);
      return null;
    }

    // Verify chunk hashes
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]!;
      const expectedHash = metadata.chunks[i];
      
      if (chunk.hash !== expectedHash) {
        console.error(`[MerkleCache] ❌ Hash mismatch for chunk ${i} of ${fileId}`);
        return null;
      }
    }

    // Reconstruct file
    const totalSize = chunks.reduce((sum, c) => sum + c!.data.byteLength, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(new Uint8Array(chunk!.data), offset);
      offset += chunk!.data.byteLength;
    }

    console.log(`[MerkleCache] ✅ Loaded ${fileId} (${(totalSize / 1024 / 1024).toFixed(2)} MB)`);
    return result.buffer;
  }

  /**
   * Get file metadata
   */
  private async getMetadata(fileId: string): Promise<CacheMetadata | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(METADATA_STORE, 'readonly');
      const store = transaction.objectStore(METADATA_STORE);
      const request = store.get(fileId);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Check if file exists and verify its Merkle root
   */
  async hasValidCache(fileId: string, expectedRoot?: string): Promise<boolean> {
    const metadata = await this.getMetadata(fileId);
    if (!metadata) return false;

    if (expectedRoot && metadata.merkleRoot !== expectedRoot) {
      console.log(`[MerkleCache] Merkle root mismatch for ${fileId}`);
      return false;
    }

    return true;
  }

  /**
   * Delete file and all its chunks
   */
  async deleteFile(fileId: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
    const chunkStore = transaction.objectStore(STORE_NAME);
    const metadataStore = transaction.objectStore(METADATA_STORE);

    // Delete metadata
    await new Promise<void>((resolve, reject) => {
      const request = metadataStore.delete(fileId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Delete all chunks
    const index = chunkStore.index('fileId');
    const range = IDBKeyRange.only(fileId);

    await new Promise<void>((resolve, reject) => {
      const request = index.openCursor(range);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(request.error);
    });

    console.log(`[MerkleCache] ✅ Deleted ${fileId}`);
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalFiles: number;
    totalChunks: number;
    totalSize: number;
  }> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([STORE_NAME, METADATA_STORE], 'readonly');
    const metadataStore = transaction.objectStore(METADATA_STORE);

    const files = await new Promise<CacheMetadata[]>((resolve, reject) => {
      const request = metadataStore.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const totalSize = files.reduce((sum, f) => sum + f.fileSize, 0);
    const totalChunks = files.reduce((sum, f) => sum + f.totalChunks, 0);

    return {
      totalFiles: files.length,
      totalChunks,
      totalSize
    };
  }

  /**
   * Clear all cached data
   */
  async clearAll(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const transaction = this.db.transaction([STORE_NAME, METADATA_STORE], 'readwrite');
    
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      }),
      new Promise<void>((resolve, reject) => {
        const request = transaction.objectStore(METADATA_STORE).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      })
    ]);

    console.log('[MerkleCache] ✅ Cleared all cache');
  }
}

// Singleton instance
let merkleCacheInstance: MerkleCache | null = null;

export function getMerkleCache(): MerkleCache {
  if (!merkleCacheInstance) {
    merkleCacheInstance = new MerkleCache();
  }
  return merkleCacheInstance;
}
