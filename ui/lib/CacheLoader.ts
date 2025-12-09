// lib/CacheLoader.ts - Production-ready cache loader with concurrency limiting
import { MerkleCache, type CacheManifest, type CacheStats } from './MerkleCache';

export type { CacheStats, CacheManifest };

export interface CacheFile {
  fileId: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
}

export interface LoadProgress {
  fileId: string;
  loaded: number;
  total: number;
  percentage: number;
  status: 'pending' | 'downloading' | 'verifying' | 'complete' | 'error';
}

export type ProgressCallback = (progress: LoadProgress) => void;

interface LoadTask {
  fileId: string;
  priority: number; // Lower = higher priority
  resolve: (data: Uint8Array) => void;
  reject: (error: Error) => void;
}

export class CacheLoader {
  private cache: MerkleCache;
  private baseUrl: string;
  private onProgress?: ProgressCallback;
  private maxConcurrent = 6; // Limit concurrent downloads
  private activeDownloads = 0;
  private taskQueue: LoadTask[] = [];
  private retryAttempts = 3;
  private retryDelayMs = 1000;

  constructor(baseUrl: string = '/api/cache', onProgress?: ProgressCallback) {
    this.cache = new MerkleCache();
    this.baseUrl = baseUrl;
    this.onProgress = onProgress;
  }

  async initialize(): Promise<void> {
    await this.cache.initialize();
    
    // Request persistent storage to prevent eviction
    await this.cache.requestPersistentStorage();
    
    // Log quota info
    const quotaInfo = await this.cache.getQuotaInfo();
    if (quotaInfo) {
      console.log(`📊 Storage quota: ${(quotaInfo.usage / 1e9).toFixed(2)} GB / ${(quotaInfo.quota / 1e9).toFixed(2)} GB (${quotaInfo.percent.toFixed(1)}%)`);
    }
  }

  /**
   * Load a single file with caching and retries
   */
  async loadFile(fileId: string, priority: 'critical' | 'high' | 'normal' | 'low' = 'normal'): Promise<Uint8Array> {
    // Try to get from cache first
    const cached = await this.cache.getFile(fileId);
    if (cached) {
      this.reportProgress(fileId, cached.length, cached.length, 'complete');
      return cached;
    }

    // Queue download task
    return new Promise<Uint8Array>((resolve, reject) => {
      const priorityNum = this.priorityToNumber(priority);
      this.taskQueue.push({ fileId, priority: priorityNum, resolve, reject });
      this.taskQueue.sort((a, b) => a.priority - b.priority); // Sort by priority
      this.processQueue();
    });
  }

  /**
   * Load multiple files in priority order
   */
  async loadFiles(files: CacheFile[]): Promise<Map<string, Uint8Array>> {
    const results = new Map<string, Uint8Array>();
    
    // Start all downloads (they'll be queued automatically)
    const promises = files.map(async (file) => {
      try {
        const data = await this.loadFile(file.fileId, file.priority);
        results.set(file.fileId, data);
      } catch (error) {
        console.error(`Failed to load ${file.fileId}:`, error);
        throw error;
      }
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Process queued download tasks with concurrency limit
   */
  private async processQueue(): Promise<void> {
    while (this.taskQueue.length > 0 && this.activeDownloads < this.maxConcurrent) {
      const task = this.taskQueue.shift();
      if (!task) break;

      this.activeDownloads++;
      
      // Execute download in background
      this.downloadWithRetry(task.fileId)
        .then(task.resolve)
        .catch(task.reject)
        .finally(() => {
          this.activeDownloads--;
          this.processQueue(); // Continue processing queue
        });
    }
  }

  /**
   * Download file with retry logic
   */
  private async downloadWithRetry(fileId: string, attempt = 1): Promise<Uint8Array> {
    try {
      this.reportProgress(fileId, 0, 100, 'downloading');
      const data = await this.downloadFile(fileId);
      
      this.reportProgress(fileId, 50, 100, 'verifying');
      await this.cache.storeFile(fileId, data);
      
      this.reportProgress(fileId, 100, 100, 'complete');
      return data;
    } catch (error) {
      if (attempt < this.retryAttempts) {
        const delay = this.retryDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
        console.warn(`Retry ${attempt}/${this.retryAttempts} for ${fileId} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.downloadWithRetry(fileId, attempt + 1);
      } else {
        this.reportProgress(fileId, 0, 100, 'error');
        throw new Error(`Failed to download ${fileId} after ${this.retryAttempts} attempts: ${error}`);
      }
    }
  }

  /**
   * Download file from server
   */
  private async downloadFile(fileId: string): Promise<Uint8Array> {
    const url = `${this.baseUrl}/${fileId}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }

  /**
   * Preload all critical files from manifest
   */
  async preloadCriticalFiles(): Promise<void> {
    const manifest = this.cache.getManifest();
    if (!manifest) {
      throw new Error('Manifest not loaded');
    }

    // Define critical files (adjust based on your needs)
    const criticalPatterns = ['wrap-vk-', 'step-vk-', 'lagrange-basis-'];
    const criticalFiles = Object.keys(manifest.files)
      .filter(fileId => criticalPatterns.some(pattern => fileId.startsWith(pattern)))
      .map(fileId => ({ fileId, priority: 'critical' as const }));

    console.log(`🔥 Preloading ${criticalFiles.length} critical files...`);
    await this.loadFiles(criticalFiles);
    console.log(`✅ Critical files preloaded`);
  }

  /**
   * Preload all files from manifest
   */
  async preloadAll(): Promise<void> {
    const manifest = this.cache.getManifest();
    if (!manifest) {
      throw new Error('Manifest not loaded');
    }

    const allFiles = Object.keys(manifest.files).map(fileId => ({
      fileId,
      priority: this.inferPriority(fileId),
    }));

    console.log(`📦 Preloading ${allFiles.length} files...`);
    await this.loadFiles(allFiles);
    console.log(`✅ All files preloaded`);
  }

  /**
   * Infer priority from file ID
   */
  private inferPriority(fileId: string): 'critical' | 'high' | 'normal' | 'low' {
    if (fileId.startsWith('wrap-vk-') || fileId.startsWith('step-vk-')) {
      return 'critical';
    } else if (fileId.startsWith('lagrange-basis-') || fileId.startsWith('srs-')) {
      return 'high';
    } else if (fileId.startsWith('step-pk-')) {
      return 'normal';
    } else if (fileId.startsWith('wrap-pk-')) {
      return 'low';
    }
    return 'normal';
  }

  private priorityToNumber(priority: 'critical' | 'high' | 'normal' | 'low'): number {
    const map = { critical: 1, high: 2, normal: 3, low: 4 };
    return map[priority];
  }

  private reportProgress(fileId: string, loaded: number, total: number, status: LoadProgress['status']): void {
    if (this.onProgress) {
      this.onProgress({
        fileId,
        loaded,
        total,
        percentage: total > 0 ? (loaded / total) * 100 : 0,
        status,
      });
    }
  }

  async clearCache(): Promise<void> {
    await this.cache.clearCache();
  }

  async getStats() {
    return await this.cache.getStats();
  }

  getManifest(): CacheManifest | null {
    return this.cache.getManifest();
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, Math.min(max, 10));
  }

  setRetryConfig(attempts: number, delayMs: number): void {
    this.retryAttempts = Math.max(1, attempts);
    this.retryDelayMs = Math.max(100, delayMs);
  }

  /**
   * Check if a file is cached
   */
  async isCached(fileId: string): Promise<boolean> {
    const data = await this.cache.getFile(fileId);
    return data !== null;
  }

  /**
   * Preload cache files for a specific contract method
   * Maps contract/method to required cache files
   */
  async preloadForMethod(contractName: string, methodName: string): Promise<void> {
    const manifest = this.cache.getManifest();
    if (!manifest) {
      throw new Error('Manifest not loaded');
    }

    // Determine which cache files are needed for this method
    const requiredFiles = this.getFilesForMethod(contractName, methodName);
    
    console.log(`📦 Preloading ${requiredFiles.length} files for ${contractName}.${methodName}...`);
    
    const files = requiredFiles.map(fileId => ({
      fileId,
      priority: 'high' as const,
    }));

    await this.loadFiles(files);
    console.log(`✅ Preload complete for ${contractName}.${methodName}`);
  }

  /**
   * Map contract methods to required cache files
   * Based on o1js caching patterns
   */
  private getFilesForMethod(contractName: string, methodName: string): string[] {
    const contract = contractName.toLowerCase();
    const method = methodName.toLowerCase();
    
    // Common files always needed
    const common = [
      'lagrange-basis-fp-1024',
      'lagrange-basis-fp-2048',
      'srs-fp-65536',
      'srs-fq-32768',
    ];

    // Contract-specific step keys
    const stepKeys = [
      `step-pk-${contract}-${method}`,
      `step-vk-${contract}-${method}`,
    ];

    // Wrapper keys for the contract
    const wrapKeys = [
      `wrap-pk-${contract}`,
      `wrap-vk-${contract}`,
    ];

    return [...common, ...stepKeys, ...wrapKeys];
  }
}

// Singleton instance for backward compatibility
let cacheLoaderInstance: CacheLoader | null = null;

/**
 * Get singleton CacheLoader instance (backward compatibility)
 */
export function getCacheLoader(onProgress?: ProgressCallback): CacheLoader {
  if (!cacheLoaderInstance) {
    cacheLoaderInstance = new CacheLoader('/api/cache', onProgress);
    // Initialize asynchronously (will complete in background)
    cacheLoaderInstance.initialize().catch(err => {
      console.error('Failed to initialize cache loader:', err);
    });
  }
  return cacheLoaderInstance;
}

