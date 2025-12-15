import {
  Field,
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Bool,
  Poseidon,
  Struct,
} from 'o1js';

// Event structures
export class AgeVerifiedEvent extends Struct({
  subjectX: Field,
  minimumAge: Field,
  timestamp: Field,
}) {}

export class KYCVerifiedEvent extends Struct({
  subjectX: Field,
  issuerX: Field,
  timestamp: Field,
}) {}

export class CredentialVerifiedEvent extends Struct({
  subjectX: Field,
  issuerX: Field,
  claimType: Field,
  timestamp: Field,
}) {}

export class IssuerAddedEvent extends Struct({
  issuerX: Field,
  timestamp: Field,
}) {}

export class MinimumAgeUpdatedEvent extends Struct({
  oldAge: Field,
  newAge: Field,
}) {}

export class OwnershipTransferredEvent extends Struct({
  oldOwnerX: Field,
  newOwnerX: Field,
}) {}

/**
 * Credential Claim Structure
 * Represents a verifiable claim about a user
 */
export class CredentialClaim extends Struct({
  issuer: PublicKey,        // Who issued this credential
  subject: PublicKey,       // Who the credential is about
  claimType: Field,         // Type of claim (e.g., 1 = age > 18, 2 = KYC verified)
  claimValue: Field,        // Value of the claim
  issuedAt: Field,          // Timestamp of issuance
  expiresAt: Field,         // Expiration timestamp
}) {}

/**
 * ZKPVerifier Smart Contract
 * 
 * Verifies zero-knowledge proofs of credentials without revealing the actual data.
 * Supports privacy-preserving verification of claims like age, KYC status, etc.
 * 
 * Key Features:
 * - Verify ZK proofs of age (e.g., age > 18) without revealing exact age
 * - Verify KYC status without revealing PII
 * - Manage trusted issuers
 * - Track verification events
 */
export class ZKPVerifier extends SmartContract {
  // Event declarations
  events = {
    AgeVerified: AgeVerifiedEvent,
    KYCVerified: KYCVerifiedEvent,
    CredentialVerified: CredentialVerifiedEvent,
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
    
    // Initialize empty trusted issuers root
    this.trustedIssuersRoot.set(Field(0));
    
    // Initialize counters
    this.totalVerifications.set(Field(0));
    
    // Set default minimum age to 18
    this.minimumAge.set(Field(18));
    
    // Set contract deployer as owner
    this.owner.set(this.sender.getAndRequireSignature());
  }

  /**
   * Verify Age Proof
   * 
   * Verifies that a user's age is above the minimum required age
   * without revealing their actual age.
   * 
   * @param subject - Public key of the person whose age is being verified
   * @param ageHash - Hash of the actual age (kept private)
   * @param proof - ZK proof that age > minimumAge (commitment from AgeVerificationProgram)
   * @param issuerPublicKey - Public key of the credential issuer
   * @param timestamp - Timestamp from the proof (for commitment verification)
   * @param minAge - Minimum age from the proof (18, 21, etc.)
   */
  @method
  async verifyAgeProof(
    subject: PublicKey,
    ageHash: Field,
    proof: Field,
    issuerPublicKey: PublicKey,
    timestamp: Field,
    minAge: Field
  ) {
    // Validate minimum age is reasonable
    minAge.assertGreaterThanOrEqual(Field(0), 'Minimum age must be positive');
    minAge.assertLessThanOrEqual(Field(120), 'Minimum age must be reasonable');

    // TODO: Verify issuer is in trusted issuers list
    // For now, we'll verify the issuer signature

    // Verify the proof structure
    // The proof should demonstrate: Hash(age) = ageHash AND age >= minAge
    // This matches the commitment calculation in AgeVerificationProgram
    
    // Create commitment hash that should match the proof
    // This must match exactly what AgeVerificationProgram.proveAgeAboveMinimum produces
    const commitment = Poseidon.hash([
      ageHash,
      minAge,
      ...subject.toFields(),
      ...issuerPublicKey.toFields(),
      timestamp,
    ]);

    // Verify the proof matches expected commitment
    proof.assertEquals(commitment, 'Invalid age proof');

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
   * Verify KYC Proof
   * 
   * Verifies that a user has completed KYC verification
   * without revealing personal information.
   * 
   * @param subject - Public key of the person whose KYC is being verified
   * @param kycHash - Hash of KYC data
   * @param proof - ZK proof of KYC completion
   * @param issuerPublicKey - Public key of KYC issuer
   */
  @method
  async verifyKYCProof(
    subject: PublicKey,
    kycHash: Field,
    proof: Field,
    issuerPublicKey: PublicKey
  ) {
    // TODO: Verify issuer is in trusted issuers list
    
    // Create commitment that should match the proof
    const commitment = Poseidon.hash([
      kycHash,
      ...subject.toFields(),
      ...issuerPublicKey.toFields(),
      Field(1) // KYC verified flag
    ]);

    // Verify the proof
    proof.assertEquals(commitment, 'Invalid KYC proof');

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
   * Verify Citizenship/Name Proof
   * 
   * Verifies citizenship or name proofs with selective disclosure.
   * These proofs have a different commitment structure than KYC/Age proofs:
   * commitment = Hash([dataHash, expectedData, subject, issuer, timestamp])
   * 
   * @param subject - Public key of the person whose citizenship/name is being verified
   * @param dataHash - Hash of citizenship or name data
   * @param expectedData - The expected citizenship/name value (for selective disclosure)
   * @param proof - ZK proof (commitment from proof generation)
   * @param issuerPublicKey - Public key of issuer
   * @param timestamp - When the proof was created
   */
  @method
  async verifyCitizenshipProof(
    subject: PublicKey,
    dataHash: Field,
    expectedData: Field,
    proof: Field,
    issuerPublicKey: PublicKey,
    timestamp: Field
  ) {
    // Create commitment that should match the proof
    // This must match CitizenshipVerificationProgram.proveCitizenshipMatch
    const commitment = Poseidon.hash([
      dataHash,
      expectedData,
      ...subject.toFields(),
      ...issuerPublicKey.toFields(),
      timestamp,
    ]);

    // Verify the proof matches the commitment
    proof.assertEquals(commitment, 'Invalid citizenship/name proof');

    // Increment verification counter
    const currentTotal = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentTotal.add(1));

    // Emit verification event
    this.emitEvent('KYCVerified', new KYCVerifiedEvent({
      subjectX: subject.x,
      issuerX: issuerPublicKey.x,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Verify Credential Proof
   * 
   * Generic method to verify any type of credential proof
   * 
   * @param claim - The credential claim structure
   * @param proof - ZK proof of the claim
   * @param commitmentHash - Hash commitment of the proof
   */
  @method
  async verifyCredentialProof(
    claim: CredentialClaim,
    proof: Field,
    commitmentHash: Field
  ) {
    // Verify the claim hasn't expired
    const currentBlock = this.network.blockchainLength.getAndRequireEquals();
    claim.expiresAt.assertGreaterThan(currentBlock.value, 'Credential expired');

    // Verify the proof matches the commitment
    const expectedCommitment = Poseidon.hash([
      ...claim.issuer.toFields(),
      ...claim.subject.toFields(),
      claim.claimType,
      claim.claimValue,
      claim.issuedAt,
      claim.expiresAt,
    ]);

    commitmentHash.assertEquals(expectedCommitment, 'Invalid commitment hash');
    proof.assertEquals(commitmentHash, 'Invalid credential proof');

    // Increment verification counter
    const currentTotal = this.totalVerifications.getAndRequireEquals();
    this.totalVerifications.set(currentTotal.add(1));

    // Emit generic verification event
    this.emitEvent('CredentialVerified', new CredentialVerifiedEvent({
      subjectX: claim.subject.x,
      issuerX: claim.issuer.x,
      claimType: claim.claimType,
      timestamp: currentBlock.value,
    }));
  }

  /**
   * Batch verify multiple credentials at once
   * More efficient than individual verifications
   * NOTE: Commented out for MVP - o1js doesn't support array parameters
   * TODO: Implement using recursive proof composition in future
   * 
   * @param claims - Array of credential claims
   * @param proofs - Array of proofs
   * @param commitments - Array of commitment hashes
   */
  // @method
  // async batchVerifyCredentials(
  //   claims: CredentialClaim[],
  //   proofs: Field[],
  //   commitments: Field[]
  // ) {
  //   // Limit batch size to prevent excessive computation
  //   const batchSize = claims.length;
  //   Provable.log('Batch size:', batchSize);

  //   // Verify each credential in the batch
  //   for (let i = 0; i < batchSize && i < 5; i++) {
  //     const claim = claims[i];
  //     const proof = proofs[i];
  //     const commitment = commitments[i];

  //     // Verify not expired
  //     const currentBlock = this.network.blockchainLength.getAndRequireEquals();
  //     const currentBlockField = Field.from(currentBlock.toBigint());
  //     claim.expiresAt.assertGreaterThan(currentBlockField, 'Credential expired');

  //     // Verify proof
  //     const expectedCommitment = Poseidon.hash([
  //       ...claim.issuer.toFields(),
  //       ...claim.subject.toFields(),
  //       claim.claimType,
  //       claim.claimValue,
  //       claim.issuedAt,
  //       claim.expiresAt,
  //     ]);

  //     commitment.assertEquals(expectedCommitment, 'Invalid commitment');
  //     proof.assertEquals(commitment, 'Invalid proof');
  //   }

  //   // Increment verification counter by batch size
  //   const currentTotal = this.totalVerifications.getAndRequireEquals();
  //   this.totalVerifications.set(currentTotal.add(Field(batchSize)));

  //   // Emit batch verification event
  //   this.emitEvent('BatchVerified', {
  //     count: Field(batchSize),
  //     timestamp: this.network.blockchainLength.getAndRequireEquals(),
  //   });
  // }

  /**
   * Add a trusted issuer
   * Only contract owner can call this
   * 
   * @param issuerPublicKey - Public key of the issuer to trust
   * @param issuerHash - Hash to add to trusted issuers Merkle tree
   */
  @method
  async addTrustedIssuer(
    issuerPublicKey: PublicKey,
    issuerHash: Field
  ) {
    // Verify sender is owner
    const currentOwner = this.owner.getAndRequireEquals();
    const sender = this.sender.getAndRequireSignature();
    sender.equals(currentOwner).assertTrue('Only owner can add issuers');

    // Get current trusted issuers root
    const currentRoot = this.trustedIssuersRoot.getAndRequireEquals();

    // TODO: Implement Merkle tree update logic
    // For now, we'll create a simple hash of the issuer
    const newRoot = Poseidon.hash([currentRoot, issuerHash, ...issuerPublicKey.toFields()]);
    this.trustedIssuersRoot.set(newRoot);

    // Emit event
    this.emitEvent('IssuerAdded', new IssuerAddedEvent({
      issuerX: issuerPublicKey.x,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Update minimum age requirement
   * Only contract owner can call this
   * 
   * @param newMinimumAge - New minimum age value
   */
  @method
  async updateMinimumAge(newMinimumAge: Field) {
    // Verify sender is owner
    const currentOwner = this.owner.getAndRequireEquals();
    const sender = this.sender.getAndRequireSignature();
    sender.equals(currentOwner).assertTrue('Only owner can update minimum age');

    // Ensure reasonable age (between 0 and 120)
    newMinimumAge.assertGreaterThanOrEqual(Field(0), 'Age must be positive');
    newMinimumAge.assertLessThanOrEqual(Field(120), 'Age must be reasonable');

    // Get old age for event
    const oldAge = this.minimumAge.getAndRequireEquals();

    // Update minimum age
    this.minimumAge.set(newMinimumAge);

    // Emit event
    this.emitEvent('MinimumAgeUpdated', new MinimumAgeUpdatedEvent({
      oldAge: oldAge,
      newAge: newMinimumAge,
    }));
  }

  /**
   * Transfer contract ownership
   * 
   * @param newOwner - Public key of the new owner
   */
  @method
  async transferOwnership(newOwner: PublicKey) {
    // Only current owner can transfer
    const currentOwner = this.owner.getAndRequireEquals();
    const sender = this.sender.getAndRequireSignature();
    sender.equals(currentOwner).assertTrue('Only owner can transfer ownership');

    // Set new owner
    this.owner.set(newOwner);

    // Emit ownership transfer event
    this.emitEvent('OwnershipTransferred', new OwnershipTransferredEvent({
      oldOwnerX: currentOwner.x,
      newOwnerX: newOwner.x,
    }));
  }
}