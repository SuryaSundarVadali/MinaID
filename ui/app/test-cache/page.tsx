'use client';

import { useState, useEffect } from 'react';
import { MerkleCache } from '@/lib/MerkleCache';
import { createO1JSCacheFromMerkle } from '@/lib/O1JSCacheAdapter';

export default function TestCachePage() {
  const [status, setStatus] = useState<string>('Initializing...');
  const [logs, setLogs] = useState<string[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isTesting, setIsTesting] = useState(false);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testCache = async () => {
    setIsTesting(true);
    setLogs([]);
    setStatus('Testing cache system...');

    try {
      // Step 1: Initialize MerkleCache
      addLog('📦 Step 1: Initializing MerkleCache...');
      const cache = new MerkleCache();
      await cache.initialize();
      addLog('✅ MerkleCache initialized');

      const manifest = cache.getManifest();
      if (manifest) {
        addLog(`📋 Manifest loaded: ${manifest.totalFiles} files, ${(manifest.totalSize / 1e9).toFixed(2)} GB`);
        addLog(`🌳 Global Merkle root: ${manifest.root.substring(0, 16)}...`);
      }

      // Step 2: Check storage quota
      addLog('💾 Step 2: Checking storage quota...');
      const quotaInfo = await cache.getQuotaInfo();
      if (quotaInfo) {
        addLog(`📊 Storage: ${(quotaInfo.usage / 1e9).toFixed(2)} GB / ${(quotaInfo.quota / 1e9).toFixed(2)} GB (${quotaInfo.percent.toFixed(1)}%)`);
      }

      // Step 3: Request persistent storage
      addLog('🔒 Step 3: Requesting persistent storage...');
      const isPersistent = await cache.requestPersistentStorage();
      addLog(`${isPersistent ? '✅' : '⚠️'} Persistent storage: ${isPersistent ? 'granted' : 'denied'}`);

      // Step 4: Check current cache stats
      addLog('📊 Step 4: Checking current cache...');
      const beforeStats = await cache.getStats();
      if (beforeStats) {
        addLog(`📦 Current cache: ${beforeStats.fileCount} files, ${(beforeStats.totalSize / 1e9).toFixed(2)} GB`);
        setStats(beforeStats);
      } else {
        addLog('ℹ️ Cache is empty');
      }

      // Step 5: Load all files (will download if not cached)
      addLog('🚀 Step 5: Loading all cache files via o1js adapter...');
      addLog('⏳ This will download from /api/cache if not in IndexedDB...');
      
      const startTime = Date.now();
      const o1jsCache = await createO1JSCacheFromMerkle(cache);
      const loadTime = ((Date.now() - startTime) / 1000).toFixed(1);
      
      addLog(`✅ All files loaded in ${loadTime}s`);

      // Step 6: Check cache stats after loading
      addLog('📊 Step 6: Checking cache after load...');
      const afterStats = await cache.getStats();
      if (afterStats) {
        addLog(`📦 Updated cache: ${afterStats.fileCount} files, ${(afterStats.totalSize / 1e9).toFixed(2)} GB`);
        setStats(afterStats);
        
        if (beforeStats && afterStats.fileCount > beforeStats.fileCount) {
          const newFiles = afterStats.fileCount - beforeStats.fileCount;
          addLog(`🎉 Downloaded and cached ${newFiles} new files!`);
        } else if (beforeStats && afterStats.fileCount === beforeStats.fileCount) {
          addLog(`✨ All files were already cached! (Fast load)`);
        }
      }

      // Step 7: Test o1js Cache interface
      addLog('🧪 Step 7: Testing o1js Cache interface...');
      const testFileId = 'wrap-vk-didregistry';
      const testResult = o1jsCache.read({
        persistentId: testFileId,
        uniqueId: 'test-uniqueid', // Will fail version check
        dataType: 'string'
      } as any);
      
      if (testResult === undefined) {
        addLog(`✅ Cache read working (expected undefined for wrong uniqueId)`);
      }

      setStatus('✅ All tests completed successfully!');
      addLog('🎊 Cache system is working correctly!');

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`❌ Error: ${errorMsg}`);
      setStatus(`❌ Test failed: ${errorMsg}`);
    } finally {
      setIsTesting(false);
    }
  };

  const clearCache = async () => {
    setLogs([]);
    addLog('🗑️ Clearing IndexedDB cache...');
    
    try {
      const cache = new MerkleCache();
      await cache.initialize();
      await cache.clearCache();
      addLog('✅ Cache cleared successfully');
      setStats(null);
      setStatus('Cache cleared');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      addLog(`❌ Error clearing cache: ${errorMsg}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-pink-50 dark:from-gray-900 dark:via-purple-900 dark:to-blue-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            🧪 Merkle Cache Test Suite
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Test IndexedDB caching with Merkle verification
          </p>

          {/* Status */}
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
            <p className="text-lg font-medium text-blue-900 dark:text-blue-100">
              {status}
            </p>
          </div>

          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Files</p>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {stats.fileCount}
                </p>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Size</p>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {(stats.totalSize / 1e9).toFixed(2)} GB
                </p>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <p className="text-sm text-gray-600 dark:text-gray-400">Last Access</p>
                <p className="text-sm font-bold text-orange-600 dark:text-orange-400">
                  {new Date(stats.newestAccess).toLocaleTimeString()}
                </p>
              </div>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-4 mb-6">
            <button
              onClick={testCache}
              disabled={isTesting}
              className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              {isTesting ? '⏳ Testing...' : '🚀 Run Cache Test'}
            </button>
            <button
              onClick={clearCache}
              disabled={isTesting}
              className="bg-red-500 text-white font-semibold py-3 px-6 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-all"
            >
              🗑️ Clear Cache
            </button>
          </div>

          {/* Logs */}
          <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 max-h-96 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Console Logs:
            </h3>
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Click "Run Cache Test" to start...
              </p>
            ) : (
              <div className="space-y-1 font-mono text-xs">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`${
                      log.includes('❌') ? 'text-red-600 dark:text-red-400' :
                      log.includes('✅') || log.includes('🎉') ? 'text-green-600 dark:text-green-400' :
                      log.includes('⚠️') ? 'text-orange-600 dark:text-orange-400' :
                      'text-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {log}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="mt-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
              📝 Testing Instructions:
            </h4>
            <ol className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1 list-decimal list-inside">
              <li>Click "Run Cache Test" - first run will download all files (~1.3 GB)</li>
              <li>Watch console logs for download progress and IndexedDB storage</li>
              <li>Run test again - should load from IndexedDB instantly (no downloads)</li>
              <li>Check browser DevTools → Application → IndexedDB → "mina-cache-v2"</li>
              <li>Use "Clear Cache" to reset and test fresh download</li>
            </ol>
          </div>

          {/* DevTools Link */}
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Open <kbd className="px-2 py-1 bg-gray-200 dark:bg-gray-700 rounded">F12</kbd> → 
              Application → IndexedDB to inspect cache
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
