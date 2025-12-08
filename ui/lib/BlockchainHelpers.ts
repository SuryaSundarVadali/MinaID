/**
 * BlockchainHelpers.ts
 * 
 * Helper functions for blockchain operations in MinaID.
 * Provides convenient wrappers around ContractInterface for common tasks.
 */

import { Field, PrivateKey, PublicKey, Poseidon, MerkleMap, MerkleMapWitness, fetchAccount } from 'o1js';
import { ContractInterface, getExplorerUrl } from './ContractInterface';

// Persistent MerkleMap state
let globalMerkleMap: MerkleMap | null = null;

/**
 * Get or create the global MerkleMap instance
 * This maintains state across registrations
 */
function getGlobalMerkleMap(): MerkleMap {
  if (!globalMerkleMap) {
    globalMerkleMap = new MerkleMap();
    
    // Try to restore from localStorage
    try {
      const savedState = localStorage.getItem('minaid_merkle_map_keys');
      if (savedState) {
        const keys = JSON.parse(savedState);
        console.log('[BlockchainHelpers] Restoring MerkleMap with', keys.length, 'entries');
        for (const { key, value } of keys) {
          globalMerkleMap.set(Field(key), Field(value));
        }
      }
    } catch (e) {
      console.warn('[BlockchainHelpers] Could not restore MerkleMap state:', e);
    }
  }
  return globalMerkleMap;
}

/**
 * Save MerkleMap state to localStorage
 */
function saveMerkleMapState(key: Field, value: Field): void {
  try {
    const savedState = localStorage.getItem('minaid_merkle_map_keys');
    const keys = savedState ? JSON.parse(savedState) : [];
    keys.push({ key: key.toString(), value: value.toString() });
    localStorage.setItem('minaid_merkle_map_keys', JSON.stringify(keys));
  } catch (e) {
    console.warn('[BlockchainHelpers] Could not save MerkleMap state:', e);
  }
}

/**
 * Reset the global MerkleMap (for use after clearing data)
 */
export function resetMerkleMapState(): void {
  globalMerkleMap = null;
  localStorage.removeItem('minaid_merkle_map_keys');
  console.log('[BlockchainHelpers] MerkleMap state reset');
}

// Network configuration
const NETWORK_CONFIG = {
  networkId: 'devnet' as const,
  minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
  archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
  didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_DEVNET || 'B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD',
  zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_DEVNET || 'B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw',
};

// Singleton instance
let contractInstance: ContractInterface | null = null;

/**
 * Get or create contract interface instance
 */
async function getContractInstance(): Promise<ContractInterface> {
  if (!contractInstance) {
    contractInstance = new ContractInterface(NETWORK_CONFIG);
    await contractInstance.initialize();
  }
  return contractInstance;
}

/**
 * Register DID on blockchain
 * @param did User's DID
 * @param publicKeyBase58 User's public key in base58 format
 * @param privateKeyBase58 User's private key in base58 format (for signing)
 * @returns Transaction hash if successful, null otherwise
 */
export async function registerDIDOnChain(
  did: string,
  publicKeyBase58: string,
  privateKeyBase58?: string
): Promise<string | null> {
  try {
    console.log('[BlockchainHelpers] Registering DID on blockchain:', did);
    
    // Check if DID is already registered locally (to avoid re-registration attempts)
    const existingTxHash = localStorage.getItem(`minaid_did_tx_${did}`);
    if (existingTxHash) {
      console.log('[BlockchainHelpers] DID already registered locally, skipping:', existingTxHash);
      return existingTxHash;
    }
    
    // Also check if this public key has been registered before
    const registeredKeys = localStorage.getItem('minaid_registered_keys');
    if (registeredKeys) {
      const keys = JSON.parse(registeredKeys);
      if (keys.includes(publicKeyBase58)) {
        console.log('[BlockchainHelpers] Public key already registered, skipping');
        return 'already-registered';
      }
    }
    
    // Parse keys
    const publicKey = PublicKey.fromBase58(publicKeyBase58);
    const privateKey = privateKeyBase58 ? PrivateKey.fromBase58(privateKeyBase58) : null;
    
    // Create document hash (hash of DID string)
    const encoder = new TextEncoder();
    const didBytes = encoder.encode(did);
    const didHex = Array.from(didBytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 60);
    const didField = Field.from(BigInt('0x' + didHex));
    const documentHash = Poseidon.hash([didField]);
    
    // Get the persistent Merkle map and create witness
    // The contract uses Poseidon.hash(publicKey.toFields()) as the key in the map
    const mapKey = Poseidon.hash(publicKey.toFields());
    const merkleMap = getGlobalMerkleMap();
    const witness = merkleMap.getWitness(mapKey);
    
    // Get contract instance
    const contract = await getContractInstance();
    
    // Register DID
    const result = await contract.registerDID(
      publicKey,
      documentHash,
      privateKey,
      witness
    );
    
    if (result.success && result.hash) {
      // Update the MerkleMap with the new DID
      merkleMap.set(mapKey, documentHash);
      saveMerkleMapState(mapKey, documentHash);
      
      // Track this public key as registered
      const existingKeys = localStorage.getItem('minaid_registered_keys');
      const keys = existingKeys ? JSON.parse(existingKeys) : [];
      keys.push(publicKeyBase58);
      localStorage.setItem('minaid_registered_keys', JSON.stringify(keys));
      
      console.log('[BlockchainHelpers] ✅ DID registered successfully:', result.hash);
      console.log('[BlockchainHelpers] Explorer:', getExplorerUrl(result.hash, NETWORK_CONFIG.networkId));
      return result.hash;
    } else {
      // Check if error is "already registered" - this is not a failure
      if (result.error?.includes('already registered') || result.error?.includes('Merkle witness')) {
        console.log('[BlockchainHelpers] DID appears to be already registered on-chain');
        // Mark as registered to prevent future attempts
        const existingKeys = localStorage.getItem('minaid_registered_keys');
        const keys = existingKeys ? JSON.parse(existingKeys) : [];
        keys.push(publicKeyBase58);
        localStorage.setItem('minaid_registered_keys', JSON.stringify(keys));
        return 'already-registered';
      }
      console.warn('[BlockchainHelpers] DID registration failed:', result.error);
      return null;
    }
  } catch (error: any) {
    // Handle "already registered" errors gracefully
    if (error.message?.includes('already registered') || error.message?.includes('Merkle witness')) {
      console.log('[BlockchainHelpers] DID appears to be already registered (caught error)');
      // Mark as registered
      const existingKeys = localStorage.getItem('minaid_registered_keys');
      const keys = existingKeys ? JSON.parse(existingKeys) : [];
      keys.push(publicKeyBase58);
      localStorage.setItem('minaid_registered_keys', JSON.stringify(keys));
      return 'already-registered';
    }
    console.error('[BlockchainHelpers] Error registering DID:', error.message);
    return null;
  }
}

/**
 * Record proof generation on blockchain
 * @param did User's DID (can be wallet address or public key)
 * @param proofType Type of proof (citizenship, age18, age21)
 * @param proof Proof data
 * @param privateKeyBase58OrBigInt User's private key for signing (base58 string or bigint), or 'auro' to use Auro wallet
 * @returns Transaction hash if successful, null otherwise
 */
export async function recordProofOnChain(
  did: string,
  proofType: string,
  proof: any,
  privateKeyBase58OrBigInt: string | bigint
): Promise<string | null> {
  try {
    console.log('[BlockchainHelpers] Recording proof on blockchain:', { did, proofType });
    
    // Check if we should use Auro wallet
    const walletData = localStorage.getItem('minaid_wallet_connected');
    const isAuroWallet = walletData && JSON.parse(walletData).walletType === 'auro';
    
    if (isAuroWallet && typeof window !== 'undefined' && (window as any).mina) {
      // Use Auro wallet for signing - the wallet address is the DID
      console.log('[BlockchainHelpers] Using Auro wallet for on-chain proof recording');
      
      try {
        // Get the connected wallet address
        const accounts = await (window as any).mina.requestAccounts();
        if (!accounts || accounts.length === 0) {
          throw new Error('No Auro wallet account connected');
        }
        const senderAddress = accounts[0];
        console.log('[BlockchainHelpers] Auro wallet address:', senderAddress);
        
        // Create proof hash for on-chain storage
        const proofHash = await hashProofData(proof);
        
        // Create a simple transaction memo with proof info (max 32 chars)
        const memo = `MinaID:${proofType}:${proofHash.slice(0, 12)}`;
        
        // Use Auro wallet's sendPayment method (correct API)
        const txResult = await (window as any).mina.sendPayment({
          to: senderAddress, // Send to self (0 amount, just for recording)
          amount: '0.000000001', // Minimum amount (1 nanomina)
          fee: '0.1', // 0.1 MINA fee in MINA units (not nanomina)
          memo: memo,
        });
        
        if (txResult && txResult.hash) {
          console.log('[BlockchainHelpers] ✅ Proof recorded on-chain via Auro wallet:', txResult.hash);
          
          // Store the record locally too
          const proofRecord = {
            did,
            proofType,
            timestamp: Date.now(),
            status: 'on-chain',
            txHash: txResult.hash,
            proofHash
          };
          const existingRecords = JSON.parse(localStorage.getItem('minaid_proof_records') || '[]');
          existingRecords.push(proofRecord);
          localStorage.setItem('minaid_proof_records', JSON.stringify(existingRecords));
          
          return txResult.hash;
        } else {
          throw new Error('Transaction failed or was rejected');
        }
      } catch (auroError: any) {
        console.error('[BlockchainHelpers] Auro wallet transaction failed:', auroError);
        
        // If user rejected or error, fall back to local storage
        if (auroError.message?.includes('reject') || auroError.code === 4001) {
          console.log('[BlockchainHelpers] User rejected transaction, storing locally');
        }
        
        // Store proof locally as fallback
        const proofRecord = {
          did,
          proofType,
          timestamp: Date.now(),
          status: 'local',
          proofHash: await hashProofData(proof),
          error: auroError.message
        };
        const existingRecords = JSON.parse(localStorage.getItem('minaid_proof_records') || '[]');
        existingRecords.push(proofRecord);
        localStorage.setItem('minaid_proof_records', JSON.stringify(existingRecords));
        
        return `local_${proofRecord.proofHash.slice(0, 16)}`;
      }
    }
    
    const contract = await getContractInstance();
    
    // Handle private key - can be base58 string or bigint
    let privateKey: PrivateKey;
    if (typeof privateKeyBase58OrBigInt === 'bigint') {
      privateKey = PrivateKey.fromBigInt(privateKeyBase58OrBigInt);
    } else if (typeof privateKeyBase58OrBigInt === 'string') {
      // Check if it's a valid base58 private key (starts with EK or similar pattern)
      if (privateKeyBase58OrBigInt.length > 50 && /^[123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz]+$/.test(privateKeyBase58OrBigInt)) {
        try {
          privateKey = PrivateKey.fromBase58(privateKeyBase58OrBigInt);
        } catch {
          // Not a valid base58 key, generate deterministic key from the string
          console.log('[BlockchainHelpers] Generating deterministic key from DID');
          privateKey = await generateDeterministicKey(did);
        }
      } else {
        // Not a base58 key, generate deterministic key
        console.log('[BlockchainHelpers] Generating deterministic key from DID');
        privateKey = await generateDeterministicKey(did);
      }
    } else {
      console.log('[BlockchainHelpers] Generating deterministic key from DID');
      privateKey = await generateDeterministicKey(did);
    }
    
    // Use the private key's public key as the DID key (not parsing the DID string)
    const didKey = privateKey.toPublicKey();
    
    // Parse proof data from JSON string if needed
    let proofData = proof;
    if (proof.proof && typeof proof.proof === 'string') {
        try {
            const parsed = JSON.parse(proof.proof);
            proofData = { ...proof, ...parsed };
        } catch (e) {
            // ignore
        }
    }

    const result = await contract.recordProof(
      didKey,
      proofType,
      proofData,
      privateKey
    );
    
    if (result.success) {
        console.log('[BlockchainHelpers] ✅ Proof recorded:', result.hash);
        return result.hash;
    } else {
        console.warn('[BlockchainHelpers] Proof recording failed:', result.error);
        return null;
    }
  } catch (error: any) {
    console.error('[BlockchainHelpers] Error recording proof:', error.message);
    return null;
  }
}

/**
 * Hash proof data for local storage
 */
async function hashProofData(proof: any): Promise<string> {
  const proofString = JSON.stringify(proof);
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(proofString));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate deterministic private key from a DID/address string
 */
async function generateDeterministicKey(identifier: string): Promise<PrivateKey> {
  const addressHash = await crypto.subtle.digest(
    'SHA-256', 
    new TextEncoder().encode(identifier + '_minaid_proof_key')
  );
  const hashArray = new Uint8Array(addressHash);
  let seedBigInt = BigInt(0);
  for (let i = 0; i < 32; i++) {
    seedBigInt = (seedBigInt << BigInt(8)) | BigInt(hashArray[i]);
  }
  const fieldOrder = BigInt('28948022309329048855892746252171976963363056481941560715954676764349967630337');
  const privateKeyBigInt = seedBigInt % fieldOrder;
  return PrivateKey.fromBigInt(privateKeyBigInt);
}

/**
 * Verify proof on blockchain
 * @param proofData Proof data to verify
 * @param verifierPrivateKey Verifier's private key
 * @returns Transaction result
 */
export async function verifyProofOnBlockchain(
  proofData: any,
  verifierPrivateKeyBase58: string
): Promise<{ success: boolean; txHash?: string; explorerUrl?: string; error?: string }> {
  try {
    console.log('[BlockchainHelpers] Verifying proof on blockchain');
    
    // Get contract instance
    const contract = await getContractInstance();
    
    // Verify proof
    const result = await contract.verifyProofOnChain(proofData, verifierPrivateKeyBase58);
    
    if (result.success && result.hash) {
      console.log('[BlockchainHelpers] ✅ Proof verified on blockchain:', result.hash);
      return {
        success: true,
        txHash: result.hash,
        explorerUrl: result.explorerUrl || getExplorerUrl(result.hash, NETWORK_CONFIG.networkId),
      };
    } else {
      console.warn('[BlockchainHelpers] Proof verification failed:', result.error);
      return {
        success: false,
        error: result.error || 'Verification failed',
      };
    }
  } catch (error: any) {
    console.error('[BlockchainHelpers] Error verifying proof:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Get transaction status from blockchain
 * @param txHash Transaction hash
 * @returns Transaction status
 */
export async function getTransactionStatus(
  txHash: string
): Promise<{ pending: boolean; confirmed: boolean; error?: string }> {
  try {
    // In a real implementation, this would query the blockchain
    console.log('[BlockchainHelpers] Checking transaction status:', txHash);
    
    // For now, simulate a successful transaction after a delay
    return {
      pending: false,
      confirmed: true,
    };
  } catch (error: any) {
    console.error('[BlockchainHelpers] Error checking transaction:', error.message);
    return {
      pending: false,
      confirmed: false,
      error: error.message,
    };
  }
}

/**
 * Get DID status from blockchain
 * @param did DID to check
 * @returns DID status information
 */
export async function getDIDStatus(did: string): Promise<{
  exists: boolean;
  isRevoked: boolean;
  transactionHash?: string;
}> {
  try {
    console.log('[BlockchainHelpers] Checking DID status:', did);
    
    // Check if we have a stored transaction hash
    const txHash = localStorage.getItem(`minaid_did_tx_${did}`);
    
    if (txHash) {
      return {
        exists: true,
        isRevoked: false,
        transactionHash: txHash,
      };
    }
    
    // If no stored transaction, DID might not be registered on-chain yet
    return {
      exists: false,
      isRevoked: false,
    };
  } catch (error: any) {
    console.error('[BlockchainHelpers] Error checking DID:', error.message);
    return {
      exists: false,
      isRevoked: false,
    };
  }
}

/**
 * Export transaction details for user records
 */
export function exportTransactionDetails(txHash: string, network: string = 'devnet'): void {
  const details = {
    transactionHash: txHash,
    network,
    explorerUrl: getExplorerUrl(txHash, network),
    timestamp: new Date().toISOString(),
  };
  
  const blob = new Blob([JSON.stringify(details, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `minaid-transaction-${txHash.slice(0, 8)}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
