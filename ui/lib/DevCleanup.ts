/**
 * DevCleanup.ts
 * 
 * Developer utilities for complete environment reset and DID management.
 * Handles browser storage cleanup, on-chain DID revocation, and testing workflows.
 * 
 * Usage in browser console:
 *   window.DevCleanup.clearAllStorage()
 *   window.DevCleanup.generateTestKey()
 *   window.DevCleanup.revokeDID(privateKeyBase58)
 */

import { PrivateKey, PublicKey, Poseidon, MerkleMapWitness, Field } from 'o1js';
import { getContractInterface, resetContractInterface } from './ContractInterface';

export const DevCleanup = {
  /**
   * NUCLEAR OPTION: Clear ALL browser storage for this origin
   * Removes localStorage, sessionStorage, IndexedDB, Cache Storage, Service Workers
   * 
   * ⚠️ WARNING: This deletes ALL site data. Only use in dev/test environments!
   */
  async clearAllStorage(): Promise<void> {
    console.log('🧹 [DevCleanup] Starting complete storage cleanup...');
    
    try {
      // 1. Clear localStorage & sessionStorage
      console.log('1/5 Clearing localStorage & sessionStorage...');
      localStorage.clear();
      sessionStorage.clear();
      console.log('  ✅ localStorage & sessionStorage cleared');

      // 2. Clear Cache Storage
      console.log('2/5 Clearing Cache Storage...');
      if (window.caches) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log(`  ✅ Cleared ${cacheNames.length} cache storages:`, cacheNames);
      }

      // 3. Unregister Service Workers
      console.log('3/5 Unregistering service workers...');
      if (navigator.serviceWorker) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
        console.log(`  ✅ Unregistered ${regs.length} service workers`);
      }

      // 4. Delete ALL IndexedDB databases (removes o1js/Merkle caches)
      console.log('4/5 Deleting IndexedDB databases...');
      if (indexedDB && (indexedDB as any).databases) {
        const dbs = await (indexedDB as any).databases();
        await Promise.all(dbs.map((db: any) => {
          if (db.name) {
            console.log(`  Deleting IndexedDB: ${db.name}`);
            return new Promise<void>((resolve, reject) => {
              const req = indexedDB.deleteDatabase(db.name);
              req.onsuccess = () => resolve();
              req.onerror = () => reject(req.error);
              req.onblocked = () => {
                console.warn(`  ⚠️  Delete blocked for ${db.name}, but continuing...`);
                resolve();
              };
            });
          }
          return Promise.resolve();
        }));
        console.log('  ✅ IndexedDB databases deleted');
      } else {
        // Fallback: Try common database names
        const candidates = ['o1js-cache', 'merkleCache', 'mina-cache', 'MinaIdCache', 'key-storage'];
        await Promise.all(candidates.map(name => {
          console.log(`  Attempting to delete: ${name}`);
          return new Promise<void>(resolve => {
            const req = indexedDB.deleteDatabase(name);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve();
            req.onblocked = () => resolve();
          });
        }));
        console.log('  ✅ Fallback IndexedDB cleanup completed');
      }

      // 5. Clear cookies (best-effort from JS)
      console.log('5/5 Clearing cookies...');
      document.cookie.split(';').forEach(c => {
        const name = c.split('=')[0].trim();
        document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
      });
      console.log('  ✅ Cookies cleared (HttpOnly cookies require manual removal)');

      // 6. Reset contract interface singleton
      console.log('6/6 Resetting contract interface singleton...');
      resetContractInterface();
      console.log('  ✅ Contract interface reset');

      console.log('\n✅ ALL DONE: Complete storage cleanup finished!');
      console.log('\n📋 Next steps:');
      console.log('  1. Hard refresh the page (Ctrl+Shift+R)');
      console.log('  2. Reconnect Auro Wallet');
      console.log('  3. Generate new proofs or use a fresh test key');
      console.log('\n💡 To generate a test key: window.DevCleanup.generateTestKey()');
      
    } catch (err) {
      console.error('❌ Error during storage cleanup:', err);
      throw err;
    }
  },

  /**
   * Generate a fresh random test keypair
   * Use this for testing to avoid DID collisions
   * 
   * @returns Object with private key and public key in base58 format
   */
  generateTestKey(): { privateKey: string; publicKey: string; did: string } {
    console.log('🔑 [DevCleanup] Generating fresh test keypair...');
    
    const sk = PrivateKey.random();
    const pk = sk.toPublicKey();
    
    const result = {
      privateKey: sk.toBase58(),
      publicKey: pk.toBase58(),
      did: `did:mina:${pk.toBase58()}`,
    };
    
    console.log('✅ Test key generated:');
    console.log('  Private Key (SAVE THIS):', result.privateKey);
    console.log('  Public Key:', result.publicKey);
    console.log('  DID:', result.did);
    console.log('\n⚠️  Save the private key if you want to revoke/update this DID later!');
    
    return result;
  },

  /**
   * Revoke an on-chain DID (requires private key)
   * Use this to clear a registered DID slot so you can re-register
   * 
   * @param privateKeyBase58 - The private key of the DID to revoke (base58 format)
   * @returns Transaction result
   */
  async revokeDID(privateKeyBase58: string): Promise<any> {
    console.log('🗑️  [DevCleanup] Revoking DID...');
    
    try {
      const sk = PrivateKey.fromBase58(privateKeyBase58);
      const pk = sk.toPublicKey();
      
      console.log('  DID to revoke:', `did:mina:${pk.toBase58()}`);
      console.log('  Public Key:', pk.toBase58());
      
      // Get contract interface
      const contractInterface = await getContractInterface();
      
      // Ensure contracts are compiled first
      console.log('  Compiling contracts (this may take a moment)...');
      await (contractInterface as any).ensureCompiled();
      
      // Create Merkle witness
      // Note: For revocation, we need a witness proving the DID EXISTS (not empty)
      // This requires the current on-chain state
      console.log('  Creating Merkle witness...');
      
      const { MerkleMap } = await import('o1js');
      const map = new MerkleMap();
      const keyHash = Poseidon.hash(pk.toFields());
      const witness = map.getWitness(keyHash);
      
      console.log('  ⚠️  Note: This uses an empty witness. If your contract requires');
      console.log('     the actual on-chain state, you\'ll need full state reconstruction.');
      console.log('  ⚠️  For production, fetch the current Merkle tree state from contract.');
      
      // Call revokeDID with fee included
      console.log('  Sending revocation transaction (fee: 0.1 MINA)...');
      const result = await contractInterface.revokeDID(pk, sk, witness);
      
      if (result.success) {
        console.log('✅ DID revoked successfully!');
        console.log('  Transaction hash:', result.hash);
        console.log('  Explorer:', result.explorerUrl || `https://minascan.io/devnet/tx/${result.hash}`);
        console.log('\n💡 You can now re-register this DID with a new proof');
      } else {
        console.error('❌ Revocation failed:', result.error);
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ Error revoking DID:', error.message);
      throw error;
    }
  },

  /**
   * RECOMMENDED: Generate a new key instead of revoking
   * This is faster and doesn't require transactions
   * 
   * Use this when you see "DID already registered" errors
   */
  quickFix(): { privateKey: string; publicKey: string; did: string } {
    console.log('🔧 [DevCleanup] QUICK FIX for "DID Already Registered"');
    console.log('');
    console.log('Instead of revoking (which requires transactions and fees),');
    console.log('we\'ll generate a fresh key for testing:');
    console.log('');
    
    const result = this.generateTestKey();
    
    console.log('');
    console.log('📋 Use this key in your tests:');
    console.log('  1. Copy the public key above');
    console.log('  2. Use it to generate proofs');
    console.log('  3. Each test uses a different DID = no collisions!');
    console.log('');
    console.log('💡 This is MUCH faster than revoke + re-register');
    
    return result;
  },

  /**
   * Check if a DID can be registered with registerDIDSimple
   * 
   * @param publicKeyBase58 - Optional: specific public key to check, or null for wallet
   * @returns Eligibility information
   */
  async checkRegistrationEligibility(publicKeyBase58?: string): Promise<any> {
    console.log('🔍 [DevCleanup] Checking registration eligibility...');
    
    try {
      const contractInterface = await getContractInterface();
      const { canRegisterWithSimpleMethod } = await import('./MerkleStateManager');
      
      const eligibility = await canRegisterWithSimpleMethod(
        contractInterface['networkConfig'].didRegistryAddress,
        (contractInterface as any).didRegistry
      );
      
      console.log('📊 Contract State:');
      console.log('  Can register:', eligibility.canRegister ? '✅ YES' : '❌ NO');
      console.log('  Reason:', eligibility.reason);
      console.log('  Current root:', eligibility.currentRoot);
      console.log('  Empty root:', eligibility.emptyRoot);
      console.log('  Is empty:', eligibility.currentRoot === eligibility.emptyRoot);
      
      if (!eligibility.canRegister) {
        console.log('\n🔧 SOLUTIONS:');
        console.log('  1. Deploy a fresh contract (requires contract admin)');
        console.log('  2. Use a new test key: window.DevCleanup.generateTestKey()');
        console.log('  3. Revoke existing DID: window.DevCleanup.revokeDID(privateKey)');
      }
      
      return eligibility;
    } catch (error: any) {
      console.error('❌ Error checking eligibility:', error.message);
      throw error;
    }
  },

  /**
   * Complete reset workflow: Clear everything + generate new key
   * 
   * @returns New test key
   */
  async completeReset(): Promise<any> {
    console.log('🔄 [DevCleanup] COMPLETE RESET...');
    console.log('');
    
    // Step 1: Clear storage
    await this.clearAllStorage();
    
    console.log('');
    console.log('━'.repeat(60));
    console.log('');
    
    // Step 2: Generate new key
    const testKey = this.generateTestKey();
    
    console.log('');
    console.log('━'.repeat(60));
    console.log('');
    console.log('✅ RESET COMPLETE!');
    console.log('');
    console.log('📝 Action Items:');
    console.log('  1. Hard refresh: Ctrl+Shift+R');
    console.log('  2. Copy the private key above (you\'ll need it later)');
    console.log('  3. Use the public key to generate proofs');
    console.log('');
    
    return testKey;
  },

  /**
   * Show help / available commands
   */
  help(): void {
    console.log('═'.repeat(60));
    console.log('🛠️  MinaID Dev Cleanup Utilities');
    console.log('═'.repeat(60));
    console.log('');
    console.log('Available commands:');
    console.log('');
    console.log('⭐ 1. QUICK FIX for "DID Already Registered" (RECOMMENDED):');
    console.log('   window.DevCleanup.quickFix()');
    console.log('   → Generates new key instantly, no transactions needed');
    console.log('');
    console.log('2. Clear all storage (browser cache, IndexedDB, etc.):');
    console.log('   await window.DevCleanup.clearAllStorage()');
    console.log('');
    console.log('3. Generate fresh test keypair:');
    console.log('   window.DevCleanup.generateTestKey()');
    console.log('');
    console.log('4. Revoke a DID (requires private key + fees):');
    console.log('   await window.DevCleanup.revokeDID("PrivateKeyBase58Here")');
    console.log('   ⚠️  Requires 0.1 MINA fee and ~2 min to prove');
    console.log('');
    console.log('5. Check if registration is possible:');
    console.log('   await window.DevCleanup.checkRegistrationEligibility()');
    console.log('');
    console.log('6. Complete reset (clear + new key):');
    console.log('   await window.DevCleanup.completeReset()');
    console.log('');
    console.log('7. Show this help:');
    console.log('   window.DevCleanup.help()');
    console.log('');
    console.log('═'.repeat(60));
    console.log('');
    console.log('💡 BEST PRACTICE: Use quickFix() or generateTestKey()');
    console.log('   instead of revoke. It\'s instant and free!');
    console.log('');
  },
};

// Make available in browser console
if (typeof window !== 'undefined') {
  (window as any).DevCleanup = DevCleanup;
  console.log('🛠️  DevCleanup utilities loaded! Type: window.DevCleanup.help()');
}

export default DevCleanup;
