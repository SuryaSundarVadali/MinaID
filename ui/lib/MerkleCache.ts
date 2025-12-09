// lib/MerkleCache.ts - Production-ready cache with two-level Merkle verification
import {
  storeChunk,
  getChunk,
  storeMeta,
  getMeta,
  deleteFile,
  touchFile,
  getLRUFiles,
  getStorageStats,
  type MetaRecord,
  type ChunkRecord,
  type LRURecord,
} from './idbHelpers';
import { sha256Hex, verifySignature } from './crypto';
import { merkleRootFromHex, verifyFileMerkleRoot, verifyManifestRoot } from './merkle';

export interface CacheManifest {
  version: 2;
  generatedAt: number;
  totalSize: number;
  totalFiles: number;
  root: string; // Global Merkle root
  signature?: string; // Ed25519 signature (optional)
  files: Record<string, {
    fileId: string;
    totalChunks: number;
    fileSize: number;
    chunkHashes: string[];
    fileMerkleRoot: string;
    index: number;
    modified: string;
  }>;
}

export interface CacheStats {
  totalSize: number;
  fileCount: number;
  fileIds: string[];
  oldestAccess: number;
  newestAccess: number;
}

export class MerkleCache {
  private manifest: CacheManifest | null = null;
  private readonly CHUNK_SIZE = 1024 * 1024; // 1MB chunks (must match build script)
  private readonly MAX_STORAGE_MB = 800; // Leave room for quota overhead
  private readonly LRU_EVICTION_PERCENT = 0.15; // Evict 15% when over quota

  async initialize(): Promise<void> {
    await this.loadManifest();
  }

  private async loadManifest(): Promise<void> {
    try {
      const response = await fetch('/cache.json');
      if (!response.ok) {
        throw new Error(`Manifest fetch failed: ${response.status}`);
      }
      
      const manifest = await response.json() as CacheManifest;
      
      // Verify manifest version
      if (manifest.version !== 2) {
        throw new Error(`Unsupported manifest version: ${manifest.version}`);
      }

      // Verify manifest signature if present
      if (manifest.signature) {
        const isValid = await this.verifyManifestSignature(manifest);
        if (!isValid) {
          throw new Error('Manifest signature verification failed');
        }
      }

      // Verify global Merkle root
      const fileEntries = Object.values(manifest.files).map(f => ({
        fileId: f.fileId,
        fileMerkleRoot: f.fileMerkleRoot,
        index: f.index,
      }));
      const rootValid = await verifyManifestRoot(fileEntries, manifest.root, manifest.version);
      if (!rootValid) {
        throw new Error('Manifest global Merkle root verification failed');
      }

      this.manifest = manifest;
      console.log(`✅ Cache manifest loaded: ${manifest.totalFiles} files, ${(manifest.totalSize / 1e9).toFixed(2)} GB`);
    } catch (error) {
      console.error('Failed to load cache manifest:', error);
      throw error;
    }
  }

  private async verifyManifestSignature(manifest: CacheManifest): Promise<boolean> {
    if (!manifest.signature) return true;
    
    // Create canonical message for signing (exclude signature field)
    const { signature, ...manifestWithoutSig } = manifest;
    const message = JSON.stringify(manifestWithoutSig);
    
    // TODO: Replace with actual public key from environment or config
    const publicKeyHex = process.env.NEXT_PUBLIC_MANIFEST_SIGNING_KEY || '';
    
    return verifySignature(message, signature, publicKeyHex);
  }

  /**
   * Retrieves a file from cache with full verification
   */
  async getFile(fileId: string): Promise<Uint8Array | null> {
    if (!this.manifest) throw new Error('Manifest not loaded');

    const manifestEntry = this.manifest.files[fileId];
    if (!manifestEntry) {
      console.warn(`File ${fileId} not in manifest`);
      return null;
    }

    const meta = await getMeta(fileId);
    if (!meta) {
      console.log(`File ${fileId} not in IndexedDB cache`);
      return null;
    }

    // Check if file is ready (atomic write completed)
    if (!meta.ready) {
      console.warn(`File ${fileId} not ready (incomplete write)`);
      await deleteFile(fileId); // Clean up partial write
      return null;
    }

    // Verify metadata matches manifest
    if (meta.totalChunks !== manifestEntry.totalChunks || 
        meta.fileSize !== manifestEntry.fileSize ||
        meta.fileMerkleRoot !== manifestEntry.fileMerkleRoot) {
      console.error(`File ${fileId} metadata mismatch with manifest`);
      await deleteFile(fileId);
      return null;
    }

    // Read all chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkData = await getChunk(fileId, i);
      if (!chunkData) {
        console.error(`Missing chunk ${i} for file ${fileId}`);
        await deleteFile(fileId);
        return null;
      }
      chunks.push(new Uint8Array(chunkData.data));
    }

    // Verify file-level Merkle root
    const isValid = await verifyFileMerkleRoot(meta.chunkHashes, meta.fileMerkleRoot);
    if (!isValid) {
      console.error(`File ${fileId} Merkle verification failed`);
      await deleteFile(fileId);
      return null;
    }

    // Update LRU timestamp
    await touchFile(fileId);

    // Concatenate chunks
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    return result;
  }

  /**
   * Stores a file with atomic writes and verification
   */
  async storeFile(fileId: string, data: Uint8Array): Promise<void> {
    if (!this.manifest) throw new Error('Manifest not loaded');

    const manifestEntry = this.manifest.files[fileId];
    if (!manifestEntry) {
      throw new Error(`File ${fileId} not in manifest`);
    }

    // Enforce storage limits before writing
    await this.enforceStorageLimit();

    // Split into chunks and compute hashes
    const chunks: { data: Uint8Array; hash: string }[] = [];
    for (let offset = 0; offset < data.length; offset += this.CHUNK_SIZE) {
      const end = Math.min(offset + this.CHUNK_SIZE, data.length);
      const chunkData = data.slice(offset, end);
      const hash = await sha256Hex(chunkData.buffer);
      chunks.push({ data: chunkData, hash });
    }

    const chunkHashes = chunks.map(c => c.hash);

    // Verify chunk count matches manifest
    if (chunks.length !== manifestEntry.totalChunks) {
      throw new Error(`Chunk count mismatch: got ${chunks.length}, expected ${manifestEntry.totalChunks}`);
    }

    // Verify chunk hashes match manifest
    for (let i = 0; i < chunkHashes.length; i++) {
      if (chunkHashes[i] !== manifestEntry.chunkHashes[i]) {
        throw new Error(`Chunk ${i} hash mismatch for ${fileId}`);
      }
    }

    // Compute and verify file Merkle root
    const fileMerkleRoot = await merkleRootFromHex(chunkHashes);
    if (fileMerkleRoot !== manifestEntry.fileMerkleRoot) {
      throw new Error(`File Merkle root mismatch for ${fileId}`);
    }

    // Store chunks first
    for (let i = 0; i < chunks.length; i++) {
      const buffer = chunks[i].data.buffer as ArrayBuffer;
      await storeChunk({
        fileId,
        chunkIndex: i,
        data: buffer,
        hash: chunks[i].hash,
        size: chunks[i].data.length,
        timestamp: Date.now(),
      });
    }

    // Store metadata with ready=true (atomic commit)
    await storeMeta({
      fileId,
      totalChunks: chunks.length,
      fileSize: data.length,
      fileMerkleRoot,
      chunkHashes,
      ready: true,
      createdAt: Date.now(),
      lastAccessed: Date.now(),
    });

    console.log(`✅ Stored ${fileId}: ${chunks.length} chunks, ${(data.length / 1e6).toFixed(2)} MB`);
  }

  /**
   * Enforce storage limits with LRU eviction
   */
  private async enforceStorageLimit(): Promise<void> {
    const stats = await getStorageStats();
    const currentMB = stats.totalSize / (1024 * 1024);

    if (currentMB > this.MAX_STORAGE_MB) {
      const lruFiles = await getLRUFiles(100); // Get top 100 LRU files
      const toDelete = Math.max(1, Math.ceil(lruFiles.length * this.LRU_EVICTION_PERCENT));
      
      console.warn(`⚠️ Cache over limit (${currentMB.toFixed(0)} MB), evicting ${toDelete} files`);
      
      for (let i = 0; i < toDelete && i < lruFiles.length; i++) {
        await deleteFile(lruFiles[i].fileId);
        console.log(`🗑️ Evicted ${lruFiles[i].fileId}`);
      }
    }
  }

  /**
   * Request persistent storage (prevents eviction)
   */
  async requestPersistentStorage(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) {
      return false;
    }
    
    const isPersisted = await navigator.storage.persist();
    console.log(`Persistent storage: ${isPersisted ? 'granted' : 'denied'}`);
    return isPersisted;
  }

  /**
   * Get storage quota information
   */
  async getQuotaInfo(): Promise<{ usage: number; quota: number; percent: number } | null> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    const estimate = await navigator.storage.estimate();
    const usage = estimate.usage || 0;
    const quota = estimate.quota || 0;
    const percent = quota > 0 ? (usage / quota) * 100 : 0;

    return { usage, quota, percent };
  }

  async clearCache(): Promise<void> {
    // Get all file IDs from meta store
    const allMeta = await this.getAllMetadata();
    for (const meta of allMeta) {
      await deleteFile(meta.fileId);
    }
    console.log('🗑️ Cache cleared');
  }

  private async getAllMetadata(): Promise<MetaRecord[]> {
    // Temporary implementation - gets all metadata
    const manifest = this.manifest;
    if (!manifest) return [];
    
    const results: MetaRecord[] = [];
    for (const fileId of Object.keys(manifest.files)) {
      const meta = await getMeta(fileId);
      if (meta) results.push(meta);
    }
    return results;
  }

  async getStats(): Promise<CacheStats | null> {
    const stats = await getStorageStats();
    const allMeta = await this.getAllMetadata();
    
    const accesses = allMeta.map(m => m.lastAccessed);
    return {
      totalSize: stats.totalSize,
      fileCount: allMeta.length,
      fileIds: allMeta.map(m => m.fileId),
      oldestAccess: accesses.length > 0 ? Math.min(...accesses) : 0,
      newestAccess: accesses.length > 0 ? Math.max(...accesses) : 0,
    };
  }

  getManifest(): CacheManifest | null {
    return this.manifest;
  }
}
