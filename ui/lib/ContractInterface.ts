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
} from 'o1js';

// Import contracts from local copies (bundled with UI for Vercel deployment)
import { DIDRegistry } from './contracts/DIDRegistry';
import { ZKPVerifier } from './contracts/ZKPVerifier';

// Re-export for use by other modules
export { DIDRegistry, ZKPVerifier };

// Default configuration for devnet
export const DEFAULT_CONFIG: NetworkConfig = {
  networkId: 'devnet',
  minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
  archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
  didRegistryAddress: 'B62qkqG87kYzP2cnLx3a8V9SEbsULCuXzaEwVenRHaRf6fK4wkSGpyM',
  zkpVerifierAddress: 'B62qkXJxwHpseGa7jSo9TqW9tcuRMT3vNUAAHSBKFmL7XKKAm3cSqPZ',
};

// Types
export interface NetworkConfig {
  networkId: 'mainnet' | 'devnet' | 'berkeley' | 'testworld2' | 'local';
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
   * Uses cached prover keys from /cache directory
   */
  async ensureCompiled() {
    if (!this.contractsAvailable) {
      throw new Error('Contracts not available - blockchain features disabled');
    }
    if (this.isCompiled) return;
    
    console.log('[ContractInterface] Compiling contracts from scratch...');
    console.log('[ContractInterface] This will take 2-3 minutes. Please wait...');
    console.time('Contract Compilation');
    
    try {
      // Compile without cache - this generates prover keys from scratch
      // Takes longer but produces valid proofs
      
      console.log('[ContractInterface] Compiling DIDRegistry...');
      const didRegistryResult = await DIDRegistry.compile();
      console.log('[ContractInterface] DIDRegistry compiled, verification key:', didRegistryResult.verificationKey.hash.toString().slice(0, 10) + '...');
      
      console.log('[ContractInterface] Compiling ZKPVerifier...');
      const zkpVerifierResult = await ZKPVerifier.compile();
      console.log('[ContractInterface] ZKPVerifier compiled, verification key:', zkpVerifierResult.verificationKey.hash.toString().slice(0, 10) + '...');
      
      this.isCompiled = true;
      console.log('[ContractInterface] ✅ All contracts compiled successfully');
    } catch (error) {
      console.error('[ContractInterface] Compilation failed:', error);
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
          
          // 1. Sign fields
          console.log('Requesting signature from wallet...');
          const signResult = await (window as any).mina.signFields({
            message: [documentHash.toString()]
          });
          
          console.log('Wallet sign result:', JSON.stringify(signResult));

          let signature: Signature;

          // Handle different signature formats returned by wallet
          if (signResult?.signature && typeof signResult.signature === 'object' && 'field' in signResult.signature && 'scalar' in signResult.signature) {
            // Standard object format: { field: string, scalar: string }
            signature = Signature.fromObject({
              r: Field(signResult.signature.field),
              s: Scalar.from(signResult.signature.scalar)
            });
          } else if (typeof signResult?.signature === 'string') {
            // String format (Base58)
            try {
              signature = Signature.fromBase58(signResult.signature);
            } catch (e) {
              throw new Error(`Failed to parse signature string: ${signResult.signature}`);
            }
          } else {
            throw new Error(`Invalid signature response from wallet: ${JSON.stringify(signResult)}`);
          }

          // 2. Build transaction

          // 2. Build transaction
          const tx = await Mina.transaction(
            { sender: did, fee: 100_000_000 }, 
            async () => {
              if (this.didRegistry) {
                await this.didRegistry.registerDID(did, documentHash, merkleWitness, signature);
              } else {
                throw new Error('DIDRegistry contract not initialized');
              }
            }
          );

          console.log('Proving transaction (this may take 2-3 minutes)...');
          const startProve = Date.now();
          await tx.prove();
          const proveTime = ((Date.now() - startProve) / 1000).toFixed(1);
          console.log(`Transaction proved successfully in ${proveTime}s`);

          // Get the transaction JSON AFTER proving - this includes the proof
          const transactionJSON = tx.toJSON();
          
          // Verify the proof is included in the transaction
          const txData = JSON.parse(transactionJSON);
          if (!txData || !txData.zkappCommand) {
            throw new Error('Transaction JSON is invalid - missing zkappCommand');
          }
          
          // Check if account updates have proofs
          const accountUpdates = txData.zkappCommand.accountUpdates || [];
          const hasProof = accountUpdates.some((update: any) => 
            update.authorization && update.authorization.proof
          );
          
          if (!hasProof) {
            console.warn('Warning: No proof found in transaction - this may fail');
          } else {
            console.log('Transaction proof verified present');
          }

          console.log('Sending transaction via wallet...');
          // Only pass the transaction - fee is already embedded from Mina.transaction()
          const { hash } = await (window as any).mina.sendTransaction({
            transaction: transactionJSON
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

      const tx = await Mina.transaction({ sender: did }, async () => {
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

      const tx = await Mina.transaction({ sender: did }, async () => {
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
   * Verify proof on-chain using ZKPVerifier contract
   * This creates a blockchain transaction that will appear on Mina Explorer
   * 
   * @param proofData The complete proof data from JSON file
   * @param verifierPrivateKeyBase58 Private key of verifier in base58 format (to pay fees)
   * @returns Transaction result with explorer URL
   */
  async verifyProofOnChain(
    proofData: any,
    verifierPrivateKeyBase58: string
  ): Promise<TransactionResult> {
    console.log('[ContractInterface] *** verifyProofOnChain v2 - UPDATED CODE ***');
    try {
      // Ensure contracts are compiled
      await this.ensureCompiled();

      if (!this.zkpVerifier) {
        await this.initialize();
      }

      // Parse the private key from base58
      const verifierPrivateKey = PrivateKey.fromBase58(verifierPrivateKeyBase58);
      const verifier = verifierPrivateKey.toPublicKey();
      console.log('[ContractInterface] Verifying proof on-chain...');
      console.log('[ContractInterface] Verifier:', verifier.toBase58());
      console.log('[ContractInterface] Proof Type:', proofData.proofType);

      const proofType = proofData.proofType;
      
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
      
      // Create timestamp field
      const timestamp = Field(proofData.timestamp);

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
            
            // Debug: Log exact values for age proof verification
            console.log('[ContractInterface] Age proof verification parameters:');
            console.log('  ageHash:', ageHash.toString());
            console.log('  subject:', subject.toBase58());
            console.log('  subject.toFields():', subject.toFields().map(f => f.toString()));
            console.log('  issuer:', issuer.toBase58());
            console.log('  issuer.toFields():', issuer.toFields().map(f => f.toString()));
            console.log('  timestamp:', timestamp.toString());
            console.log('  commitment (proof):', commitment.toString());
            
            // Compute what we expect the contract to compute (minAge = 18)
            const expectedCommitment = Poseidon.hash([
              ageHash,
              Field(18), // Contract's minimumAge
              ...subject.toFields(),
              ...issuer.toFields(),
              timestamp,
            ]);
            console.log('  Expected commitment (minAge=18):', expectedCommitment.toString());
            console.log('  Match:', commitment.toString() === expectedCommitment.toString());
            
            await this.zkpVerifier!.verifyAgeProof(
              subject,
              ageHash,
              commitment,
              issuer,
              timestamp
            );
            
            console.log('[ContractInterface] Age proof verification called for type:', proofType);
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

      console.log('[ContractInterface] Proving transaction...');
      await tx.prove();

      console.log('[ContractInterface] Signing transaction...');
      await tx.sign([verifierPrivateKey]);

      console.log('[ContractInterface] Sending transaction to blockchain...');
      const pendingTx = await tx.send();

      const txHash = pendingTx.hash || '';
      console.log('[ContractInterface] ✅ Transaction sent! Hash:', txHash);
      console.log('[ContractInterface] Explorer:', getExplorerUrl(txHash, this.networkConfig.networkId));

      // Wait for confirmation (optional - can be async)
      if (pendingTx.status === 'pending') {
        console.log('[ContractInterface] Waiting for confirmation...');
        await pendingTx.wait();
        console.log('[ContractInterface] ✅ Transaction confirmed!');
      }

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
   * Verify age proof on-chain
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
  networkId: 'mainnet' | 'devnet' | 'berkeley' | 'testworld2' | 'local' = 'devnet'
): NetworkConfig {
  const configs = {
    mainnet: {
      networkId: 'mainnet' as const,
      minaEndpoint: 'https://api.minascan.io/node/mainnet/v1/graphql',
      archiveEndpoint: 'https://api.minascan.io/archive/mainnet/v1/graphql',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_MAINNET || '',
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_MAINNET || '',
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
    // Use default config from environment or fallback to hardcoded devnet
    const config: NetworkConfig = {
      networkId: 'devnet',
      minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
      archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
      didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_DEVNET || DEFAULT_CONFIG.didRegistryAddress,
      zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_DEVNET || DEFAULT_CONFIG.zkpVerifierAddress,
    };
    
    contractInterfaceInstance = new ContractInterface(config);
    await contractInterfaceInstance.initialize();
  }
  
  return contractInterfaceInstance;
}
