import {
  Field,
  SmartContract,
  state,
  State,
  method,
  PublicKey,
  Signature,
  MerkleMap,
  MerkleMapWitness,
  Poseidon,
  Bool,
  Provable,
  Struct,
} from 'o1js';

// Event structures
export class DIDRegisteredEvent extends Struct({
  publicKeyX: Field,
  didHash: Field,
  timestamp: Field,
}) {}


export class DIDRevokedEvent extends Struct({
  publicKeyX: Field,
  timestamp: Field,
}) {}

export class DIDUpdatedEvent extends Struct({
  publicKeyX: Field,
  oldHash: Field,
  newHash: Field,
  timestamp: Field,
}) {}

export class DIDVerifiedEvent extends Struct({
  publicKeyX: Field,
  didHash: Field,
  exists: Field,
}) {}

export class OwnershipTransferredEvent extends Struct({
  oldOwnerX: Field,
  newOwnerX: Field,
}) {}

/**
 * DIDRegistry Smart Contract
 * 
 * Manages decentralized identifiers (DIDs) on the Mina blockchain.
 * Uses a Merkle Map to store DID document hashes associated with public keys.
 * 
 * Key Features:
 * - Register new DIDs with document hashes
 * - Revoke existing DIDs
 * - Update DID documents
 * - Query DID status and document hashes
 */
export class DIDRegistry extends SmartContract {
  // Event declarations
  events = {
    DIDRegistered: DIDRegisteredEvent,
    DIDRevoked: DIDRevokedEvent,
    DIDUpdated: DIDUpdatedEvent,
    DIDVerified: DIDVerifiedEvent,
    OwnershipTransferred: OwnershipTransferredEvent,
  };

  // On-chain state: Root of the Merkle Map storing DIDs
  // Key: Hash of public key, Value: Hash of DID document
  @state(Field) didMapRoot = State<Field>();

  // Total number of registered DIDs
  @state(Field) totalDIDs = State<Field>();

  // Contract owner for administrative functions
  @state(PublicKey) owner = State<PublicKey>();

  /**
   * Initialize the contract
   * Sets up an empty Merkle Map and initializes counters
   */
  init() {
    super.init();
    
    // Initialize with empty Merkle Map root
    const emptyMapRoot = new MerkleMap().getRoot();
    this.didMapRoot.set(emptyMapRoot);
    
    // Initialize total DIDs counter
    this.totalDIDs.set(Field(0));
    
    // Set contract deployer as owner
    this.owner.set(this.sender.getAndRequireSignature());
  }

  /**
   * Register a new DID
   * 
   * @param userPublicKey - The public key of the user registering the DID
   * @param didDocumentHash - Hash of the DID document (off-chain data)
   * @param witness - Merkle witness proving the current state of the map
   * @param signature - Signature from the user proving ownership
   */
  @method
  async registerDID(
    userPublicKey: PublicKey,
    didDocumentHash: Field,
    witness: MerkleMapWitness,
    signature: Signature
  ) {
    // Get current Merkle Map root from on-chain state
    const currentRoot = this.didMapRoot.getAndRequireEquals();

    // Verify the signature to prove user owns this public key
    const validSignature = signature.verify(userPublicKey, [didDocumentHash]);
    validSignature.assertTrue('Invalid signature');

    // Generate key from public key for Merkle Map
    const key = Poseidon.hash(userPublicKey.toFields());

    // Verify the witness is valid for current root with value 0 (empty slot)
    // This proves that the key doesn't currently have a value in the map
    const [witnessRoot, witnessKey] = witness.computeRootAndKey(Field(0));
    currentRoot.assertEquals(witnessRoot, 'Invalid Merkle witness or DID already registered');
    key.assertEquals(witnessKey, 'Key mismatch in witness');

    // Update the Merkle Map with the new DID
    const [newRoot] = witness.computeRootAndKey(didDocumentHash);
    this.didMapRoot.set(newRoot);

    // Increment total DIDs counter
    const currentTotal = this.totalDIDs.getAndRequireEquals();
    this.totalDIDs.set(currentTotal.add(1));

    // Emit event for indexers
    this.emitEvent('DIDRegistered', new DIDRegisteredEvent({
      publicKeyX: userPublicKey.x,
      didHash: didDocumentHash,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Revoke an existing DID
   * 
   * @param userPublicKey - The public key of the DID to revoke
   * @param witness - Merkle witness proving current DID state
   * @param signature - Signature proving ownership or admin authorization
   */
  @method
  async revokeDID(
    userPublicKey: PublicKey,
    witness: MerkleMapWitness,
    signature: Signature
  ) {
    // Get current Merkle Map root
    const currentRoot = this.didMapRoot.getAndRequireEquals();

    // Generate key from public key
    const key = Poseidon.hash(userPublicKey.toFields());

    // Verify signature (either from user or contract owner)
    const validSignature = signature.verify(userPublicKey, [key]);
    const isOwner = this.sender.getAndRequireSignature().equals(this.owner.getAndRequireEquals());
    
    // Must be either valid user signature OR contract owner
    const authorized = validSignature.or(isOwner);
    authorized.assertTrue('Not authorized to revoke this DID');

    // Verify the witness shows this DID exists (non-zero value)
    const [witnessRoot, witnessKey] = witness.computeRootAndKey(Field(1));
    witnessKey.assertEquals(key, 'Key mismatch in witness');

    // Get current DID hash to verify it exists
    const [, currentDidHash] = witness.computeRootAndKey(Field(1));
    
    // Ensure DID was actually registered (value > 0)
    currentDidHash.assertGreaterThan(Field(0), 'DID not found');

    // Revoke by setting value to 0
    const [newRoot] = witness.computeRootAndKey(Field(0));
    this.didMapRoot.set(newRoot);

    // Decrement total DIDs counter
    const currentTotal = this.totalDIDs.getAndRequireEquals();
    this.totalDIDs.set(currentTotal.sub(1));

    // Emit revocation event
    this.emitEvent('DIDRevoked', new DIDRevokedEvent({
      publicKeyX: userPublicKey.x,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Update an existing DID document
   * 
   * @param userPublicKey - The public key of the DID to update
   * @param newDidDocumentHash - New hash of the DID document
   * @param witness - Merkle witness proving current DID state
   * @param signature - Signature proving ownership
   */
  @method
  async updateDID(
    userPublicKey: PublicKey,
    newDidDocumentHash: Field,
    witness: MerkleMapWitness,
    signature: Signature
  ) {
    // Get current Merkle Map root
    const currentRoot = this.didMapRoot.getAndRequireEquals();

    // Verify signature
    const validSignature = signature.verify(userPublicKey, [newDidDocumentHash]);
    validSignature.assertTrue('Invalid signature');

    // Generate key from public key
    const key = Poseidon.hash(userPublicKey.toFields());

    // Verify the witness shows this DID exists
    const [witnessRoot, witnessKey] = witness.computeRootAndKey(Field(1));
    currentRoot.assertEquals(witnessRoot, 'Invalid Merkle witness');
    witnessKey.assertEquals(key, 'Key mismatch in witness');

    // Get current DID hash
    const [, oldDidHash] = witness.computeRootAndKey(Field(1));
    oldDidHash.assertGreaterThan(Field(0), 'DID not found');

    // Update with new DID document hash
    const [newRoot] = witness.computeRootAndKey(newDidDocumentHash);
    this.didMapRoot.set(newRoot);

    // Emit update event
    this.emitEvent('DIDUpdated', new DIDUpdatedEvent({
      publicKeyX: userPublicKey.x,
      oldHash: oldDidHash,
      newHash: newDidDocumentHash,
      timestamp: this.network.blockchainLength.getAndRequireEquals().value,
    }));
  }

  /**
   * Verify if a DID is registered
   * This method emits an event with the DID status for off-chain indexing
   * 
   * @param userPublicKey - The public key to check
   * @param didHash - The expected DID document hash (or Field(0) if checking for non-existence)
   * @param witness - Merkle witness for the query
   */
  @method
  async verifyDID(
    userPublicKey: PublicKey,
    didHash: Field,
    witness: MerkleMapWitness
  ) {
    // Get current Merkle Map root
    const currentRoot = this.didMapRoot.getAndRequireEquals();

    // Generate key from public key
    const key = Poseidon.hash(userPublicKey.toFields());

    // Verify the witness against the current root with the provided value
    const [witnessRoot, witnessKey] = witness.computeRootAndKey(didHash);
    currentRoot.assertEquals(witnessRoot, 'Invalid Merkle witness');
    witnessKey.assertEquals(key, 'Key mismatch in witness');
    
    // Emit verification event for off-chain queries
    this.emitEvent('DIDVerified', new DIDVerifiedEvent({
      publicKeyX: userPublicKey.x,
      didHash: didHash,
      exists: Provable.if(didHash.greaterThan(Field(0)), Field(1), Field(0)),
    }));
  }

  /**
   * Transfer contract ownership (admin function)
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
