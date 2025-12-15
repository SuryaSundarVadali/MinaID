/**
 * MerkleStateManager - Manages on-chain Merkle tree state for DID registration
 * 
 * This module handles:
 * 1. Fetching current on-chain Merkle root
 * 2. Checking if a DID already exists
 * 3. Generating valid Merkle witnesses for registration
 * 
 * IMPORTANT: This is designed for the current contract architecture where:
 * - We can check if the Merkle root is empty (no DIDs registered yet)
 * - For empty root: use empty MerkleMap to generate witness
 * - For non-empty root: registration will fail (DID already exists or contract has entries)
 */

import { MerkleMap, Field, PublicKey, Poseidon, fetchAccount } from 'o1js';

interface MerkleWitnessResult {
  witness: any;
  isEmptyRoot: boolean;
  currentRoot: Field;
  keyHash: Field;
}

/**
 * Get Merkle witness for DID registration
 * 
 * @param userPublicKey - The user's public key to register
 * @param contractAddress - The DID Registry contract address
 * @param didRegistry - The compiled DID Registry contract instance
 * @returns Witness and state information
 */
export async function getMerkleWitnessForRegistration(
  userPublicKey: PublicKey,
  contractAddress: string,
  didRegistry: any
): Promise<MerkleWitnessResult> {
  console.log('[MerkleStateManager] Getting Merkle witness for registration...');
  
  try {
    // Fetch current on-chain state
    const contractPubKey = PublicKey.fromBase58(contractAddress);
    await fetchAccount({ publicKey: contractPubKey });
    
    // Get the current Merkle root from contract
    const currentRoot = didRegistry.didMapRoot.get();
    console.log('[MerkleStateManager] Current on-chain Merkle root:', currentRoot.toString());
    
    // Create empty MerkleMap to check if root is empty
    const emptyMap = new MerkleMap();
    const emptyRoot = emptyMap.getRoot();
    const isEmptyRoot = currentRoot.toString() === emptyRoot.toString();
    
    console.log('[MerkleStateManager] Empty root:', emptyRoot.toString());
    console.log('[MerkleStateManager] Is contract root empty?', isEmptyRoot);
    
    // Generate key hash from user's public key
    const keyHash = Poseidon.hash(userPublicKey.toFields());
    console.log('[MerkleStateManager] DID key hash:', keyHash.toString());
    
    if (isEmptyRoot) {
      // Contract has no DIDs yet - use empty map witness
      const witness = emptyMap.getWitness(keyHash);
      console.log('[MerkleStateManager] ✅ Generated witness from empty map');
      
      return {
        witness,
        isEmptyRoot: true,
        currentRoot,
        keyHash,
      };
    } else {
      // Contract has existing DIDs
      console.warn('[MerkleStateManager] ⚠️  WARNING: Contract root is NOT empty!');
      console.warn('[MerkleStateManager] This means:');
      console.warn('[MerkleStateManager]   1. Other DIDs are already registered, OR');
      console.warn('[MerkleStateManager]   2. Your DID might already be registered');
      console.warn('[MerkleStateManager]');
      console.warn('[MerkleStateManager] Attempting registration with empty witness...');
      console.warn('[MerkleStateManager] This WILL FAIL if your DID is already registered.');
      
      // Still generate witness from empty map
      // If DID doesn't exist on-chain, witness validation might still pass
      // depending on contract logic
      const witness = emptyMap.getWitness(keyHash);
      
      return {
        witness,
        isEmptyRoot: false,
        currentRoot,
        keyHash,
      };
    }
  } catch (error: any) {
    console.error('[MerkleStateManager] ❌ Failed to fetch contract state:', error.message);
    throw new Error(`Cannot access contract state: ${error.message}`);
  }
}

/**
 * Check if a DID is already registered (simple check based on root)
 * 
 * Note: This is a basic check. Full verification would require:
 * 1. Fetching all on-chain events/actions
 * 2. Reconstructing the full MerkleMap
 * 3. Checking if the specific key exists
 * 
 * @param userPublicKey - The user's public key
 * @param contractAddress - The DID Registry contract address  
 * @param didRegistry - The compiled DID Registry contract instance
 * @returns True if we can determine DID might exist
 */
export async function isDIDLikelyRegistered(
  userPublicKey: PublicKey,
  contractAddress: string,
  didRegistry: any
): Promise<boolean> {
  try {
    const result = await getMerkleWitnessForRegistration(
      userPublicKey,
      contractAddress,
      didRegistry
    );
    
    // If root is not empty, DIDs exist in the contract
    // We can't definitively say THIS DID exists without full state reconstruction
    return !result.isEmptyRoot;
  } catch (error) {
    console.error('[MerkleStateManager] Cannot check DID status:', error);
    return false;
  }
}

/**
 * Check if contract is in a state that allows simple registration
 * 
 * @param contractAddress - The DID Registry contract address
 * @param didRegistry - The compiled DID Registry contract instance
 * @returns Object with canRegister flag and diagnostic info
 */
export async function canRegisterWithSimpleMethod(
  contractAddress: string,
  didRegistry: any
): Promise<{ canRegister: boolean; reason: string; currentRoot: string; emptyRoot: string }> {
  try {
    const contractPubKey = PublicKey.fromBase58(contractAddress);
    await fetchAccount({ publicKey: contractPubKey });
    
    const currentRoot = didRegistry.didMapRoot.get();
    const emptyMap = new MerkleMap();
    const emptyRoot = emptyMap.getRoot();
    
    const isEmpty = currentRoot.toString() === emptyRoot.toString();
    
    if (isEmpty) {
      return {
        canRegister: true,
        reason: 'Contract is empty and ready for registration',
        currentRoot: currentRoot.toString(),
        emptyRoot: emptyRoot.toString(),
      };
    } else {
      return {
        canRegister: false,
        reason: 'Contract already contains registered DIDs. The registerDIDSimple() method only works with empty contracts. You need a fresh contract deployment or full state reconstruction.',
        currentRoot: currentRoot.toString(),
        emptyRoot: emptyRoot.toString(),
      };
    }
  } catch (error: any) {
    return {
      canRegister: false,
      reason: `Cannot access contract: ${error.message}`,
      currentRoot: 'unknown',
      emptyRoot: 'unknown',
    };
  }
}

/**
 * Get empty Merkle root (for testing/comparison)
 */
export function getEmptyMerkleRoot(): Field {
  const emptyMap = new MerkleMap();
  return emptyMap.getRoot();
}
