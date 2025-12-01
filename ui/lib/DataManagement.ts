
/**
 * DataManagement.ts
 * 
 * Utilities for managing MinaID application data
 * - Clear all user data
 * - Enforce passkey requirements
 * - Data validation
 */

/**
 * Clear all MinaID data from localStorage
 * This includes:
 * - Wallet connections
 * - Passkeys
 * - Aadhar data
 * - Proofs
 * - Session data
 * - Merkle tree state
 * - Encrypted keys
 * - Transaction records
 */
export function clearAllData(): void {
  console.log('[DataManagement] Clearing all MinaID data...');
  
  const keysToRemove: string[] = [];
  
  // Find all MinaID-related keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (
      key.startsWith('minaid') ||
      key.startsWith('aadhar_') ||
      key.startsWith('proof_') ||
      key.startsWith('encrypted_') ||
      key.includes('wallet') ||
      key.includes('session') ||
      key.includes('did') ||
      key.includes('merkle') ||
      key.includes('passkey') ||
      key.includes('private_key')
    )) {
      keysToRemove.push(key);
    }
  }
  
  // Remove all found keys
  keysToRemove.forEach(key => {
    console.log(`  Removing: ${key}`);
    localStorage.removeItem(key);
  });
  
  // Reset the in-memory MerkleMap state
  try {
    // Dynamic import to avoid circular dependency
    import('./BlockchainHelpers').then(({ resetMerkleMapState }) => {
      resetMerkleMapState();
    }).catch(() => {
      // If import fails, just remove the key directly
      localStorage.removeItem('minaid_merkle_map_keys');
    });
  } catch (e) {
    localStorage.removeItem('minaid_merkle_map_keys');
  }
  
  console.log(`[DataManagement] ✓ Cleared ${keysToRemove.length} items (including Merkle tree state)`);
}

/**
 * Check if a wallet has a registered passkey
 * @param walletAddress - Wallet address or DID
 * @returns true if passkey exists, false otherwise
 */
export function hasPasskey(walletAddress: string): boolean {
  const prefix = `minaid:passkey:${walletAddress}:`;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Get passkey ID for a wallet
 * @param walletAddress - Wallet address or DID
 * @returns Passkey ID if exists, null otherwise
 */
export function getPasskeyId(walletAddress: string): string | null {
  const prefix = `minaid:passkey:${walletAddress}:`;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      const passkeyId = key.substring(prefix.length);
      return passkeyId;
    }
  }
  
  return null;
}

/**
 * Count passkeys for a wallet
 * @param walletAddress - Wallet address or DID
 * @returns Number of passkeys registered
 */
export function countPasskeys(walletAddress: string): number {
  const prefix = `minaid:passkey:${walletAddress}:`;
  let count = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Enforce one-passkey-per-wallet policy
 * Removes all passkeys for a wallet except the most recent one
 * @param walletAddress - Wallet address or DID
 */
export function enforceOnePasskeyPerWallet(walletAddress: string): void {
  const prefix = `minaid:passkey:${walletAddress}:`;
  const passkeys: { key: string; createdAt: number }[] = [];
  
  // Find all passkeys for this wallet
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      try {
        const data = JSON.parse(localStorage.getItem(key)!);
        passkeys.push({
          key,
          createdAt: data.createdAt || 0
        });
      } catch (err) {
        console.error('Failed to parse passkey:', err);
      }
    }
  }
  
  // Sort by creation time (newest first)
  passkeys.sort((a, b) => b.createdAt - a.createdAt);
  
  // Remove all except the first (newest)
  for (let i = 1; i < passkeys.length; i++) {
    console.log(`[DataManagement] Removing duplicate passkey: ${passkeys[i].key}`);
    localStorage.removeItem(passkeys[i].key);
  }
  
  if (passkeys.length > 1) {
    console.log(`[DataManagement] ✓ Enforced one-passkey-per-wallet: kept ${passkeys[0].key}`);
  }
}

/**
 * Validate passkey requirement before login
 * @param walletAddress - Wallet address or DID
 * @throws Error if no passkey registered
 */
export function validatePasskeyRequired(walletAddress: string): void {
  if (!hasPasskey(walletAddress)) {
    throw new Error('Passkey is required. Please create a passkey during signup.');
  }
}

/**
 * Get data summary for debugging
 */
export function getDataSummary(): {
  totalKeys: number;
  wallets: number;
  passkeys: number;
  proofs: number;
  aadharData: number;
} {
  let wallets = 0;
  let passkeys = 0;
  let proofs = 0;
  let aadharData = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)!;
    if (key.includes('wallet')) wallets++;
    if (key.includes('passkey')) passkeys++;
    if (key.startsWith('proof_')) proofs++;
    if (key.startsWith('aadhar_')) aadharData++;
  }
  
  return {
    totalKeys: localStorage.length,
    wallets,
    passkeys,
    proofs,
    aadharData
  };
}
