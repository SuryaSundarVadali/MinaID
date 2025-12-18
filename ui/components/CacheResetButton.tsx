/**
 * CacheResetButton.tsx
 * 
 * Emergency cache reset component for when compilation fails
 * Clears IndexedDB, localStorage, and triggers app reload
 */

'use client';

import React, { useState } from 'react';
import { notify } from '../lib/ToastNotifications';

export interface CacheResetButtonProps {
  onReset?: () => void;
  variant?: 'button' | 'banner' | 'minimal';
  reason?: string;
}

export function CacheResetButton({ 
  onReset, 
  variant = 'button',
  reason 
}: CacheResetButtonProps) {
  const [isResetting, setIsResetting] = useState(false);

  const handleReset = async () => {
    if (!confirm('This will clear all cached data and reload the app. Continue?')) {
      return;
    }

    setIsResetting(true);
    notify.info('Clearing cache...', { duration: 2000 });

    try {
      // 1. Clear IndexedDB (MerkleCache)
      const databases = ['MinaID_Cache_DB', 'merkle_cache_db', 'zkapp_cache'];
      for (const dbName of databases) {
        try {
          await new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => {
              console.log(`[CacheReset] Deleted ${dbName}`);
              resolve();
            };
            req.onerror = () => reject(req.error);
            req.onblocked = () => {
              console.warn(`[CacheReset] ${dbName} deletion blocked`);
              resolve(); // Continue anyway
            };
          });
        } catch (err) {
          console.warn(`[CacheReset] Failed to delete ${dbName}:`, err);
        }
      }

      // 2. Clear localStorage (except essential data)
      const essentialKeys = ['minaid_session', 'minaid_passkey_verified_did'];
      const allKeys = Object.keys(localStorage);
      for (const key of allKeys) {
        if (!essentialKeys.includes(key)) {
          localStorage.removeItem(key);
        }
      }

      // 3. Clear sessionStorage
      sessionStorage.clear();

      console.log('[CacheReset] ✅ Cache cleared successfully');
      
      // 4. Call callback if provided
      if (onReset) {
        onReset();
      }

      // 5. Reload the app
      notify.success('Cache cleared! Reloading...', { duration: 1500 });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error('[CacheReset] Error:', error);
      notify.error('Failed to clear cache: ' + error.message);
      setIsResetting(false);
    }
  };

  if (variant === 'banner') {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 9999,
          background: 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)',
          color: '#fff',
          padding: '1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
        }}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            ⚠️ COMPILATION ERROR
          </div>
          <div style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', opacity: 0.9 }}>
            {reason || 'The application cache may be corrupted or outdated.'}
          </div>
        </div>
        <button
          onClick={handleReset}
          disabled={isResetting}
          style={{
            padding: '0.5rem 1rem',
            background: '#fff',
            color: '#DC2626',
            border: 'none',
            borderRadius: '4px',
            fontFamily: 'var(--font-monument-bold)',
            fontSize: '0.75rem',
            cursor: isResetting ? 'not-allowed' : 'pointer',
            opacity: isResetting ? 0.6 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          {isResetting ? 'CLEARING...' : 'RESET CACHE'}
        </button>
      </div>
    );
  }

  if (variant === 'minimal') {
    return (
      <button
        onClick={handleReset}
        disabled={isResetting}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#DC2626',
          fontFamily: 'var(--font-monument)',
          fontSize: '0.75rem',
          cursor: isResetting ? 'not-allowed' : 'pointer',
          textDecoration: 'underline',
          padding: '0.25rem',
        }}
      >
        {isResetting ? 'Clearing...' : 'Clear Cache & Retry'}
      </button>
    );
  }

  // Default button variant
  return (
    <button
      onClick={handleReset}
      disabled={isResetting}
      style={{
        padding: '0.75rem 1.5rem',
        background: isResetting
          ? 'linear-gradient(90deg, #9CA3AF 0%, #D1D5DB 100%)'
          : 'linear-gradient(90deg, #EF4444 0%, #DC2626 100%)',
        color: '#fff',
        border: 'none',
        borderRadius: '8px',
        fontFamily: 'var(--font-monument-bold)',
        fontSize: '0.875rem',
        cursor: isResetting ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
      }}
    >
      <span>{isResetting ? '🔄 CLEARING...' : '🗑️ RESET CACHE'}</span>
    </button>
  );
}

/**
 * Hook to detect compilation errors and show reset option
 */
export function useCacheReset() {
  const [showResetPrompt, setShowResetPrompt] = useState(false);
  const [failureCount, setFailureCount] = useState(0);
  const [lastError, setLastError] = useState<string>('');

  const recordFailure = (error: string) => {
    setLastError(error);
    setFailureCount(prev => prev + 1);

    // Show reset prompt after 2 consecutive failures
    if (failureCount >= 1) {
      setShowResetPrompt(true);
      notify.error('Multiple compilation errors detected. Try resetting the cache.', {
        duration: 6000,
      });
    }
  };

  const recordSuccess = () => {
    setFailureCount(0);
    setShowResetPrompt(false);
    setLastError('');
  };

  const isCacheRelatedError = (error: string): boolean => {
    const cacheErrorPatterns = [
      'version mismatch',
      'cache miss',
      'not in manifest',
      'header',
      'uniqueId',
      'persistentId',
      'compilation failed',
      'out of memory',
    ];
    
    const errorLower = error.toLowerCase();
    return cacheErrorPatterns.some(pattern => errorLower.includes(pattern));
  };

  return {
    showResetPrompt,
    failureCount,
    lastError,
    recordFailure,
    recordSuccess,
    isCacheRelatedError,
    resetPrompt: showResetPrompt && (
      <CacheResetButton 
        variant="banner" 
        reason={lastError}
      />
    ),
  };
}
