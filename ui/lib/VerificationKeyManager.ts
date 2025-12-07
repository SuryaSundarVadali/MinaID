/**
 * VerificationKeyManager - Manages verification key consistency for ZK proofs
 * 
 * This module ensures verification keys remain consistent between proof generation
 * and verification, preventing "stale verification key" errors.
 */

import { Cache } from 'o1js';

interface VerificationKeyData {
  hash: string;
  data: string;
  timestamp: number;
}

interface StoredKeys {
  [programName: string]: VerificationKeyData;
}

const VK_STORAGE_KEY = 'mina_verification_keys';
const VK_HASH_KEY = 'mina_vk_hashes';

export class VerificationKeyManager {
  private static instance: VerificationKeyManager;
  private keys: StoredKeys = {};
  private initialized = false;

  private constructor() {}

  static getInstance(): VerificationKeyManager {
    if (!VerificationKeyManager.instance) {
      VerificationKeyManager.instance = new VerificationKeyManager();
    }
    return VerificationKeyManager.instance;
  }

  /**
   * Initialize the manager, loading any persisted keys
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem(VK_STORAGE_KEY);
        if (stored) {
          this.keys = JSON.parse(stored);
          console.log('[VKManager] Loaded stored verification keys');
        }
      }
    } catch (error) {
      console.warn('[VKManager] Failed to load stored keys:', error);
    }

    this.initialized = true;
  }

  /**
   * Store a verification key for a program
   */
  storeKey(programName: string, verificationKey: { hash: { toString(): string }, data: string }): void {
    const hash = verificationKey.hash.toString();
    
    this.keys[programName] = {
      hash,
      data: verificationKey.data,
      timestamp: Date.now()
    };

    this.persist();
    console.log(`[VKManager] Stored key for ${programName}: ${hash.substring(0, 16)}...`);
  }

  /**
   * Get stored verification key for a program
   */
  getKey(programName: string): VerificationKeyData | null {
    return this.keys[programName] || null;
  }

  /**
   * Get just the hash for a program's verification key
   */
  getKeyHash(programName: string): string | null {
    const key = this.keys[programName];
    return key ? key.hash : null;
  }

  /**
   * Check if a verification key matches the stored one
   */
  validateKey(programName: string, verificationKey: { hash: { toString(): string } }): boolean {
    const stored = this.keys[programName];
    if (!stored) {
      console.warn(`[VKManager] No stored key for ${programName}`);
      return true; // No stored key, can't validate
    }

    const currentHash = verificationKey.hash.toString();
    const matches = stored.hash === currentHash;

    if (!matches) {
      console.error(`[VKManager] Key mismatch for ${programName}!`);
      console.error(`  Stored: ${stored.hash.substring(0, 32)}...`);
      console.error(`  Current: ${currentHash.substring(0, 32)}...`);
    }

    return matches;
  }

  /**
   * Clear stored keys (use when cache is regenerated)
   */
  clearKeys(): void {
    this.keys = {};
    this.persist();
    console.log('[VKManager] Cleared all stored keys');
  }

  /**
   * Clear keys for a specific program
   */
  clearKey(programName: string): void {
    delete this.keys[programName];
    this.persist();
    console.log(`[VKManager] Cleared key for ${programName}`);
  }

  /**
   * Export all key hashes for embedding in proofs
   */
  exportHashes(): { [name: string]: string } {
    const hashes: { [name: string]: string } = {};
    for (const [name, data] of Object.entries(this.keys)) {
      hashes[name] = data.hash;
    }
    return hashes;
  }

  /**
   * Persist keys to localStorage
   */
  private persist(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        localStorage.setItem(VK_STORAGE_KEY, JSON.stringify(this.keys));
      }
    } catch (error) {
      console.warn('[VKManager] Failed to persist keys:', error);
    }
  }

  /**
   * Get diagnostic information
   */
  getDiagnostics(): {
    initialized: boolean;
    keyCount: number;
    keys: { name: string; hash: string; age: string }[];
  } {
    const now = Date.now();
    return {
      initialized: this.initialized,
      keyCount: Object.keys(this.keys).length,
      keys: Object.entries(this.keys).map(([name, data]) => ({
        name,
        hash: data.hash.substring(0, 32) + '...',
        age: `${Math.round((now - data.timestamp) / 1000 / 60)} minutes`
      }))
    };
  }
}

/**
 * Helper to compute a simple hash of the verification key data
 */
export function computeKeyFingerprint(vkData: string): string {
  let hash = 0;
  for (let i = 0; i < vkData.length; i++) {
    const char = vkData.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

// Export singleton instance
export const vkManager = VerificationKeyManager.getInstance();
