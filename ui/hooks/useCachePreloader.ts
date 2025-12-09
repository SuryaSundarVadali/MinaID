/**
 * useCachePreloader.ts
 * 
 * React hook for preloading ZK circuit cache files with progress tracking
 */

import { useState, useEffect, useCallback } from 'react';
import { getCacheLoader, LoadProgress, type CacheStats as MerkleCacheStats } from '@/lib/CacheLoader';

export interface CacheStats extends MerkleCacheStats {
  formattedSize: string;
}

export interface PreloadState {
  isPreloading: boolean;
  progress: LoadProgress | null;
  error: string | null;
  stats: CacheStats | null;
  isComplete: boolean;
}

export function useCachePreloader() {
  const [state, setState] = useState<PreloadState>({
    isPreloading: false,
    progress: null,
    error: null,
    stats: null,
    isComplete: false
  });

  const cacheLoader = getCacheLoader((progress) => {
    setState(prev => ({ ...prev, progress }));
  });

  /**
   * Preload cache for a specific contract method
   */
  const preloadForMethod = useCallback(async (
    contractName: string,
    methodName: string
  ): Promise<void> => {
    setState(prev => ({
      ...prev,
      isPreloading: true,
      error: null,
      progress: null,
      isComplete: false
    }));

    try {
      await cacheLoader.preloadForMethod(contractName, methodName);
      
      const stats = await cacheLoader.getStats();
      
      setState(prev => ({
        ...prev,
        isPreloading: false,
        isComplete: true,
        stats: stats ? {
          ...stats,
          formattedSize: formatBytes(stats.totalSize)
        } : null
      }));
    } catch (error) {
      console.error('[CachePreloader] Error:', error);
      setState(prev => ({
        ...prev,
        isPreloading: false,
        error: error instanceof Error ? error.message : 'Failed to preload cache'
      }));
    }
  }, [cacheLoader]);

  /**
   * Preload all cache files
   */
  const preloadAll = useCallback(async (): Promise<void> => {
    setState(prev => ({
      ...prev,
      isPreloading: true,
      error: null,
      progress: null,
      isComplete: false
    }));

    try {
      await cacheLoader.preloadAll();
      
      const stats = await cacheLoader.getStats();
      
      setState(prev => ({
        ...prev,
        isPreloading: false,
        isComplete: true,
        stats: stats ? {
          ...stats,
          formattedSize: formatBytes(stats.totalSize)
        } : null
      }));
    } catch (error) {
      console.error('[CachePreloader] Error:', error);
      setState(prev => ({
        ...prev,
        isPreloading: false,
        error: error instanceof Error ? error.message : 'Failed to preload cache'
      }));
    }
  }, [cacheLoader]);

  /**
   * Clear all cached data
   */
  const clearCache = useCallback(async (): Promise<void> => {
    try {
      await cacheLoader.clearCache();
      setState(prev => ({
        ...prev,
        stats: null,
        isComplete: false
      }));
    } catch (error) {
      console.error('[CachePreloader] Error clearing cache:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to clear cache'
      }));
    }
  }, [cacheLoader]);

  /**
   * Load cache stats on mount
   */
  useEffect(() => {
    const loadStats = async () => {
      try {
        const stats = await cacheLoader.getStats();
        setState(prev => ({
          ...prev,
          stats: stats ? {
            ...stats,
            formattedSize: formatBytes(stats.totalSize)
          } : null,
          isComplete: stats ? stats.fileCount > 0 : false
        }));
      } catch (error) {
        console.error('[CachePreloader] Error loading stats:', error);
      }
    };

    loadStats();
  }, [cacheLoader]);

  /**
   * Check if a specific file is cached
   */
  const isCached = useCallback(async (path: string): Promise<boolean> => {
    try {
      return await cacheLoader.isCached(path);
    } catch (error) {
      console.error('[CachePreloader] Error checking cache:', error);
      return false;
    }
  }, [cacheLoader]);

  return {
    ...state,
    preloadForMethod,
    preloadAll,
    clearCache,
    isCached
  };
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
