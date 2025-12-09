/**
 * CacheLoader.ts
 * 
 * High-level cache loader that uses Merkle Tree caching
 * for efficient, incremental loading of ZK circuit cache files.
 * 
 * Features:
 * - Parallel loading of multiple files
 * - Smart caching with IndexedDB
 * - Merkle tree verification
 * - Progress tracking
 * - Automatic retry logic
 */

import { getMerkleCache } from './MerkleCache';

export interface CacheFile {
  path: string;
  size?: number;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

export interface LoadProgress {
  file: string;
  loaded: number;
  total: number;
  percentage: number;
}

export type ProgressCallback = (progress: LoadProgress) => void;

export class CacheLoader {
  private baseUrl: string;
  private merkleCache = getMerkleCache();
  private onProgress?: ProgressCallback;
  private loadedFiles = new Set<string>();

  constructor(baseUrl: string = '/api/cache', onProgress?: ProgressCallback) {
    this.baseUrl = baseUrl;
    this.onProgress = onProgress;
  }

  /**
   * Load a single file with caching
   */
  async loadFile(path: string): Promise<ArrayBuffer> {
    const fileId = this.getFileId(path);

    // Check if already in memory
    if (this.loadedFiles.has(fileId)) {
      console.log(`[CacheLoader] ✅ ${path} already loaded in memory`);
      // Still need to return the cached data
      const cached = await this.merkleCache.getFile(fileId);
      if (cached) return cached;
    }

    // Try to load from Merkle cache
    const cached = await this.merkleCache.getFile(fileId);
    if (cached) {
      console.log(`[CacheLoader] ✅ ${path} loaded from IndexedDB cache`);
      this.loadedFiles.add(fileId);
      return cached;
    }

    // Download from server
    console.log(`[CacheLoader] ⬇️ Downloading ${path}...`);
    const data = await this.downloadFile(path);

    // Store in Merkle cache
    await this.merkleCache.storeFile(fileId, data);
    this.loadedFiles.add(fileId);

    return data;
  }

  /**
   * Download file from server with progress tracking
   */
  private async downloadFile(path: string): Promise<ArrayBuffer> {
    const url = `${this.baseUrl}/${path}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status} ${response.statusText}`);
    }

    const total = parseInt(response.headers.get('content-length') || '0', 10);
    
    if (!response.body) {
      throw new Error(`No response body for ${path}`);
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let loaded = 0;

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunks.push(value);
      loaded += value.length;

      // Report progress
      if (this.onProgress && total > 0) {
        this.onProgress({
          file: path,
          loaded,
          total,
          percentage: (loaded / total) * 100
        });
      }
    }

    // Combine chunks
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.length;
    }

    console.log(`[CacheLoader] ✅ Downloaded ${path} (${(totalLength / 1024 / 1024).toFixed(2)} MB)`);
    return result.buffer;
  }

  /**
   * Load multiple files in parallel with priority
   */
  async loadFiles(files: CacheFile[]): Promise<void> {
    // Sort by priority
    const sorted = [...files].sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

    // Group by priority
    const groups: CacheFile[][] = [
      sorted.filter(f => f.priority === 'critical'),
      sorted.filter(f => f.priority === 'high'),
      sorted.filter(f => f.priority === 'normal'),
      sorted.filter(f => f.priority === 'low')
    ];

    // Load each priority group sequentially, but files within group in parallel
    for (const group of groups) {
      if (group.length === 0) continue;

      console.log(`[CacheLoader] Loading ${group.length} ${group[0].priority} priority files...`);
      
      await Promise.all(
        group.map(file => this.loadFile(file.path))
      );
    }

    console.log('[CacheLoader] ✅ All files loaded');
  }

  /**
   * Preload critical cache files for a specific contract method
   */
  async preloadForMethod(contractName: string, methodName: string): Promise<void> {
    const normalizedContract = contractName.toLowerCase();
    const normalizedMethod = methodName.toLowerCase();

    const files: CacheFile[] = [
      // Critical: Method-specific files
      {
        path: `step-pk-${normalizedContract}-${normalizedMethod}`,
        priority: 'critical'
      },
      {
        path: `step-pk-${normalizedContract}-${normalizedMethod}.header`,
        priority: 'critical'
      },
      {
        path: `step-vk-${normalizedContract}-${normalizedMethod}`,
        priority: 'critical'
      },
      {
        path: `step-vk-${normalizedContract}-${normalizedMethod}.header`,
        priority: 'critical'
      },
      
      // High priority: Common shared resources
      {
        path: 'lagrange-basis-fp-16384',
        priority: 'high'
      },
      {
        path: 'lagrange-basis-fp-16384.header',
        priority: 'high'
      },
      {
        path: 'srs-fp-65536',
        priority: 'high'
      },
      {
        path: 'srs-fp-65536.header',
        priority: 'high'
      }
    ];

    await this.loadFiles(files);
  }

  /**
   * Preload all cache files for full offline support
   */
  async preloadAll(): Promise<void> {
    const cacheManifest = await this.getCacheManifest();
    const files: CacheFile[] = cacheManifest.map(path => ({
      path,
      priority: this.determinePriority(path)
    }));

    await this.loadFiles(files);
  }

  /**
   * Get list of all cache files from server
   */
  private async getCacheManifest(): Promise<string[]> {
    const response = await fetch(`${this.baseUrl}/manifest.json`);
    if (!response.ok) {
      // Fallback: Return known cache files
      console.warn('[CacheLoader] Failed to fetch manifest, using fallback list');
      return this.getDefaultManifest();
    }

    const manifest = await response.json();
    return manifest.files || [];
  }

  /**
   * Get default cache manifest (fallback)
   */
  private getDefaultManifest(): string[] {
    // Common cache files
    return [
      // Lagrange basis
      'lagrange-basis-fp-1024',
      'lagrange-basis-fp-1024.header',
      'lagrange-basis-fp-2048',
      'lagrange-basis-fp-2048.header',
      'lagrange-basis-fp-8192',
      'lagrange-basis-fp-8192.header',
      'lagrange-basis-fp-16384',
      'lagrange-basis-fp-16384.header',
      'lagrange-basis-fq-16384',
      'lagrange-basis-fq-16384.header',
      
      // SRS
      'srs-fp-65536',
      'srs-fp-65536.header',
      'srs-fq-32768',
      'srs-fq-32768.header',
      
      // DIDRegistry methods
      'step-pk-didregistry-registerdidsimple',
      'step-pk-didregistry-registerdidsimple.header',
      'step-vk-didregistry-registerdidsimple',
      'step-vk-didregistry-registerdidsimple.header',
      
      'step-pk-didregistry-registerdid',
      'step-pk-didregistry-registerdid.header',
      'step-vk-didregistry-registerdid',
      'step-vk-didregistry-registerdid.header',
      
      // ZKPVerifier methods
      'step-pk-zkpverifier-verifyageproof',
      'step-pk-zkpverifier-verifyageproof.header',
      'step-vk-zkpverifier-verifyageproof',
      'step-vk-zkpverifier-verifyageproof.header'
    ];
  }

  /**
   * Determine file priority based on path
   */
  private determinePriority(path: string): 'critical' | 'high' | 'normal' | 'low' {
    // Critical: registerDIDSimple (most common operation)
    if (path.includes('registerdidsimple')) return 'critical';
    
    // High: Common shared resources
    if (path.includes('lagrange-basis-fp-16384')) return 'high';
    if (path.includes('srs-fp-65536')) return 'high';
    
    // Normal: Other method-specific files
    if (path.includes('step-pk-') || path.includes('step-vk-')) return 'normal';
    
    // Low: Other shared resources
    return 'low';
  }

  /**
   * Convert path to file ID
   */
  private getFileId(path: string): string {
    return path.replace(/\//g, '_');
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    return this.merkleCache.getStats();
  }

  /**
   * Clear all cached data
   */
  async clearCache(): Promise<void> {
    await this.merkleCache.clearAll();
    this.loadedFiles.clear();
  }

  /**
   * Check if file is cached
   */
  async isCached(path: string): Promise<boolean> {
    const fileId = this.getFileId(path);
    return this.merkleCache.hasValidCache(fileId);
  }
}

// Singleton instance
let cacheLoaderInstance: CacheLoader | null = null;

export function getCacheLoader(onProgress?: ProgressCallback): CacheLoader {
  if (!cacheLoaderInstance) {
    cacheLoaderInstance = new CacheLoader('/api/cache', onProgress);
  }
  return cacheLoaderInstance;
}
