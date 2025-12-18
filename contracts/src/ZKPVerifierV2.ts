import {
  Field,
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Poseidon,
  Struct,
  MerkleMap,
  MerkleMapWitness,
} from 'o1js';

import { AgeProof, AgeProofPublicInput } from './AgeVerificationProgram.js';

// Event structures  
class AgeVerifiedEvent extends Struct({
  subjectX: Field,
  minimumAge: Field,
  timestamp: Field,
}) {}

class KYCVerifiedEvent extends Struct({
  subjectX: Field,
  issuerX: Field,
  timestamp: Field,
}) {}

class IssuerAddedEvent extends Struct({
  issuerX: Field,
  timestamp: Field,
}) {}

class MinimumAgeUpdatedEvent extends Struct({
  oldAge: Field,
  newAge: Field,
}) {}

class OwnershipTransferredEvent extends Struct({
  oldOwnerX: Field,
  newOwnerX: Field,
}) {}

/**
 * ZKPVerifier V2 Smart Contract
 * 
 * PROOF VERIFICATION ONLY (ON-CHAIN)
 * 
 * This contract verifies zero-knowledge proofs that were generated off-chain.
 * It does NOT generate proofs - only verifies them.
 * 
 * Key Features:
 * - Verify actual zkSNARK proofs from AgeVerificationProgram
 * - Verify ZK proofs of age (e.g., age > 18) without revealing exact age
 * - Verify KYC status without revealing PII (commitment-based for now)
 * - Manage trusted issuers
 * - Track verification events
 * 
 * Architecture:
 * 1. User generates proof off-chain (2-3 min proving time)
 * 2. User submits proof to this contract
 * 3. Contract verifies proof cryptographically (fast, on-chain)
 * 4. Contract emits verification event
 */
export class ZKPVerifierV2 extends SmartContract {
  // Event declarations
  events = {
    AgeVerified: AgeVerifiedEvent,
    KYCVerified: KYCVerifiedEvent,
    IssuerAdded: IssuerAddedEvent,
    MinimumAgeUpdated: MinimumAgeUpdatedEvent,
    OwnershipTransferred: OwnershipTransferredEvent,
  };

  // Root hash of trusted issuers (using Merkle tree for scalability)
  @state(Field) trustedIssuersRoot = State<Field>();

  // Total number of verifications performed
  @state(Field) totalVerifications = State<Field>();

  // Contract owner
  @state(PublicKey) owner = State<PublicKey>();

  // Minimum age requirement for age verification
  @state(Field) minimumAge = State<Field>();

  /**
   * Initialize the contract
   */
  init() {
    super.init();
    
    // Initialize with empty Merkle Map root
    const emptyMapRoot = new MerkleMap().getRoot();
    this.trustedIssuersRoot.set(emptyMapRoot);
    
    // Initialize counters
    this.totalVerifications.set(Field(0));
    
    // Set default minimum age to 18
    this.minimumAge.set(Field(18));
    
    // Set contract deployer as owner
    this.owner.set(this.sender.getAndRequireSignature());
  }

  /**
   * Verify Age Proof (zkSNARK)
   * 
   * Verifies an actual zero-knowledge proof generated off-chain by AgeVerificationProgram.
   * The proof cryptographically demonstrates that age >= minimumAge without revealing actual age.
   * 
   * @param proof - The zkSNARK proof generated off-chain
   */
  @method
  async verifyAgeProofZK(proof: AgeProof) {
    // Verify the zkSNARK proof cryptographically
    // This checks:
    // 1. Proof was generated correctly by AgeVerificationProgram
    // 2. Public inputs match the proof
    // 3. Cryptographic signature is valid
    proof.verify();

    // Extract public inputs from the proof
    const publicInput = proof.publicInput;
    const subject = publicInput.subjectPublicKey;
    const minAge = publicInput.minimumAge;
    const timestamp = publicInput.timestamp;

    // Get contract's minimum age requirement
    const contractMinAge = this.minimumAge.getAndRequireEquals();

    // Verify proof meets contract's minimum age requirement
    minAge.assertGreaterThanOrEqual(contractMinAge, 'Proof minimum age is less than contract requirement');

    // Increment verification counter
    const currentTotal = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentTotal.add(1));

    // Emit verification event
    this.emitEvent('AgeVerified', new AgeVerifiedEvent({
      subjectX: subject.x,
      minimumAge: minAge,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Verify Age Proof (Legacy Commitment-Based)
   * 
   * Backward compatibility for commitment-based proofs.
   * This is simpler but less secure than zkSNARK proofs.
   * 
   * @param subject - Public key of the person whose age is being verified
   * @param ageHash - Hash of the actual age (kept private)
   * @param commitment - Commitment from proof generation
   * @param issuerPublicKey - Public key of the credential issuer
   * @param timestamp - Timestamp from the proof
   */
  @method
  async verifyAgeProofCommitment(
    subject: PublicKey,
    ageHash: Field,
    commitment: Field,
    issuerPublicKey: PublicKey,
    timestamp: Field
  ) {
    // Get minimum age requirement
    const minAge = this.minimumAge.getAndRequireEquals();

    // Create commitment hash that should match
    const expectedCommitment = Poseidon.hash([
      ageHash,
      minAge,
      ...subject.toFields(),
      ...issuerPublicKey.toFields(),
      timestamp,
    ]);

    // Verify the commitment matches
    commitment.assertEquals(expectedCommitment, 'Invalid age proof commitment');

    // Increment verification counter
    const currentTotal = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentTotal.add(1));

    // Emit verification event
    this.emitEvent('AgeVerified', new AgeVerifiedEvent({
      subjectX: subject.x,
      minimumAge: minAge,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Verify KYC Proof (Commitment-Based)
   * 
   * Verifies that a user has completed KYC verification
   * without revealing personal information.
   * 
   * @param subject - Public key of the person whose KYC is being verified
   * @param kycHash - Hash of KYC data
   * @param commitment - Commitment from proof generation
   * @param issuerPublicKey - Public key of KYC issuer
   */
  @method
  async verifyKYCProof(
    subject: PublicKey,
    kycHash: Field,
    commitment: Field,
    issuerPublicKey: PublicKey
  ) {
    // Create commitment that should match the proof
    const expectedCommitment = Poseidon.hash([
      kycHash,
      ...subject.toFields(),
      ...issuerPublicKey.toFields(),
      Field(1) // KYC verified flag
    ]);

    // Verify the commitment
    commitment.assertEquals(expectedCommitment, 'Invalid KYC proof');

    // Increment verification counter
    const currentTotal = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentTotal.add(1));

    // Emit KYC verification event
    this.emitEvent('KYCVerified', new KYCVerifiedEvent({
      subjectX: subject.x,
      issuerX: issuerPublicKey.x,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Add Trusted Issuer
   * 
   * Only contract owner can add trusted issuers.
   * Uses a Merkle Map to efficiently store and verify trusted issuers.
   * 
   * @param issuer - Public key of the issuer to trust
   * @param witness - Merkle witness proving the current state of the map
   */
  @method
  async addTrustedIssuer(issuer: PublicKey, witness: MerkleMapWitness) {
    // Verify sender is owner
    const owner = this.owner.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(owner);

    // Get current Merkle Map root from on-chain state
    const currentRoot = this.trustedIssuersRoot.getAndRequireEquals();

    // Generate key from issuer's public key for Merkle Map
    const key = Poseidon.hash(issuer.toFields());

    // Verify the witness is valid for current root with value 0 (empty slot)
    // This proves that the issuer is not already in the trusted list
    const [witnessRoot, witnessKey] = witness.computeRootAndKey(Field(0));
    currentRoot.assertEquals(witnessRoot, 'Invalid Merkle witness or issuer already trusted');
    key.assertEquals(witnessKey, 'Key mismatch in witness');

    // Update the Merkle Map with the new trusted issuer (value = 1 means trusted)
    const [newRoot] = witness.computeRootAndKey(Field(1));
    this.trustedIssuersRoot.set(newRoot);

    // Emit event
    this.emitEvent('IssuerAdded', new IssuerAddedEvent({
      issuerX: issuer.x,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Verify Trusted Issuer
   * 
   * Verifies that an issuer is in the trusted issuers list using a Merkle witness.
   * This method can be called by verification methods to ensure issuers are trusted.
   * 
   * @param issuer - Public key of the issuer to verify
   * @param witness - Merkle witness proving the issuer is in the trusted list
   */
  @method
  async verifyTrustedIssuer(issuer: PublicKey, witness: MerkleMapWitness) {
    // Get current Merkle Map root from on-chain state
    const currentRoot = this.trustedIssuersRoot.getAndRequireEquals();

    // Generate key from issuer's public key for Merkle Map
    const key = Poseidon.hash(issuer.toFields());

    // Verify the witness proves the issuer is trusted (value = 1)
    const [witnessRoot, witnessKey] = witness.computeRootAndKey(Field(1));
    currentRoot.assertEquals(witnessRoot, 'Invalid Merkle witness or issuer not trusted');
    key.assertEquals(witnessKey, 'Key mismatch in witness');
  }

  /**
   * Update Minimum Age Requirement
   * 
   * Only contract owner can update minimum age.
   * 
   * @param newMinimumAge - New minimum age requirement
   */
  @method
  async updateMinimumAge(newMinimumAge: Field) {
    // Verify sender is owner
    const owner = this.owner.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(owner);

    // Get old minimum age
    const oldMinAge = this.minimumAge.getAndRequireEquals();

    // Update minimum age
    this.minimumAge.set(newMinimumAge);

    // Emit event
    this.emitEvent('MinimumAgeUpdated', new MinimumAgeUpdatedEvent({
      oldAge: oldMinAge,
      newAge: newMinimumAge,
    }));
  }

  /**
   * Transfer Ownership
   * 
   * Transfer contract ownership to a new address.
   * 
   * @param newOwner - Public key of new owner
   */
  @method
  async transferOwnership(newOwner: PublicKey) {
    // Verify sender is current owner
    const currentOwner = this.owner.getAndRequireEquals();
    this.sender.getAndRequireSignature().assertEquals(currentOwner);

    // Update owner
    this.owner.set(newOwner);

    // Emit event
    this.emitEvent('OwnershipTransferred', new OwnershipTransferredEvent({
      oldOwnerX: currentOwner.x,
      newOwnerX: newOwner.x,
    }));
  }

  /**
   * Get Total Verifications
   * 
   * Returns the total number of successful verifications.
   */
  @method.returns(Field)
  async getTotalVerifications(): Promise<Field> {
    return this.totalVerifications.getAndRequireEquals();
  }

  /**
   * Get Minimum Age Requirement
   * 
   * Returns the current minimum age requirement.
   */
  @method.returns(Field)
  async getMinimumAge(): Promise<Field> {
    return this.minimumAge.getAndRequireEquals();
  }
}
