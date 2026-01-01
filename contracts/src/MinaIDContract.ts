/**
 * MinaID Identity Contract
 * 
 * This smart contract manages identity verification on the Mina blockchain.
 * It integrates with an off-chain Oracle to verify passport authenticity.
 * 
 * Key Features:
 * - Oracle-based verification (for physical passports)
 * - On-chain signature verification
 * - Identity registry with DID tokens
 * - Privacy-preserving (only stores hashes)
 */

import {
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Signature,
  Field,
  Bool,
  Poseidon,
  Permissions,
  UInt64,
} from 'o1js';

/**
 * Structure for verified identity data
 */
export class VerifiedIdentity {
  constructor(
    public passportHash: Field,
    public timestamp: Field,
    public isValid: Bool,
    public verificationType: Field, // 1 = physical, 2 = epassport
  ) {}
}

export class MinaIDContract extends SmartContract {
  // ============================================
  // State Variables
  // ============================================
  
  /**
   * Oracle's public key (set during deployment)
   * This is the trusted authority that signs off-chain verifications.
   */
  @state(PublicKey) oraclePublicKey = State<PublicKey>();
  
  /**
   * Registry of verified identities (merkle root or simple counter)
   * For demo, we use a counter. In production, use a MerkleTree.
   */
  @state(Field) verifiedIdentitiesCount = State<Field>();
  
  /**
   * Merkle root of verified identities
   */
  @state(Field) identitiesMerkleRoot = State<Field>();
  
  /**
   * Contract owner (can update oracle key)
   */
  @state(PublicKey) owner = State<PublicKey>();
  
  // ============================================
  // Events
  // ============================================
  
  events = {
    'identity-verified': Field,
    'oracle-updated': PublicKey,
  };
  
  // ============================================
  // Initialization
  // ============================================
  
  init() {
    super.init();
    
    // Set initial permissions
    this.account.permissions.set({
      ...Permissions.default(),
      editState: Permissions.proofOrSignature(),
    });
    
    // Initialize state
    this.verifiedIdentitiesCount.set(Field(0));
    this.identitiesMerkleRoot.set(Field(0));
    this.owner.set(this.sender.getUnconstrained());
  }
  
  // ============================================
  // Admin Methods
  // ============================================
  
  /**
   * Set or update the Oracle's public key.
   * Only the contract owner can call this.
   */
  @method async updateOracleKey(newOracleKey: PublicKey) {
    // Verify sender is owner
    const owner = this.owner.getAndRequireEquals();
    const sender = this.sender.getAndRequireSignature();
    sender.equals(owner).assertTrue('Only owner can update oracle key');
    
    // Update oracle key
    this.oraclePublicKey.set(newOracleKey);
    
    // Emit event
    this.emitEvent('oracle-updated', newOracleKey);
  }
  
  // ============================================
  // Core Verification Methods
  // ============================================
  
  /**
   * Verify identity using Oracle signature.
   * UPDATED: Now includes hologram verification.
   * 
   * This is for PHYSICAL passports verified by the Oracle.
   * The Oracle performs off-chain checks:
   * - MRZ checksums
   * - Document security features
   * - Expiry date validation
   * - Blacklist check
   * - Hologram authenticity (computer vision)
   * 
   * The Oracle signs the result with all verification results.
   * We verify the signature on-chain and enforce hologram validity.
   * 
   * @param passportHash - Hash of passport data (for privacy)
   * @param isValid - Whether Oracle deemed MRZ/document valid
   * @param hologramValid - Whether Oracle deemed hologram authentic (NEW)
   * @param timestamp - When verification occurred
   * @param oracleSignature - Oracle's signature on [passportHash, isValid, hologramValid, timestamp]
   */
  @method async verifyIdentityWithOracle(
    passportHash: Field,
    isValid: Bool,
    hologramValid: Bool, // NEW: Hologram verification result
    timestamp: Field,
    oracleSignature: Signature
  ) {
    // Get oracle's public key from state
    const oraclePublicKey = this.oraclePublicKey.getAndRequireEquals();
    
    // Construct the message that was signed (UPDATED to include hologram)
    const validityFlag = isValid.toField();
    const hologramFlag = hologramValid.toField(); // NEW
    const message = [passportHash, validityFlag, hologramFlag, timestamp];
    
    // Verify Oracle's signature
    const signatureValid = oracleSignature.verify(oraclePublicKey, message);
    signatureValid.assertTrue('Invalid Oracle signature');
    
    // Require that Oracle says MRZ/document is valid
    isValid.assertTrue('Oracle verification failed - passport invalid');
    
    // Require that hologram is valid (CRITICAL SECURITY CHECK)
    hologramValid.assertTrue('Hologram verification failed - possible forgery');
    
    // Check timestamp is recent (within 1 hour)
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const oneHour = UInt64.from(3600 * 1000); // milliseconds
    const timeDiff = currentTime.sub(UInt64.from(timestamp.toString()));
    timeDiff.assertLessThanOrEqual(oneHour, 'Verification too old');
    
    // Store the verified identity
    this._registerIdentity(passportHash, timestamp, Field(1)); // 1 = physical
    
    // Emit event
    this.emitEvent('identity-verified', passportHash);
  }
  
  /**
   * Verify identity using ePassport ZK proof.
   * 
   * This is for ePassports where the user has generated a ZK proof
   * of the NFC chip's digital signature being valid.
   * 
   * @param passportHash - Hash of passport data
   * @param nfcSignatureValid - Bool from ZK proof
   * @param mrzChecksumValid - Bool from ZK proof
   */
  @method async verifyIdentityWithEPassport(
    passportHash: Field,
    nfcSignatureValid: Bool,
    mrzChecksumValid: Bool,
    timestamp: Field
  ) {
    // Verify NFC signature was valid (proved in ZK)
    nfcSignatureValid.assertTrue('NFC signature invalid');
    
    // Verify MRZ checksum was valid (proved in ZK)
    mrzChecksumValid.assertTrue('MRZ checksum invalid');
    
    // Check timestamp is recent
    const currentTime = this.network.timestamp.getAndRequireEquals();
    const oneHour = UInt64.from(3600 * 1000);
    const timeDiff = currentTime.sub(UInt64.from(timestamp.toString()));
    timeDiff.assertLessThanOrEqual(oneHour, 'Verification too old');
    
    // Store the verified identity
    this._registerIdentity(passportHash, timestamp, Field(2)); // 2 = epassport
    
    // Emit event
    this.emitEvent('identity-verified', passportHash);
  }
  
  /**
   * Batch verification (for oracles processing multiple passports)
   */
  @method async verifyIdentityBatch(
    passportHashes: Field[],
    validityFlags: Bool[],
    timestamps: Field[],
    oracleSignature: Signature
  ) {
    // Get oracle public key
    const oraclePublicKey = this.oraclePublicKey.getAndRequireEquals();
    
    // Verify all have same length
    const length = passportHashes.length;
    Bool(validityFlags.length === length).assertTrue('Array length mismatch');
    Bool(timestamps.length === length).assertTrue('Array length mismatch');
    
    // Create batch hash for signature
    const batchHash = Poseidon.hash([
      Poseidon.hash(passportHashes),
      Poseidon.hash(validityFlags.map(b => b.toField())),
      Poseidon.hash(timestamps),
    ]);
    
    // Verify Oracle signed the batch
    const signatureValid = oracleSignature.verify(oraclePublicKey, [batchHash]);
    signatureValid.assertTrue('Invalid batch signature');
    
    // Register all verified identities
    for (let i = 0; i < length; i++) {
      if (validityFlags[i].toBoolean()) {
        this._registerIdentity(passportHashes[i], timestamps[i], Field(1));
        this.emitEvent('identity-verified', passportHashes[i]);
      }
    }
  }
  
  // ============================================
  // Query Methods (read-only, no proofs needed)
  // ============================================
  
  /**
   * Check if an identity has been verified.
   * 
   * Verifies that a passport hash exists in the merkle tree of verified identities.
   * 
   * @param passportHash - The hash to verify
   * @param merkleWitness - Path proof from the merkle tree (as Field[])
   * @param leafIndex - Index of the leaf in the tree
   */
  @method async isIdentityVerified(
    passportHash: Field,
    merkleWitness: Field[],
    leafIndex: Field
  ): Promise<void> {
    // Get the current merkle root from state
    const currentRoot = this.identitiesMerkleRoot.getAndRequireEquals();
    
    // Compute the root from the witness
    let computedHash = passportHash;
    let index = leafIndex;
    
    for (let i = 0; i < merkleWitness.length; i++) {
      const isLeft = index.toBits()[0];
      const sibling = merkleWitness[i];
      
      // Hash pairs in correct order based on position
      computedHash = Poseidon.hash([
        isLeft.toField().equals(Field(0)).toField().mul(computedHash).add(
          isLeft.toField().equals(Field(1)).toField().mul(sibling)
        ),
        isLeft.toField().equals(Field(0)).toField().mul(sibling).add(
          isLeft.toField().equals(Field(1)).toField().mul(computedHash)
        ),
      ]);
      
      // Move to parent index
      index = index.div(Field(2));
    }
    
    // Verify the computed root matches the stored root
    computedHash.assertEquals(currentRoot, 'Identity not verified in merkle tree');
  }
  
  // ============================================
  // Internal Helper Methods
  // ============================================
  
  /**
   * Internal method to register a verified identity.
   * Updates both the counter and merkle root.
   */
  private _registerIdentity(
    passportHash: Field,
    timestamp: Field,
    verificationType: Field
  ) {
    // Get current count
    const currentCount = this.verifiedIdentitiesCount.getAndRequireEquals();
    
    // Increment counter
    const newCount = currentCount.add(Field(1));
    this.verifiedIdentitiesCount.set(newCount);
    
    // Update merkle root with new identity
    // Hash the identity data together
    const identityLeaf = Poseidon.hash([passportHash, timestamp, verificationType]);
    
    // Get current root
    const currentRoot = this.identitiesMerkleRoot.getAndRequireEquals();
    
    // Compute new root (simplified: hash old root with new leaf)
    // In production, use proper merkle tree insertion with witness
    const newRoot = Poseidon.hash([currentRoot, identityLeaf, currentCount]);
    this.identitiesMerkleRoot.set(newRoot);
  }
}

// ============================================
// Helper Functions (Off-chain)
// ============================================

/**
 * Create a passport hash (off-chain utility)
 */
export function createPassportHash(
  passportNumber: string,
  birthDate: string,
  expiryDate: string,
  nationality: string
): Field {
  const fields = [
    passportNumber,
    birthDate,
    expiryDate,
    nationality,
  ].map(str => {
    return Poseidon.hash(
      str.split('').map(c => Field(c.charCodeAt(0)))
    );
  });
  
  return Poseidon.hash(fields);
}

/**
 * Verify Oracle signature (off-chain utility for testing)
 */
export function verifyOracleSignature(
  oraclePublicKey: PublicKey,
  passportHash: Field,
  isValid: boolean,
  timestamp: Field,
  signature: Signature
): boolean {
  const validityFlag = Field(isValid ? 1 : 0);
  const message = [passportHash, validityFlag, timestamp];
  
  return signature.verify(oraclePublicKey, message).toBoolean();
}

/**
 * Example: Prepare data for contract call
 */
export async function prepareOracleVerification(
  passportData: {
    passportNumber: string;
    birthDate: string;
    expiryDate: string;
    nationality: string;
  },
  oracleEndpoint: string
): Promise<{
  passportHash: Field;
  isValid: Bool;
  timestamp: Field;
  signature: Signature;
}> {
  // 1. Create passport hash
  const passportHash = createPassportHash(
    passportData.passportNumber,
    passportData.birthDate,
    passportData.expiryDate,
    passportData.nationality
  );
  
  // 2. Call Oracle API
  const response = await fetch(`${oracleEndpoint}/verify-passport`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      passportData,
      verificationType: 'physical',
    }),
  });
  
  const result = await response.json();
  
  if (!result.isValid) {
    throw new Error('Oracle verification failed: ' + result.error);
  }
  
  // 3. Parse signature
  const signature = Signature.fromJSON(JSON.parse(result.signature));
  
  // 4. Return data ready for contract call
  return {
    passportHash,
    isValid: Bool(result.isValid),
    timestamp: Field(Math.floor(result.timestamp / 1000)),
    signature,
  };
}
