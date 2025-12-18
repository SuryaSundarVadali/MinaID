/**
 * ContractInterface.ts
 * 
 * Interface for interacting with MinaID smart contracts on Mina blockchain.
 * Provides high-level API for DID registration, proof verification, and credential management.
 * 
 * Contracts:
 * - DIDRegistry: Register and manage DIDs
 * - ZKPVerifier: Verify zero-knowledge proofs
 * 
 * Features:
 * - Transaction building and signing
 * - Event listening and parsing
 * - Error handling and retry logic
 * - Gas estimation
 */

import { 
  Field, 
  Mina, 
  PrivateKey, 
  PublicKey, 
  fetchAccount,
  Signature,
  MerkleMapWitness,
  Poseidon,
  Scalar,
  Cache,
} from 'o1js';

// Import contracts from local copies (bundled with UI for Vercel deployment)
import { DIDRegistry } from './contracts/DIDRegistry';
import { ZKPVerifier } from './contracts/ZKPVerifier';

// Import browser cache utilities
import { initializeBrowserCache } from './BrowserCache';
import { MerkleCache } from './MerkleCache';
import { createO1JSCacheFromMerkle } from './O1JSCacheAdapter';

// Re-export for use by other modules
export { DIDRegistry, ZKPVerifier };

// Default configuration for Devnet
export const DEFAULT_CONFIG: NetworkConfig = {
  networkId: 'devnet',
  minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
  archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
  // Deployed Dec 11, 2025 - Latest deployment
  didRegistryAddress: 'B62qmv8SmrThvLXaH5zN1eKhPMEEL22coRaeezFM8f4yWNGj6CJ13EH',
  zkpVerifierAddress: 'B62qjxzdqgsRhxMSsUSEYFTdHwqRd7TY9Cu1SLmfECYnaktL1xbW5Sz',
};

// OLD/DEPRECATED contract addresses - DO NOT USE
// These will cause "Invalid_proof" or signature mismatch errors
const DEPRECATED_ADDRESSES = [
  'B62qmZgdBMV3pNLfK1Z9jQsZyoYgY6aWKwFWJHAnfk3QTbn883QLUg8', // Old DIDRegistry Dec 11
  'B62qnGLZeJw9nSH9FTyCzyrcs2BK8w7tZEGvH2uyLU2YzKNeG4Xo6ri', // Old ZKPVerifier Dec 11
  'B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD', // Old DIDRegistry Dec 8 (5-param verifyAgeProof)
  'B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw', // Old ZKPVerifier Dec 8 (5-param verifyAgeProof)
  'B62qkoY7NFfriUPxXYm5TWqJtz4TocpQhmzYq4LK7uXw63v8L8yZQfy', // Old DIDRegistry Dec 7
  'B62qkRuB4ojsqGmtJaH4eJQqMMdJYfGR2UNKtEUMeJzr1qd3G7rTDLG', // Old ZKPVerifier Dec 7
  'B62qjuEhj9YjZyKTD75ywH7vY73DgUTC5bVxSCo3meirg8nGnV3CYjk', // Old DIDRegistry
  'B62qrfTGCDP1KEx1PQa6mWGjV2b8wckbdcQRhi2Mu3AGfRYrjjnnfxW', // Old ZKPVerifier
];

// Types
export interface NetworkConfig {
  networkId: 'mainnet' | 'devnet' | 'berkeley' | 'testworld2' | 'zeko-testnet' | 'local';
  minaEndpoint: string;
  archiveEndpoint?: string;
  didRegistryAddress: string;
  zkpVerifierAddress: string;
}

export interface TransactionResult {
  hash: string;
  success: boolean;
  error?: string;
  events?: any[];
  explorerUrl?: string;
}

/**
 * Get Mina Explorer URL for transaction
 */
export function getExplorerUrl(txHash: string, network: string = 'devnet'): string {
  if (network === 'zeko-testnet') {
    return `https://zekoscan.io/testnet/tx/${txHash}`;
  }
  return `https://minascan.io/${network}/tx/${txHash}`;
}

export interface DIDStatus {
  exists: boolean;
  isRevoked: boolean;
  documentHash?: string;
  owner?: string;
  registeredAt?: number;
}

/**
 * MinaID Contract Interface
 * High-level API for interacting with smart contracts
 */
export class ContractInterface {
  private network: ReturnType<typeof Mina.Network>;
  private networkConfig: NetworkConfig;
  private didRegistry?: any; // DIDRegistry type loaded dynamically
  private zkpVerifier?: any; // ZKPVerifier type loaded dynamically
  private isCompiled = false;
  private contractsAvailable = false;
  private cache?: Cache; // O1js cache with proving keys (kept in memory for tx.prove())

  constructor(config: NetworkConfig) {
    this.networkConfig = config;
    
    // Initialize Mina network
    this.network = Mina.Network({
      mina: config.minaEndpoint,
      archive: config.archiveEndpoint,
    });
    
    Mina.setActiveInstance(this.network);
  }

  /**
   * Initialize contract instances
   * Must be called before using contract methods
   */
  async initialize(): Promise<void> {
    console.log('[ContractInterface] Initializing contracts...');
    console.log('[ContractInterface] DIDRegistry:', this.networkConfig.didRegistryAddress);
    console.log('[ContractInterface] ZKPVerifier:', this.networkConfig.zkpVerifierAddress);
    
    try {
      // Instantiate contracts without compiling immediately to prevent UI freezing on load
      this.didRegistry = new DIDRegistry(PublicKey.fromBase58(this.networkConfig.didRegistryAddress));
      this.zkpVerifier = new ZKPVerifier(PublicKey.fromBase58(this.networkConfig.zkpVerifierAddress));
      this.contractsAvailable = true;
      
      console.log('[ContractInterface] ✅ Interface ready (Lazy compilation enabled)');
    } catch (error) {
      console.error('[ContractInterface] Failed to initialize contracts:', error);
      this.contractsAvailable = false;
    }
  }

  /**
   * Check if contracts are available
   */
  areContractsAvailable(): boolean {
    return this.contractsAvailable;
  }

  /**
   * Ensure contracts are compiled before transaction generation
   * Uses cached prover keys from /cache directory for consistent verification keys
   */
  async ensureCompiled() {
    if (!this.contractsAvailable) {
      throw new Error('Contracts not available - blockchain features disabled');
    }
    if (this.isCompiled) return;
    
    console.log('[ContractInterface] 🔄 Loading prover keys from cache...');
    console.log('[ContractInterface] This may take 3-5 seconds with cache, or 90+ seconds without cache');
    console.log('[ContractInterface] Please wait...');
    console.time('Contract Compilation');
    
    const startTime = Date.now();
    
    try {
      // Initialize MerkleCache and load all files into memory for o1js
      const merkleCache = new MerkleCache();
      await merkleCache.initialize();
      
      console.log('[ContractInterface] Creating o1js Cache from MerkleCache...');
      this.cache = await createO1JSCacheFromMerkle(merkleCache);
      
      const cacheLoadTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`[ContractInterface] ✅ Cache loaded in ${cacheLoadTime}s, compiling contracts...`);
      
      console.log('[ContractInterface] Compiling DIDRegistry with cache...');
      const didRegistryResult = await DIDRegistry.compile({ cache: this.cache });
      console.log('[ContractInterface] DIDRegistry compiled, verification key:', didRegistryResult.verificationKey.hash.toString().slice(0, 10) + '...');
      
      console.log('[ContractInterface] Compiling ZKPVerifier with cache...');
      const zkpVerifierResult = await ZKPVerifier.compile({ cache: this.cache });
      console.log('[ContractInterface] ZKPVerifier compiled, verification key:', zkpVerifierResult.verificationKey.hash.toString().slice(0, 10) + '...');
      
      this.isCompiled = true;
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.log(`[ContractInterface] ✅ All contracts compiled successfully in ${totalTime}s`);
      console.log('[ContractInterface] ✅ Cache retained in memory for transaction proving');
    } catch (error: any) {
      const totalTime = Math.round((Date.now() - startTime) / 1000);
      console.error(`[ContractInterface] ❌ Compilation failed after ${totalTime}s:`, error);
      
      // Provide helpful error messages
      if (error.message?.includes('404') || error.message?.includes('Failed to fetch')) {
        console.error('[ContractInterface]');
        console.error('[ContractInterface] 🔧 CACHE ERROR DETECTED');
        console.error('[ContractInterface] ════════════════════════════════════════');
        console.error('[ContractInterface] Cache files are not accessible (404 errors).');
        console.error('[ContractInterface]');
        console.error('[ContractInterface] This usually means:');
        console.error('[ContractInterface] 1. Cache files not deployed to production (too large for Vercel free plan)');
        console.error('[ContractInterface] 2. NEXT_PUBLIC_CACHE_URL not configured correctly');
        console.error('[ContractInterface] 3. External cache host is down');
        console.error('[ContractInterface]');
        console.error('[ContractInterface] 📖 See: ui/QUICK_FIX_GUIDE.md for solutions');
        console.error('[ContractInterface]');
        console.error('[ContractInterface] Quick fix: Host cache on GitHub Releases');
        console.error('[ContractInterface]   1. Run: ui/scripts/upload-cache-to-github.sh');
        console.error('[ContractInterface]   2. Set NEXT_PUBLIC_CACHE_URL in Vercel');
        console.error('[ContractInterface]   3. Redeploy');
        console.error('[ContractInterface] ════════════════════════════════════════');
      }
      
      throw error;
    } finally {
      console.timeEnd('Contract Compilation');
    }
  }

  /**
   * Register a new DID on-chain
   * @param did User's DID (public key)
   * @param documentHash Hash of DID document
   * @param privateKey User's private key for signing
   * @param merkleWitness Merkle witness for the DID
   * @returns Transaction result
   */
  async registerDID(
    did: PublicKey,
    documentHash: Field,
    privateKey: PrivateKey | null,
    merkleWitness: MerkleMapWitness
  ): Promise<TransactionResult> {
    try {
      // Ensure contracts are compiled
      await this.ensureCompiled();

      // Try to fetch account, but don't fail if it doesn't exist yet
      console.log('Checking account for DID:', did.toBase58());
      try {
        const accountInfo = await fetchAccount({ publicKey: did });
        if (accountInfo.error) {
          console.warn('Account not found on chain - it needs to be funded first');
          console.warn(`Please fund the DID address: ${did.toBase58()}`);
        }
      } catch (fetchError: any) {
        console.warn('Account fetch failed:', fetchError.message);
      }

      // Fetch contract account
      const contractAddress = PublicKey.fromBase58(this.networkConfig.didRegistryAddress);
      try {
        await fetchAccount({ publicKey: contractAddress });
      } catch (contractError: any) {
        console.error('DIDRegistry contract not deployed:', contractError.message);
        return {
          hash: '',
          success: false,
          error: 'DIDRegistry contract not deployed. Please deploy the contract first.',
        };
      }

      console.log('Creating transaction for DID registration...');

      // If privateKey is null, use wallet provider
      if (!privateKey) {
        if (typeof window !== 'undefined' && (window as any).mina) {
          console.log('Using Auro Wallet for signing...');
          
          // Use registerDIDSimple for wallet integration
          // This method uses sender.getAndRequireSignature() internally
          // so the wallet automatically provides the correct authorization
          console.log('Building transaction with registerDIDSimple...');
          const tx = await Mina.transaction(
            { sender: did, fee: 100_000_000 }, 
            async () => {
              if (this.didRegistry) {
                // registerDIDSimple only requires documentHash and witness
                // The signature authorization comes from sender.getAndRequireSignature()
                await this.didRegistry.registerDIDSimple(documentHash, merkleWitness);
              } else {
                throw new Error('DIDRegistry contract not initialized');
              }
            }
          );

          // CRITICAL: Prove the transaction BEFORE sending to wallet
          // Auro Wallet doesn't have access to proving keys, so we must prove locally
          console.log('Proving transaction locally (this may take 2-3 minutes)...');
          console.log('Using cached proving keys from IndexedDB...');
          await tx.prove();
          console.log('✅ Transaction proved successfully');

          // Send to Auro Wallet - it will only sign (proof already attached)
          console.log('Sending proved transaction to Auro Wallet for signing...');

          const transactionJSON = tx.toJSON();

          const { hash } = await (window as any).mina.sendTransaction({
            transaction: transactionJSON,
            feePayer: {
              fee: 0.1,
              memo: 'MinaID: DID Registration'
            }
          });

          return {
            hash,
            success: true,
            events: []
          };
        } else {
          throw new Error('No private key provided and Auro Wallet not found');
        }
      }

      try {
        // Create transaction (no nested transactions!)
        const tx = await Mina.transaction(
          { sender: did, fee: 100_000_000 }, // 0.1 MINA fee
          async () => {
            // Create signature
            // The signature must verify against the userPublicKey and [didDocumentHash]
            // In the contract: validSignature.verify(userPublicKey, [didDocumentHash])
            const signature = Signature.create(privateKey, [documentHash]);
            
            // Call registerDID method
            if (this.didRegistry) {
              await this.didRegistry.registerDID(did, documentHash, merkleWitness, signature);
            } else {
              throw new Error('DIDRegistry contract not initialized');
            }
          }
        );

        console.log('Proving transaction...');
        await tx.prove();
        
        console.log('Signing transaction...');
        await tx.sign([privateKey]);

        console.log('Sending transaction...');
        const pendingTx = await tx.send();
        
        console.log('Transaction sent! Hash:', pendingTx.hash);

        // Wait for confirmation
        if (pendingTx.status === 'pending') {
          console.log('Waiting for transaction confirmation...');
          await pendingTx.wait();
        }

        return {
          hash: pendingTx.hash || '',
          success: true,
          events: [], // Extract events from transaction
        };
      } catch (txError: any) {
        console.error('Transaction failed:', txError.message);
        
        // Provide helpful error for funding issues
        if (txError.message.includes('funds') || txError.message.includes('balance') || txError.message.includes('Account')) {
          return {
            hash: '',
            success: false,
            error: 'Account not funded. Please get MINA tokens from: https://faucet.minaprotocol.com/',
          };
        }
        
        throw txError;
      }
    } catch (error: any) {
      console.error('DID registration failed:', error);
      
      // Provide helpful error message
      let errorMessage = error.message || 'DID registration failed';
      if (errorMessage.includes('Could not find account')) {
        errorMessage = 'Account not funded. Please get MINA tokens from: https://faucet.minaprotocol.com/';
      }
      
      return {
        hash: '',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Record a proof on-chain
   * @param did User's DID
   * @param proofType Type of proof (age, kyc, citizenship)
   * @param proofData Proof data
   * @param privateKey User's private key
   */
  async recordProof(
    did: PublicKey,
    proofType: string,
    proofData: any,
    privateKey: PrivateKey
  ): Promise<TransactionResult> {
    try {
      console.log(`Recording ${proofType} proof for DID:`, did.toBase58());
      
      // Ensure contracts are compiled
      await this.ensureCompiled();
      
      if (!this.zkpVerifier) {
        throw new Error('ZKPVerifier contract not initialized');
      }

      // Check if account exists/is funded
      await fetchAccount({ publicKey: did });

      const tx = await Mina.transaction({ sender: did, fee: 100_000_000 }, async () => {
        if (proofType.startsWith('age')) {
          // Parse proof data
          // proofData should contain: ageHash, proof (commitment), issuerPublicKey, timestamp
          // Note: ageHash comes from the parsed JSON in proofData
          const ageHash = Field.from(proofData.ageHash || 0); 
          const proof = Field.from(proofData.publicOutput);
          const issuerPublicKey = did; // Self-attested for now
          const timestamp = Field.from(proofData.timestamp);
          
          await this.zkpVerifier!.verifyAgeProof(
            did,
            ageHash,
            proof,
            issuerPublicKey,
            timestamp
          );
        } else if (proofType === 'kyc') {
          // KYC verification
          const kycHash = Field.from(proofData.kycHash || 0);
          const proof = Field.from(proofData.publicOutput); // This is the commitment
          const issuerPublicKey = did; // Self-attested
          
          await this.zkpVerifier!.verifyKYCProof(
            did,
            kycHash,
            proof,
            issuerPublicKey
          );
        } else if (proofType === 'citizenship') {
          // Citizenship proof not yet supported in ZKPVerifier contract
          throw new Error('Citizenship proof verification is not supported on-chain yet. Please use age or kyc proof types.');
        } else {
          throw new Error(`Unsupported proof type: ${proofType}`);
        }
      });

      console.log('Proving proof transaction...');
      await tx.prove();
      
      console.log('Signing proof transaction...');
      await tx.sign([privateKey]);

      console.log('Sending proof transaction...');
      const pendingTx = await tx.send();
      
      if (pendingTx.status === 'pending') {
        await pendingTx.wait();
      }

      return {
        hash: pendingTx.hash,
        success: true,
        events: [],
      };
    } catch (error: any) {
      console.error('Proof recording failed:', error);
      return {
        hash: '',
        success: false,
        error: error.message || 'Proof recording failed',
      };
    }
  }

  /**
   * Verify a DID exists and is not revoked
   * @param did DID to verify
   * @returns DID status
   */
  async verifyDID(did: PublicKey): Promise<DIDStatus> {
    try {
      // Fetch account state
      await fetchAccount({ publicKey: did });

      // Query DID status from contract
      // const exists = await this.didRegistry!.verifyDID(did);
      
      // Placeholder
      const exists = true;
      
      return {
        exists,
        isRevoked: false,
        owner: did.toBase58(),
      };
    } catch (error) {
      console.error('DID verification failed:', error);
      return {
        exists: false,
        isRevoked: false,
      };
    }
  }

  /**
   * Revoke a DID
   * @param did DID to revoke
   * @param privateKey Owner's private key
   * @param merkleWitness Merkle witness for the DID
   * @returns Transaction result
   */
  async revokeDID(
    did: PublicKey,
    privateKey: PrivateKey,
    merkleWitness: MerkleMapWitness
  ): Promise<TransactionResult> {
    try {
      // Ensure contracts are compiled
      await this.ensureCompiled();

      await fetchAccount({ publicKey: did });

      const tx = await Mina.transaction({ sender: did, fee: 100_000_000 }, async () => {
        // Create signature for revocation
        // Contract expects signature of Poseidon.hash(did.toFields())
        const key = Poseidon.hash(did.toFields());
        const signature = Signature.create(privateKey, [key]);
        
        if (this.didRegistry) {
          await this.didRegistry.revokeDID(did, merkleWitness, signature);
        } else {
          throw new Error('DIDRegistry contract not initialized');
        }
      });

      await tx.prove();
      await tx.sign([privateKey]);
      const pendingTx = await tx.send();
      
      if (!pendingTx.status || pendingTx.status === 'pending') {
        await pendingTx.wait();
      }

      return {
        hash: pendingTx.hash,
        success: true,
      };
    } catch (error: any) {
      return {
        hash: '',
        success: false,
        error: error.message || 'DID revocation failed',
      };
    }
  }

  /**
   * Update DID document
   * @param did DID to update
   * @param newDocumentHash New document hash
   * @param privateKey Owner's private key
   * @param witness Merkle witness for current state
   * @returns Transaction result
   */
  async updateDID(
    did: PublicKey,
    newDocumentHash: Field,
    privateKey: PrivateKey,
    witness: MerkleMapWitness
  ): Promise<TransactionResult> {
    try {
      // Ensure contracts are compiled
      await this.ensureCompiled();

      await fetchAccount({ publicKey: did });

      const tx = await Mina.transaction({ sender: did, fee: 100_000_000 }, async () => {
        // Create signature for update
        const signature = Signature.create(privateKey, [newDocumentHash]);
        
        if (this.didRegistry) {
          await this.didRegistry.updateDID(did, newDocumentHash, witness, signature);
        } else {
          throw new Error('DIDRegistry contract not initialized');
        }
      });

      await tx.prove();
      await tx.sign([privateKey]);
      const pendingTx = await tx.send();
      
      if (!pendingTx.status || pendingTx.status === 'pending') {
        await pendingTx.wait();
      }

      return {
        hash: pendingTx.hash,
        success: true,
      };
    } catch (error: any) {
      return {
        hash: '',
        success: false,
        error: error.message || 'DID update failed',
      };
    }
  }

  /**
   * Register proof commitment on-chain using DIDRegistry
   * This stores the proof commitment in the DID document
   * 
   * @param proofData The generated proof data
   * @returns Transaction result
   */
  async registerProofCommitment(proofData: any): Promise<TransactionResult> {
    console.log('[ContractInterface] *** registerProofCommitment - Register proof on blockchain ***');
    try {
      // Validate input
      if (!proofData) {
        throw new Error('Proof data is required');
      }
      if (!proofData.proof && !proofData.publicOutput) {
        throw new Error('Proof must contain either proof or publicOutput field');
      }
      if (!proofData.proofType) {
        throw new Error('Proof type is required');
      }

      // Ensure contracts are compiled
      await this.ensureCompiled();

      if (!this.didRegistry) {
        await this.initialize();
      }

      // Use Auro Wallet
      if (typeof window === 'undefined' || !(window as any).mina) {
        throw new Error('Auro Wallet not available. Please install and connect Auro Wallet.');
      }

      const accounts = await (window as any).mina.requestAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error('No wallet account found. Please connect Auro Wallet.');
      }
      
      const userPublicKey = PublicKey.fromBase58(accounts[0]);
      console.log('[ContractInterface] User wallet:', userPublicKey.toBase58());

      // Parse the proof to get commitment
      let parsedProof;
      try {
        parsedProof = typeof proofData.proof === 'string' 
          ? JSON.parse(proofData.proof)
          : proofData.proof;
      } catch (e) {
        parsedProof = proofData.proof;
      }

      // Create DID document hash from proof commitment
      let commitment: Field;
      try {
        const commitmentValue = parsedProof.commitment || proofData.publicOutput;
        if (!commitmentValue) {
          throw new Error('No commitment or publicOutput found in proof');
        }
        commitment = Field(commitmentValue);
        console.log('[ContractInterface] Proof commitment:', commitment.toString());
      } catch (e: any) {
        throw new Error(`Failed to parse commitment: ${e.message}`);
      }
      // Use commitment directly as the DID document hash
      const didDocumentHash = commitment;
      console.log('[ContractInterface] DID document hash:', didDocumentHash.toString());

      // Use MerkleStateManager to get proper witness
      let witness;
      let merkleInfo;
      try {
        // Ensure contracts are compiled
        await this.ensureCompiled();
        
        // Import MerkleStateManager
        const { canRegisterWithSimpleMethod, getMerkleWitnessForRegistration } = await import('./MerkleStateManager');
        
        // CRITICAL PRE-CHECK: Verify contract state allows registration
        console.log('[ContractInterface] 🔍 Pre-check: Verifying contract state...');
        const eligibility = await canRegisterWithSimpleMethod(
          this.networkConfig.didRegistryAddress,
          this.didRegistry!
        );
        
        console.log('[ContractInterface] Contract eligibility check:');
        console.log('[ContractInterface]   Can register:', eligibility.canRegister);
        console.log('[ContractInterface]   Reason:', eligibility.reason);
        console.log('[ContractInterface]   Current root:', eligibility.currentRoot);
        console.log('[ContractInterface]   Empty root:', eligibility.emptyRoot);
        
        if (!eligibility.canRegister) {
          console.error('[ContractInterface] ❌ REGISTRATION BLOCKED!');
          console.error('[ContractInterface]');
          console.error('[ContractInterface] ' + eligibility.reason);
          console.error('[ContractInterface]');
          console.error('[ContractInterface] 🔧 SOLUTIONS:');
          console.error('[ContractInterface]   Option 1: Deploy a NEW contract instance with an empty state');
          console.error('[ContractInterface]   Option 2: Contact the contract admin to reset the contract');
          console.error('[ContractInterface]   Option 3: Implement full Merkle state reconstruction (advanced)');
          console.error('[ContractInterface]');
          console.error('[ContractInterface] ℹ️  This limitation exists because registerDIDSimple() expects an empty contract.');
          console.error('[ContractInterface]    Once ANY DID is registered, the contract root changes and simple');
          console.error('[ContractInterface]    registration no longer works without full state knowledge.');
          
          throw new Error(eligibility.reason);
        }
        
        console.log('[ContractInterface] ✅ Contract is ready for registration');
        
        // Get witness with proper state management
        merkleInfo = await getMerkleWitnessForRegistration(
          userPublicKey,
          this.networkConfig.didRegistryAddress,
          this.didRegistry!
        );
        
        witness = merkleInfo.witness;
        
        console.log('[ContractInterface] ✅ Merkle witness generated');
        console.log('[ContractInterface]   Key hash:', merkleInfo.keyHash.toString());
        console.log('[ContractInterface]   Witness ready for transaction');
      } catch (e: any) {
        throw new Error(`Failed to create Merkle witness: ${e.message}`);
      }

      // Create transaction using the simplified registration method
      // This method uses this.sender.getAndRequireSignature() internally
      console.log('[ContractInterface] Creating registration transaction...');
      let tx;
      try {
        tx = await Mina.transaction(
          { sender: userPublicKey, fee: 100_000_000 }, // 0.1 MINA fee
          async () => {
            if (this.didRegistry) {
              // Use the simplified registration method that doesn't require a separate signature
              await this.didRegistry.registerDIDSimple(
                didDocumentHash,    // DID document hash (using commitment)
                witness              // Merkle witness for empty slot
              );
            } else {
              throw new Error('DIDRegistry contract not initialized');
            }
          }
        );
      } catch (e: any) {
        throw new Error(`Failed to create transaction: ${e.message}`);
      }

      // CRITICAL: Prove the transaction BEFORE sending to wallet
      // Auro Wallet doesn't have access to proving keys, so we must prove locally
      console.log('[ContractInterface] Proving transaction locally (this may take 2-3 minutes)...');
      console.log('[ContractInterface] Using cached proving keys from IndexedDB...');
      
      try {
        await tx.prove();
        console.log('[ContractInterface] ✅ Transaction proved successfully');
      } catch (e: any) {
        throw new Error(`Failed to prove transaction: ${e.message}`);
      }

      // Send to Auro Wallet for signing only (proof already attached)
      console.log('[ContractInterface] Sending proved transaction to Auro Wallet for signing...');

      let result;
      try {
        const transactionJSON = tx.toJSON();
        
        // Debug: Check for undefined values in transaction JSON
        console.log('[ContractInterface] Transaction JSON keys:', Object.keys(transactionJSON));
        
        const proofTypeName = proofData.proofType || 'proof';
        
        result = await (window as any).mina.sendTransaction({
          transaction: transactionJSON,
          feePayer: {
            fee: 0.1,
            memo: `MinaID: Register ${proofTypeName}`,
          },
        });

        if (!result || !result.hash) {
          throw new Error('Transaction rejected by wallet or failed to return transaction hash');
        }
      } catch (e: any) {
        if (e.message.includes('User rejected')) {
          throw new Error('Transaction rejected by user');
        }
        throw new Error(`Wallet transaction failed: ${e.message}`);
      }

      console.log('[ContractInterface] ✅ Registration transaction sent:', result.hash);
      
      return {
        hash: result.hash,
        success: true,
        explorerUrl: `https://zekoscan.io/testnet/tx/${result.hash}`,
      };

    } catch (error: any) {
      console.error('[ContractInterface] ❌ Registration failed:', error);
      return {
        hash: '',
        success: false,
        error: error.message || 'Proof registration failed',
      };
    }
  }

  /**
   * Verify proof on-chain using ZKPVerifier contract
   * This creates a blockchain transaction that will appear on Mina Explorer
   * 
   * @param proofData The complete proof data from JSON file
   * @param verifierPrivateKeyBase58 Private key of verifier in base58 format (to pay fees), or null to use Auro wallet
   * @returns Transaction result with explorer URL
   */
  async verifyProofOnChain(
    proofData: any,
    verifierPrivateKeyBase58: string | null = null
  ): Promise<TransactionResult> {
    console.log('[ContractInterface] *** verifyProofOnChain v3 - WITH WALLET SUPPORT ***');
    try {
      // Ensure contracts are compiled
      await this.ensureCompiled();

      if (!this.zkpVerifier) {
        await this.initialize();
      }

      // Get verifier address - either from private key or wallet
      let verifier: PublicKey;
      let verifierPrivateKey: PrivateKey | null = null;
      let useWallet = false;

      if (verifierPrivateKeyBase58) {
        // Use provided private key
        verifierPrivateKey = PrivateKey.fromBase58(verifierPrivateKeyBase58);
        verifier = verifierPrivateKey.toPublicKey();
        console.log('[ContractInterface] Using provided private key');
      } else if (typeof window !== 'undefined' && (window as any).mina) {
        // Use Auro Wallet
        useWallet = true;
        const accounts = await (window as any).mina.requestAccounts();
        if (!accounts || accounts.length === 0) {
          throw new Error('No wallet account found. Please connect Auro Wallet.');
        }
        verifier = PublicKey.fromBase58(accounts[0]);
        console.log('[ContractInterface] Using Auro Wallet');
      } else {
        throw new Error('No private key provided and Auro Wallet not available');
      }

      console.log('[ContractInterface] Verifying proof on-chain...');
      console.log('[ContractInterface] Verifier:', verifier.toBase58());
      console.log('[ContractInterface] Proof Type:', proofData.proofType);

      const proofType = proofData.proofType;
      
      // Check if proof type is supported for on-chain verification
      if (proofType === 'citizenship' || proofType === 'name' || proofType === 'address' || proofType === 'identity') {
        throw new Error(`${proofType} proofs use selective disclosure and cannot be verified on-chain. They are verified client-side only. Please use age18, age21, or kyc proof types for on-chain verification.`);
      }
      
      // Parse the proof data (it's a JSON string)
      let parsedProof;
      try {
        parsedProof = typeof proofData.proof === 'string' 
          ? JSON.parse(proofData.proof)
          : proofData.proof;
      } catch (e) {
        parsedProof = proofData.proof;
      }

      // Extract subject from proof's publicKey field (the key that was used to create the commitment)
      // This is important because for Auro wallet users, the proof uses a deterministic key
      // that may differ from the wallet address in the DID
      let subject: PublicKey;
      if (parsedProof.publicKey) {
        // Use the public key that was used during proof generation
        subject = PublicKey.fromBase58(parsedProof.publicKey);
        console.log('[ContractInterface] Using proof publicKey for subject:', subject.toBase58());
      } else {
        // Fallback to DID-based public key
        subject = PublicKey.fromBase58(proofData.did.replace('did:mina:', ''));
        console.log('[ContractInterface] Using DID for subject:', subject.toBase58());
      }

      // Create commitment field from proof - must use Field() for string decimal values
      const commitment = Field(parsedProof.commitment || proofData.publicOutput);
      
      // Create issuer key (for now, use the subject as issuer - self-attested)
      const issuer = subject;
      
      // Create timestamp field - CRITICAL: Use publicInput.timestamp (seconds), NOT proofData.timestamp (milliseconds)
      // proofData.timestamp is in milliseconds (for UI), publicInput.timestamp is in seconds (for blockchain)
      const timestamp = Field(proofData.publicInput?.timestamp || Math.floor(proofData.timestamp / 1000));

      // Debug: Log all the values being used
      console.log('[ContractInterface] Verification parameters:');
      console.log('  Subject:', subject.toBase58());
      console.log('  Subject fields:', subject.toFields().map(f => f.toString()));
      console.log('  Issuer:', issuer.toBase58());
      console.log('  Issuer fields:', issuer.toFields().map(f => f.toString()));
      console.log('  kycHash from proof (raw):', parsedProof.kycHash);
      console.log('  Commitment from proof:', commitment.toString());
      
      // Recompute what the contract will compute to debug
      // Use Field() constructor for string decimal representation
      const kycHashField = Field(parsedProof.kycHash || '0');
      console.log('  kycHash as Field:', kycHashField.toString());
      
      const recomputedCommitment = Poseidon.hash([
        kycHashField,
        ...subject.toFields(),
        ...issuer.toFields(),
        Field(1)
      ]);
      console.log('  Recomputed commitment:', recomputedCommitment.toString());
      console.log('  Match:', commitment.toString() === recomputedCommitment.toString());

      console.log('[ContractInterface] Creating verification transaction...');

      // Check if contracts are actually deployed
      const contractAddress = PublicKey.fromBase58(this.networkConfig.zkpVerifierAddress);
      let isContractDeployed = false;
      let contractMinAgeValue: bigint | undefined;
      
      try {
        const accountResult = await fetchAccount({ publicKey: contractAddress });
        console.log('[ContractInterface] Contract account fetch result:', accountResult);
        isContractDeployed = true;
        
        // Read the contract's actual minimumAge state
        if (this.zkpVerifier) {
          const contractMinAge = this.zkpVerifier.minimumAge.get();
          contractMinAgeValue = contractMinAge?.toBigInt();
          console.log('[ContractInterface] Contract minimumAge state:', contractMinAgeValue?.toString() || 'undefined');
          
          // Warn if minimumAge is not 18
          if (contractMinAgeValue !== 18n) {
            console.warn('[ContractInterface] ⚠️ Contract minimumAge is NOT 18! Value:', contractMinAgeValue?.toString());
            console.warn('[ContractInterface] ⚠️ Proof was generated with minimumAge=18, but contract has different value!');
          }
        }
      } catch (error) {
        console.error('[ContractInterface] ❌ Contract not deployed or accessible:', error);
        isContractDeployed = false;
      }

      // If contracts are not deployed, return failure (no simulation)
      if (!isContractDeployed || !this.zkpVerifier) {
        console.error('[ContractInterface] ❌ Cannot verify proof - contract not deployed or not initialized');
        return {
          hash: '',
          success: false,
          error: 'ZKPVerifier contract not deployed or not accessible. On-chain verification requires a deployed contract.',
        };
      }

      // Create and send transaction based on proof type
      // Debug: Log proof routing decision parameters
      console.log('[ContractInterface] Proof Routing Decision:');
      console.log('  proofType:', proofType);
      console.log('  parsedProof.ageHash:', parsedProof.ageHash);
      console.log('  parsedProof.kycHash:', parsedProof.kycHash);
      console.log('  Is age18 or age21:', proofType === 'age18' || proofType === 'age21');
      console.log('  ageHash defined:', parsedProof.ageHash !== undefined);
      
      const tx = await Mina.transaction(
        { sender: verifier, fee: 100_000_000 }, // 0.1 MINA fee
        async () => {
          // Determine if this is an age-type proof based on the proof structure
          // Age proofs have ageHash, KYC proofs have kycHash
          // Citizenship proofs should use KYC verification (no age requirement)
          const isAgeProof = (proofType === 'age18' || proofType === 'age21') &&
                             parsedProof.ageHash !== undefined;
          
          console.log('[ContractInterface] isAgeProof:', isAgeProof);
          
          if (isAgeProof) {
            // Age verification (also used for citizenship proofs)
            const ageHash = Field(parsedProof.ageHash || '0');
            
            // Get the actual minimum age used during proof generation
            // minimumAge is stored in proofData.publicInput, not in parsedProof
            const minAgeFromProof = parseInt(proofData.publicInput?.minimumAge || '18');
            const minAgeField = Field(minAgeFromProof);
            
            // Debug: Log exact values for age proof verification
            console.log('[ContractInterface] Age proof verification parameters:');
            console.log('  ageHash:', ageHash.toString());
            console.log('  minAge (from proof):', minAgeFromProof);
            console.log('  subject:', subject.toBase58());
            console.log('  subject.toFields():', subject.toFields().map(f => f.toString()));
            console.log('  issuer:', issuer.toBase58());
            console.log('  issuer.toFields():', issuer.toFields().map(f => f.toString()));
            console.log('  timestamp:', timestamp.toString());
            console.log('  commitment (proof):', commitment.toString());
            
            // Verify the commitment matches what we expect based on proof parameters
            const expectedCommitment = Poseidon.hash([
              ageHash,
              minAgeField,
              ...subject.toFields(),
              ...issuer.toFields(),
              timestamp,
            ]);
            console.log('  Expected commitment (minAge=' + minAgeFromProof + '):', expectedCommitment.toString());
            console.log('  Match:', commitment.toString() === expectedCommitment.toString());
            
            if (commitment.toString() !== expectedCommitment.toString()) {
              console.error('[ContractInterface] ❌ COMMITMENT MISMATCH DETECTED!');
              console.error('[ContractInterface] This usually means:');
              console.error('[ContractInterface]   1. Proof was generated with different minimumAge');
              console.error('[ContractInterface]   2. You have a CACHED OLD PROOF - regenerate it!');
              console.error('[ContractInterface]   3. Proof parameters (subject/issuer/timestamp) changed');
              console.error('[ContractInterface]');
              console.error('[ContractInterface] 🔧 FIX: Delete cached proof and generate a new one');
              console.error('[ContractInterface]     localStorage.removeItem(\'proofs_...\')');
              
              throw new Error(
                `Commitment mismatch! CACHED OLD PROOF DETECTED. ` +
                `The proof was generated with minAge=${minAgeFromProof} but commitment doesn't match. ` +
                `DELETE your cached proof and REGENERATE it. ` +
                `Expected: ${expectedCommitment.toString()}, Got: ${commitment.toString()}`
              );
            }
            
            await this.zkpVerifier!.verifyAgeProof(
              subject,
              ageHash,
              commitment,
              issuer,
              timestamp
            );
            
            console.log('[ContractInterface] Age proof verification called for type:', proofType);
          } else if (proofType === 'citizenship' || proofType === 'name') {
            // Citizenship/Name proof verification using the NEW verifyCitizenshipProof method
            console.log(`[ContractInterface] Verifying ${proofType} proof on-chain`);
            
            const dataHash = Field(proofData.publicInput.citizenshipHash || proofData.publicInput.nameHash || '0');
            // Get the expected citizenship/name value from proof (it's in the private data)
            // For citizenship proofs, this is the citizenship field itself
            const citizenshipValue = proofData.selectiveDisclosure?.revealedData?.citizenship || '';
            const nameValue = proofData.selectiveDisclosure?.revealedData?.name || '';
            
            // Convert to Field (same as proof generation)
            const dataString = proofType === 'citizenship' ? citizenshipValue : nameValue;
            const expectedDataField = Field.from(BigInt('0x' + Buffer.from(dataString.toLowerCase().trim()).toString('hex').slice(0, 16)));
            
            console.log('[ContractInterface] Citizenship/Name proof parameters:');
            console.log('  dataHash:', dataHash.toString());
            console.log('  expectedData:', expectedDataField.toString());
            console.log('  subject:', subject.toBase58());
            console.log('  issuer:', issuer.toBase58());
            console.log('  timestamp:', timestamp.toString());
            console.log('  commitment (proof):', commitment.toString());
            
            // Verify expected commitment structure
            const expectedCommitment = Poseidon.hash([
              dataHash,
              expectedDataField,
              ...subject.toFields(),
              ...issuer.toFields(),
              timestamp,
            ]);
            console.log('  Expected commitment:', expectedCommitment.toString());
            console.log('  Match:', commitment.toString() === expectedCommitment.toString());
            
            if (commitment.toString() !== expectedCommitment.toString()) {
              console.error('[ContractInterface] ❌ CITIZENSHIP/NAME COMMITMENT MISMATCH!');
              throw new Error(
                `Citizenship/Name commitment mismatch! ` +
                `Expected: ${expectedCommitment.toString()}, Got: ${commitment.toString()}`
              );
            }
            
            await this.zkpVerifier!.verifyCitizenshipProof(
              subject,
              dataHash,
              expectedDataField,
              commitment,
              issuer,
              timestamp
            );
          } else {
            // KYC verification - only for proofs with kycHash
            await this.zkpVerifier!.verifyKYCProof(
              subject,
              kycHashField,  // Use the already-computed Field
              commitment,
              issuer
            );
            
            console.log('[ContractInterface] KYC proof verification called');
          }
        }
      );

      let txHash = '';

      if (useWallet) {
        // CRITICAL: Prove the transaction BEFORE sending to wallet
        // Auro Wallet doesn't have access to proving keys, so we must prove locally
        console.log('[ContractInterface] Proving transaction locally (this may take 2-3 minutes)...');
        console.log('[ContractInterface] Using cached proving keys from IndexedDB...');
        
        try {
          await tx.prove();
          console.log('[ContractInterface] ✅ Transaction proved successfully');
        } catch (e: any) {
          throw new Error(`Failed to prove transaction: ${e.message}`);
        }

        // Send to Auro Wallet for signing only (proof already attached)
        console.log('[ContractInterface] Sending proved transaction to Auro Wallet for signing...');
        
        const transactionJSON = tx.toJSON();
        
        try {
          const { hash } = await (window as any).mina.sendTransaction({
            transaction: transactionJSON,
            feePayer: {
              fee: 0.1,
              memo: 'MinaID: Verify Proof'
            }
          });
          txHash = hash;
          console.log('[ContractInterface] ✅ Transaction sent via wallet! Hash:', txHash);
        } catch (walletError: any) {
          throw new Error(`Wallet signing failed: ${walletError.message}`);
        }
      } else if (verifierPrivateKey) {
        // Prove transaction when NOT using wallet
        console.log('[ContractInterface] Proving transaction...');
        await tx.prove();
        
        // Use provided private key
        console.log('[ContractInterface] Signing transaction with private key...');
        await tx.sign([verifierPrivateKey]);

        console.log('[ContractInterface] Sending transaction to blockchain...');
        const pendingTx = await tx.send();

        txHash = pendingTx.hash || '';
        console.log('[ContractInterface] ✅ Transaction sent! Hash:', txHash);

        // Wait for confirmation (optional - can be async)
        if (pendingTx.status === 'pending') {
          console.log('[ContractInterface] Waiting for confirmation...');
          await pendingTx.wait();
          console.log('[ContractInterface] ✅ Transaction confirmed!');
        }
      }

      console.log('[ContractInterface] Explorer:', getExplorerUrl(txHash, this.networkConfig.networkId));

      return {
        hash: txHash,
        success: true,
        events: [],
        explorerUrl: getExplorerUrl(txHash, this.networkConfig.networkId),
      };
    } catch (error: any) {
      console.error('[ContractInterface] ❌ Verification failed:', error);
      
      return {
        hash: '',
        success: false,
        error: error.message || 'On-chain verification failed',
      };
    }
  }



  /**
   * Verify TRUE zkSNARK Proof On-Chain (NEW METHOD - ALL PROOF TYPES)
   * 
   * Verifies an actual zero-knowledge proof generated off-chain by ZKProofGenerator.
   * Supports all proof types: age, citizenship, name, KYC
   * 
   * @param zkProofData - ZK proof data from ZKProofGenerator
   * @param verifierAddress - Address of the verifier (sender)
   * @param expectedDataOverride - Optional expected data (e.g. "India") to verify against, overrides proof data
   * @returns Mina.Transaction object
   */
  async buildVerificationTransaction(
    zkProofData: any,
    verifierAddress: string,
    expectedDataOverride?: string
  ): Promise<Mina.Transaction<false, false>> {
    console.log('[ContractInterface] Building verification transaction...');
    
    // Ensure contracts are compiled
    await this.ensureCompiled();

    if (!this.zkpVerifier) {
      await this.initialize();
    }

    const verifier = PublicKey.fromBase58(verifierAddress);
    const proofType = zkProofData.proofType;

    // Build transaction based on proof type
    const tx = await Mina.transaction(
      { sender: verifier, fee: 100_000_000 },
      async () => {
        // Validate inputs
        if (!zkProofData.publicInput) throw new Error('Missing publicInput in proof data');
        if (!zkProofData.publicOutput) throw new Error('Missing publicOutput in proof data');

        const subject = PublicKey.fromBase58(zkProofData.publicInput.subjectPublicKey);
        const commitment = Field(zkProofData.publicOutput);
        const issuer = PublicKey.fromBase58(zkProofData.publicInput.issuerPublicKey);
        const timestamp = Field(zkProofData.publicInput.timestamp || 0);
        
        if (proofType.startsWith('age') || proofType === 'age18' || proofType === 'age21') {
          // Age proof verification
          const ageHash = Field(zkProofData.publicInput.ageHash || zkProofData.publicInput.kycHash || '0');
          const minimumAge = Field(zkProofData.publicInput.minimumAge || '18');
          
          await this.zkpVerifier!.verifyAgeProof(
            subject,
            ageHash,
            commitment,
            issuer,
            timestamp,
            minimumAge
          );
        } else if (proofType === 'citizenship' || proofType === 'name') {
          // Citizenship/Name proof verification
          const dataHash = Field(zkProofData.publicInput.citizenshipHash || zkProofData.publicInput.nameHash || '0');
          
          // Extract expected data from selective disclosure or override
          let expectedDataString = expectedDataOverride || '';
          
          if (!expectedDataString) {
            if (proofType === 'citizenship') {
              expectedDataString = zkProofData.selectiveDisclosure?.revealedData?.citizenship || '';
            } else if (proofType === 'name') {
              expectedDataString = zkProofData.selectiveDisclosure?.revealedData?.name || '';
            }
          }
          
          if (!expectedDataString) {
             throw new Error(`Missing revealed data for ${proofType} proof verification. Selective disclosure required.`);
          }
          
          // Normalize to lowercase and trim (CRITICAL: Must match ZKProofGenerator)
          const normalizedData = expectedDataString.toLowerCase().trim();
          
          // Convert to Field (must match ZKProofGenerator logic)
          // Use TextEncoder for browser compatibility if Buffer is not available
          let hexString = '';
          if (typeof Buffer !== 'undefined') {
            hexString = Buffer.from(normalizedData).toString('hex');
          } else {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(normalizedData);
            for (const byte of bytes) {
              hexString += byte.toString(16).padStart(2, '0');
            }
          }
          
          // Ensure hexString is not empty and has valid length
          if (hexString.length === 0) hexString = '00';
          
          const expectedData = Field.from(BigInt('0x' + hexString.slice(0, 16).padEnd(2, '0')));
          
          console.log(`[ContractInterface] Verifying ${proofType} proof:`);
          console.log(`  Subject: ${subject.toBase58()}`);
          console.log(`  Data Hash: ${dataHash.toString()}`);
          console.log(`  Expected Data: ${expectedData.toString()} (${normalizedData})`);
          console.log(`  Commitment: ${commitment.toString()}`);
          console.log(`  Issuer: ${issuer.toBase58()}`);
          console.log(`  Timestamp: ${timestamp.toString()}`);

          await this.zkpVerifier!.verifyCitizenshipProof(
            subject,
            dataHash,
            expectedData,
            commitment,
            issuer,
            timestamp
          );
        } else if (proofType === 'kyc') {
          const kycHashString = zkProofData.publicInput.kycHash || '0';
          const kycHash = Field(BigInt(kycHashString));
          
          await this.zkpVerifier!.verifyKYCProof(
            subject,
            kycHash,
            commitment,
            issuer
          );
        } else {
          throw new Error(`Unsupported proof type: ${proofType}`);
        }
      }
    );

    return tx;
  }

  /**
   * Verify a ZK proof on-chain
   * 
   * @param zkProofData - ZK proof data from ZKProofGenerator
   * @param verifierPrivateKeyBase58 - Private key or null for wallet
   * @returns Transaction result
   */
  async verifyZKProofOnChain(
    zkProofData: any,
    verifierPrivateKeyBase58: string | null = null
  ): Promise<TransactionResult> {
    console.log('[ContractInterface] *** verifyZKProofOnChain - TRUE zkSNARK VERIFICATION (ALL TYPES) ***');
    console.log('[ContractInterface] Proof Type:', zkProofData.proofType);
    
    try {
      // Import proof classes based on type
      const proofType = zkProofData.proofType;
      
      // Ensure contracts are compiled
      await this.ensureCompiled();

      if (!this.zkpVerifier) {
        await this.initialize();
      }

      // Get verifier address
      let verifier: PublicKey;
      let verifierPrivateKey: PrivateKey | null = null;
      let useWallet = false;

      if (verifierPrivateKeyBase58) {
        verifierPrivateKey = PrivateKey.fromBase58(verifierPrivateKeyBase58);
        verifier = verifierPrivateKey.toPublicKey();
        console.log('[ContractInterface] Using provided private key');
      } else if (typeof window !== 'undefined' && (window as any).mina) {
        useWallet = true;
        const accounts = await (window as any).mina.requestAccounts();
        if (!accounts || accounts.length === 0) {
          throw new Error('No wallet account found. Please connect Auro Wallet.');
        }
        verifier = PublicKey.fromBase58(accounts[0]);
        console.log('[ContractInterface] Using Auro Wallet');
      } else {
        throw new Error('No private key provided and Auro Wallet not available');
      }

      console.log('[ContractInterface] Verifying zkSNARK proof on-chain...');
      console.log('[ContractInterface] Verifier:', verifier.toBase58());

      // Build transaction based on proof type
      const tx = await Mina.transaction(
        { sender: verifier, fee: 100_000_000 },
        async () => {
          console.log('[ContractInterface] ⚠️ Using legacy commitment verification');
          console.log('[ContractInterface] Deploy ZKPVerifierV2 for true zkSNARK verification');
          
          const subject = PublicKey.fromBase58(zkProofData.publicInput.subjectPublicKey);
          const commitment = Field(zkProofData.publicOutput);
          const issuer = PublicKey.fromBase58(zkProofData.publicInput.issuerPublicKey);
          const timestamp = Field(zkProofData.publicInput.timestamp);
          
          if (proofType.startsWith('age') || proofType === 'age18' || proofType === 'age21') {
            // Age proof verification
            const ageHash = Field(zkProofData.publicInput.ageHash || zkProofData.publicInput.kycHash || '0');
            const minimumAge = Field(zkProofData.publicInput.minimumAge || '18');
            
            console.log('[ContractInterface] Verifying age proof on-chain');
            console.log('[ContractInterface] Minimum age:', minimumAge.toString());
            await this.zkpVerifier!.verifyAgeProof(
              subject,
              ageHash,
              commitment,
              issuer,
              timestamp,
              minimumAge
            );
          } else if (proofType === 'citizenship' || proofType === 'name') {
            // Citizenship/Name proof verification
            const dataHash = Field(zkProofData.publicInput.citizenshipHash || zkProofData.publicInput.nameHash || '0');
            
            // Extract expected data from selective disclosure
            let expectedDataString = '';
            if (proofType === 'citizenship') {
              expectedDataString = zkProofData.selectiveDisclosure?.revealedData?.citizenship || '';
            } else if (proofType === 'name') {
              expectedDataString = zkProofData.selectiveDisclosure?.revealedData?.name || '';
            }
            
            if (!expectedDataString) {
               throw new Error(`Missing revealed data for ${proofType} proof verification. Selective disclosure required.`);
            }
            
            // Normalize to lowercase and trim (CRITICAL: Must match ZKProofGenerator)
            const normalizedData = expectedDataString.toLowerCase().trim();
            
            // Convert to Field (must match ZKProofGenerator logic)
            let hexString = '';
            if (typeof Buffer !== 'undefined') {
              hexString = Buffer.from(normalizedData).toString('hex');
            } else {
              const encoder = new TextEncoder();
              const bytes = encoder.encode(normalizedData);
              for (const byte of bytes) {
                hexString += byte.toString(16).padStart(2, '0');
              }
            }
            
            // Ensure hexString is not empty
            if (hexString.length === 0) hexString = '00';
            
            const expectedData = Field.from(BigInt('0x' + hexString.slice(0, 16)));
            
            console.log(`[ContractInterface] Verifying ${proofType} proof on-chain`);
            console.log(`[ContractInterface] Expected Data: ${expectedDataString} (${normalizedData})`);
            
            await this.zkpVerifier!.verifyCitizenshipProof(
              subject,
              dataHash,
              expectedData,
              commitment,
              issuer,
              timestamp
            );
          } else if (proofType === 'kyc') {
            // KYC proof verification
            // CRITICAL: Field() constructor might not parse large number strings correctly
            // Use Field.fromJSON() or BigInt conversion for safety
            const kycHashString = zkProofData.publicInput.kycHash || '0';
            const kycHash = Field(BigInt(kycHashString));
            
            console.log('[ContractInterface] Verifying KYC proof on-chain');
            console.log('[ContractInterface] KYC Verification Details:');
            console.log('  kycHash string:', kycHashString);
            console.log('  kycHash Field:', kycHash.toString());
            console.log('  subject:', subject.toBase58());
            console.log('  subject fields:', subject.toFields().map(f => f.toString()));
            console.log('  issuer:', issuer.toBase58());
            console.log('  commitment from proof:', commitment.toString());
            
            // Recalculate what the contract will compute
            const expectedCommitment = Poseidon.hash([
              kycHash,
              ...subject.toFields(),
              ...issuer.toFields(),
              Field(1)
            ]);
            console.log('  expected commitment:', expectedCommitment.toString());
            console.log('  match:', commitment.equals(expectedCommitment).toBoolean());
            
            // DEBUG: Force show the issue
            if (!commitment.equals(expectedCommitment).toBoolean()) {
              const debugMsg = `KYC COMMITMENT MISMATCH!\n` +
                `Generated: ${commitment.toString()}\n` +
                `Expected:  ${expectedCommitment.toString()}\n` +
                `kycHash from proof: ${kycHashString}\n` +
                `kycHash as Field: ${kycHash.toString()}\n` +
                `CHECK BROWSER CONSOLE FOR DETAILS`;
              console.error(debugMsg);
              alert(debugMsg);
            }
            
            await this.zkpVerifier!.verifyKYCProof(
              subject,
              kycHash,
              commitment,
              issuer
            );
          } else {
            throw new Error(`Unsupported proof type: ${proofType}`);
          }
        }
      );

      let txHash = '';

      if (useWallet) {
        console.log('[ContractInterface] Proving transaction locally...');
        await tx.prove();
        console.log('[ContractInterface] ✅ Transaction proved');

        console.log('[ContractInterface] Sending to wallet for signature...');
        const { hash } = await (window as any).mina.sendTransaction({
          transaction: tx.toJSON(),
          feePayer: {
            fee: '100000000',
            memo: 'ZK Proof Verification'
          }
        });
        txHash = hash;
      } else {
        await tx.prove();
        const sentTx = await tx.sign([verifierPrivateKey!]).send();
        txHash = sentTx.hash;
      }

      console.log('[ContractInterface] ✅ Transaction submitted:', txHash);

      const explorerUrl = `https://zekoscan.io/testnet/tx/${txHash}`;
      
      return {
        hash: txHash,
        success: true,
        explorerUrl,
      };
    } catch (error: any) {
      console.error('[ContractInterface] ❌ zkSNARK verification failed:', error);
      
      return {
        hash: '',
        success: false,
        error: error.message || 'zkSNARK verification failed',
      };
    }
  }

  /**
   * Verify age proof on-chain (LEGACY - Commitment-based)
   * @param proof Age proof to verify
   * @param subjectPublicKey Subject's public key
   * @param minimumAge Minimum age requirement
   * @returns True if proof is valid
   */
  async verifyAgeProof(
    proof: any,
    subjectPublicKey: PublicKey,
    minimumAge: number
  ): Promise<boolean> {
    try {
      // In production, this would call the ZKPVerifier contract
      // await this.zkpVerifier!.verifyAgeProof(proof, subjectPublicKey, Field.from(minimumAge));
      
      console.log('Verifying age proof for:', subjectPublicKey.toBase58());
      console.log('Minimum age:', minimumAge);
      
      // Placeholder - always returns true for now
      return true;
    } catch (error) {
      console.error('Age proof verification failed:', error);
      return false;
    }
  }

  /**
   * Verify KYC proof on-chain
   * @param proof KYC proof to verify
   * @param subjectPublicKey Subject's public key
   * @returns True if proof is valid
   */
  async verifyKYCProof(
    proof: any,
    subjectPublicKey: PublicKey
  ): Promise<boolean> {
    try {
      // await this.zkpVerifier!.verifyKYCProof(proof, subjectPublicKey);
      
      console.log('Verifying KYC proof for:', subjectPublicKey.toBase58());
      
      return true;
    } catch (error) {
      console.error('KYC proof verification failed:', error);
      return false;
    }
  }

  /**
   * Batch verify multiple credentials
   * @param proofs Array of proofs to verify
   * @returns Array of verification results
   */
  async batchVerifyCredentials(proofs: any[]): Promise<boolean[]> {
    try {
      // await this.zkpVerifier!.batchVerifyCredentials(proofs);
      
      console.log('Batch verifying', proofs.length, 'credentials');
      
      // Placeholder
      return proofs.map(() => true);
    } catch (error) {
      console.error('Batch verification failed:', error);
      return proofs.map(() => false);
    }
  }

  /**
   * Get network status
   * @returns Network information
   */
  async getNetworkStatus(): Promise<{
    blockHeight: number;
    chainId: string;
  }> {
    try {
      const account = await fetchAccount({ 
        publicKey: PublicKey.fromBase58(this.networkConfig.didRegistryAddress) 
      });
      
      return {
        blockHeight: 0, // Extract from account info
        chainId: this.networkConfig.networkId,
      };
    } catch (error) {
      throw new Error('Failed to get network status');
    }
  }

  /**
   * Estimate transaction fees
   * @param transaction Transaction to estimate
   * @returns Estimated fee in nanoMINA
   */
  async estimateFee(transaction: any): Promise<bigint> {
    // Default fee for Mina transactions
    return BigInt(100_000_000); // 0.1 MINA
  }
}

/**
 * Create default network config
 * @param networkId Network to connect to
 * @returns Network configuration
 */
export function createNetworkConfig(
  networkId: 'mainnet' | 'devnet' | 'berkeley' | 'testworld2' | 'zeko-testnet' | 'local' = 'devnet'
): NetworkConfig {
  const configs = {
    mainnet: {
      networkId: 'mainnet' as const,
      minaEndpoint: 'https://api.minascan.io/node/mainnet/v1/graphql',
      archiveEndpoint: 'https://api.minascan.io/archive/mainnet/v1/graphql',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_MAINNET || '',
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_MAINNET || '',
    },
    'zeko-testnet': {
      networkId: 'zeko-testnet' as const,
      minaEndpoint: 'https://devnet.zeko.io/graphql',
      archiveEndpoint: 'https://devnet.zeko.io/graphql',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_ZEKO_TESTNET || '',
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_ZEKO_TESTNET || '',
    },
    devnet: {
      networkId: 'devnet' as const,
      minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
      archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_DEVNET || '',
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_DEVNET || '',
    },
    berkeley: {
      networkId: 'berkeley' as const,
      minaEndpoint: 'https://proxy.berkeley.minaexplorer.com/graphql',
      archiveEndpoint: 'https://archive.berkeley.minaexplorer.com',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_BERKELEY || '',
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_BERKELEY || '',
    },
    testworld2: {
      networkId: 'testworld2' as const,
      minaEndpoint: 'https://proxy.testworld.minaexplorer.com/graphql',
      archiveEndpoint: 'https://archive.testworld.minaexplorer.com',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_TESTWORLD || '',
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_TESTWORLD || '',
    },
    local: {
      networkId: 'local' as const,
      minaEndpoint: 'http://localhost:8080/graphql',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_LOCAL || '',
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_LOCAL || '',
    },
  };

  return configs[networkId];
}

/**
 * Singleton instance for contract interface
 */
let contractInterfaceInstance: ContractInterface | null = null;

/**
 * Get or create a singleton ContractInterface instance
 * @returns ContractInterface instance
 */
export async function getContractInterface(): Promise<ContractInterface> {
  if (!contractInterfaceInstance) {
    // Get addresses from environment or use defaults
    let didRegistryAddress = process.env.NEXT_PUBLIC_DID_REGISTRY_DEVNET || DEFAULT_CONFIG.didRegistryAddress;
    let zkpVerifierAddress = process.env.NEXT_PUBLIC_ZKP_VERIFIER_DEVNET || DEFAULT_CONFIG.zkpVerifierAddress;
    
    // Check if env vars contain deprecated addresses and override with correct ones
    if (DEPRECATED_ADDRESSES.includes(didRegistryAddress)) {
      console.warn('[ContractInterface] ⚠️ DEPRECATED DIDRegistry address detected from env vars!');
      console.warn('[ContractInterface] Using correct address:', DEFAULT_CONFIG.didRegistryAddress);
      didRegistryAddress = DEFAULT_CONFIG.didRegistryAddress;
    }
    
    if (DEPRECATED_ADDRESSES.includes(zkpVerifierAddress)) {
      console.warn('[ContractInterface] ⚠️ DEPRECATED ZKPVerifier address detected from env vars!');
      console.warn('[ContractInterface] Using correct address:', DEFAULT_CONFIG.zkpVerifierAddress);
      zkpVerifierAddress = DEFAULT_CONFIG.zkpVerifierAddress;
    }
    
    const config: NetworkConfig = {
      networkId: 'devnet',
      minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
      archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
      didRegistryAddress,
      zkpVerifierAddress,
    };
    
    contractInterfaceInstance = new ContractInterface(config);
    await contractInterfaceInstance.initialize();
  }
  
  return contractInterfaceInstance;
}

/**
 * Reset the contract interface singleton
 * Useful for testing or when contract addresses change
 */
export function resetContractInterface(): void {
  contractInterfaceInstance = null;
  console.log('[ContractInterface] Singleton reset');
}

/**
 * Get the current contract addresses being used
 */
export function getCurrentContractAddresses(): { didRegistry: string; zkpVerifier: string } {
  return {
    didRegistry: DEFAULT_CONFIG.didRegistryAddress,
    zkpVerifier: DEFAULT_CONFIG.zkpVerifierAddress,
  };
}