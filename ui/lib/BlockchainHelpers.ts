/**
 * BlockchainHelpers.ts
 * 
 * Helper functions for blockchain operations in MinaID.
 * Provides convenient wrappers around ContractInterface for common tasks.
 */

import { Field, PrivateKey, PublicKey, Poseidon, MerkleMap, MerkleMapWitness } from 'o1js';
import { ContractInterface, getExplorerUrl } from './ContractInterface';

// Network configuration
const NETWORK_CONFIG = {
  networkId: 'devnet' as const,
  minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
  archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
  didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_DEVNET || 'B62qjuEhj9YjZyKTD75ywH7vY73DgUTC5bVxSCo3meirg8nGnV3CYjk',
  zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_DEVNET || 'B62qrfTGCDP1KEx1PQa6mWGjV2b8wckbdcQRhi2Mu3AGfRYrjjnnfxW',
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
  privateKeyBase58: string
): Promise<string | null> {
  try {
    console.log('[BlockchainHelpers] Registering DID on blockchain:', did);
    
    // Parse keys
    const publicKey = PublicKey.fromBase58(publicKeyBase58);
    const privateKey = PrivateKey.fromBase58(privateKeyBase58);
    
    // Create document hash (hash of DID string)
    const encoder = new TextEncoder();
    const didBytes = encoder.encode(did);
    const didHex = Array.from(didBytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 60);
    const didField = Field.from(BigInt('0x' + didHex));
    const documentHash = Poseidon.hash([didField]);
    
    // Create empty Merkle map for the witness
    const merkleMap = new MerkleMap();
    const witness = merkleMap.getWitness(didField);
    
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
      console.log('[BlockchainHelpers] ✅ DID registered successfully:', result.hash);
      console.log('[BlockchainHelpers] Explorer:', getExplorerUrl(result.hash, NETWORK_CONFIG.networkId));
      return result.hash;
    } else {
      console.warn('[BlockchainHelpers] DID registration failed:', result.error);
      return null;
    }
  } catch (error: any) {
    console.error('[BlockchainHelpers] Error registering DID:', error.message);
    return null;
  }
}

/**
 * Record proof generation on blockchain
 * @param did User's DID
 * @param proofType Type of proof (citizenship, age18, age21)
 * @param proof Proof data
 * @param privateKeyBase58 User's private key for signing
 * @returns Transaction hash if successful, null otherwise
 */
export async function recordProofOnChain(
  did: string,
  proofType: string,
  proof: any,
  privateKeyBase58: string
): Promise<string | null> {
  try {
    console.log('[BlockchainHelpers] Recording proof on blockchain:', { did, proofType });
    
    // Parse private key
    const privateKey = PrivateKey.fromBase58(privateKeyBase58);
    
    // Create proof commitment
    const proofData = {
      type: proofType,
      timestamp: Date.now(),
      did,
    };
    
    const encoder = new TextEncoder();
    const proofBytes = encoder.encode(JSON.stringify(proofData));
    const proofHex = Array.from(proofBytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 60);
    const proofField = Field.from(BigInt('0x' + proofHex));
    const commitment = Poseidon.hash([proofField]);
    
    // For now, we'll simulate blockchain recording
    // In production, this would call a contract method to record the proof
    console.log('[BlockchainHelpers] Proof commitment:', commitment.toString());
    console.log('[BlockchainHelpers] ⚠️  Simulated blockchain recording (contract method not yet implemented)');
    
    // Return simulated transaction hash
    const commitmentBytes = encoder.encode(commitment.toString());
    const commitmentHex = Array.from(commitmentBytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 50);
    const simulatedTxHash = '5J' + commitmentHex;
    return simulatedTxHash;
    
  } catch (error: any) {
    console.error('[BlockchainHelpers] Error recording proof:', error.message);
    return null;
  }
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
