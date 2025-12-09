/**
 * CachePreloader.tsx
 * 
 * UI component for managing ZK circuit cache preloading
 */

'use client';

import React from 'react';
import { useCachePreloader } from '@/hooks/useCachePreloader';

export default function CachePreloader() {
  const {
    isPreloading,
    progress,
    error,
    stats,
    isComplete,
    preloadForMethod,
    preloadAll,
    clearCache
  } = useCachePreloader();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Cache Manager
      </h2>

      {/* Cache Statistics */}
      {stats && (
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Files</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {stats.totalFiles}
            </p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Chunks</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {stats.totalChunks}
            </p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Size</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {stats.formattedSize}
            </p>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {isPreloading && progress && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Loading {progress.file}
            </span>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {progress.percentage.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-sm text-red-800 dark:text-red-200">
            <strong>Error:</strong> {error}
          </p>
        </div>
      )}

      {/* Success Message */}
      {isComplete && !isPreloading && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <p className="text-sm text-green-800 dark:text-green-200">
            ✅ Cache preloaded successfully! ZK proofs will now load faster.
          </p>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={() => preloadForMethod('didregistry', 'registerdidsimple')}
          disabled={isPreloading}
          className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 
                   text-white font-semibold rounded-lg transition-colors duration-200
                   disabled:cursor-not-allowed"
        >
          {isPreloading ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Preloading...
            </span>
          ) : (
            'Preload DID Registration Cache'
          )}
        </button>

        <button
          onClick={() => preloadAll()}
          disabled={isPreloading}
          className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 
                   text-white font-semibold rounded-lg transition-colors duration-200
                   disabled:cursor-not-allowed"
        >
          {isPreloading ? 'Preloading...' : 'Preload All Cache Files'}
        </button>

        {stats && stats.totalFiles > 0 && (
          <button
            onClick={clearCache}
            disabled={isPreloading}
            className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 
                     text-white font-semibold rounded-lg transition-colors duration-200
                     disabled:cursor-not-allowed"
          >
            Clear Cache
          </button>
        )}
      </div>

      {/* Info */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>ℹ️ About Merkle Cache:</strong> Uses Merkle Tree verification
          to ensure integrity and enable incremental loading. Cache is stored in
          IndexedDB and persists across sessions.
        </p>
      </div>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}
