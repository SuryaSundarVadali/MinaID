/**
 * CacheHelpers.ts
 * 
 * Browser console helpers for debugging SESSION cache (no localStorage)
 * 
 * Usage in browser console:
 *   window.MinaIDCache.clearSession()
 *   window.MinaIDCache.info()
 */

import { clearProofCache, clearUserProofCache, getCacheStats } from './SmartProofGenerator';

export const CacheHelpers = {
  /**
   * Clear session cache (memory only)
   */
  clearSession(): void {
    clearProofCache();
    console.log('✅ Session cache cleared! Proofs will be regenerated.');
  },

  /**
   * Clear cached proofs for specific user
   */
  clearUser(userIdentifier: string): void {
    clearUserProofCache(userIdentifier);
    console.log(`✅ Cleared session proofs for user: ${userIdentifier}`);
  },

  /**
   * Show session cache info
   */
  info(): void {
    const stats = getCacheStats();
    console.log('=== MinaID Session Cache ===');
    console.log(`Total cached proofs: ${stats.size}`);
    console.log(`Cache entries: ${stats.entries.length}`);
    if (stats.entries.length > 0) {
      console.log('Entry hashes:', stats.entries);
    }
    console.log('\nℹ️  Session cache is cleared on page refresh');
    console.log('ℹ️  No localStorage persistence (prevents stale cache issues)');
  },

  /**
   * Show cache statistics (legacy name, same as info)
   */
  stats(): void {
    this.info();
  },

  /**
   * DEPRECATED: No localStorage usage
   */
  listProofs(): void {
    console.warn('⚠️  listProofs() is deprecated - no localStorage usage');
    console.log('Use: window.MinaIDCache.info() instead');
    this.info();
  },

  /**
   * DEPRECATED: No localStorage to clear
   */
  clearAll(): void {
    console.warn('⚠️  clearAll() renamed to clearSession()');
    this.clearSession();
  },

  /**
   * DEPRECATED: No localStorage/IndexedDB to clear
   */
  clearEverything(): void {
    console.warn('⚠️  clearEverything() is deprecated - use clearSession()');
    console.log('ℹ️  Only session memory cache exists now');
    this.clearSession();
  },

  /**
   * Show help
   */
  help(): void {
    console.log('=== MinaID Cache Helpers ===');
    console.log('');
    console.log('Available commands:');
    console.log('  window.MinaIDCache.info()           - Show cache statistics');
    console.log('  window.MinaIDCache.clearSession()   - Clear session cache');
    console.log('  window.MinaIDCache.clearUser(addr)  - Clear user-specific cache');
    console.log('  window.MinaIDCache.help()           - Show this help');
  },
};

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).MinaIDCache = CacheHelpers;
  console.log('\n🔧 MinaID Cache Helpers loaded!');
  console.log('   Available commands:');
  console.log('     window.MinaIDCache.clearAll()      - Clear all proof caches');
  console.log('     window.MinaIDCache.listProofs()    - List cached proofs');
  console.log('     window.MinaIDCache.stats()         - Show cache statistics');
  console.log('     window.MinaIDCache.clearEverything() - Nuclear option\n');
}
