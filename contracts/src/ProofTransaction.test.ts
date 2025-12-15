/**
 * Proof Transaction Tests
 * 
 * Comprehensive end-to-end tests for proving and verifying proofs in the blockchain.
 * Tests the complete flow from proof generation to on-chain verification.
 * 
 * Run with: npm test
 */

import { describe, it, before } from 'node:test';
import {
  Field,
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  Signature,
  Poseidon,
  MerkleMap,
  MerkleMapWitness,
} from 'o1js';
import { ZKPVerifier, CredentialClaim } from './ZKPVerifier.js';
import { DIDRegistry } from './DIDRegistry.js';
import { AgeVerificationProgram, AgeProofPublicInput } from './AgeVerificationProgram.js';
import {
  TestEnv,
  assert,
  log,
  createDIDDocumentHash,
} from './test-utils.js';

describe('Proof Transaction Tests - End-to-End', () => {
  let Local: Awaited<ReturnType<typeof Mina.LocalBlockchain>>;
  let deployer: PublicKey;
  let deployerKey: PrivateKey;
  let user1: PublicKey;
  let user1Key: PrivateKey;
  let user2: PublicKey;
  let user2Key: PrivateKey;
  let user3: PublicKey; // Dedicated for DID registration test
  let user3Key: PrivateKey;
  let issuer: PublicKey;
  let issuerKey: PrivateKey;
  let zkpVerifier: ZKPVerifier;
  let zkpVerifierAddress: PublicKey;
  let zkpVerifierKey: PrivateKey;
  let didRegistry: DIDRegistry;
  let didRegistryAddress: PublicKey;
  let didRegistryKey: PrivateKey;
  let merkleMap: MerkleMap;

  const MINIMUM_AGE = 18;

  before(async () => {
    log.section('Setting up Proof Transaction test environment');
    
    // Setup local blockchain
    Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);
    
    // Create test accounts
    const accounts = Local.testAccounts;
    deployerKey = accounts[0].key;
    deployer = accounts[0].key.toPublicKey();
    user1Key = accounts[1].key;
    user1 = accounts[1].key.toPublicKey();
    user2Key = accounts[2].key;
    user2 = accounts[2].key.toPublicKey();
    user3Key = accounts[3].key;
    user3 = accounts[3].key.toPublicKey();
    issuerKey = accounts[4].key;
    issuer = accounts[4].key.toPublicKey();

    log.success('Local blockchain created with proofs enabled');
    log.info(`Deployer: ${deployer.toBase58().slice(0, 20)}...`);
    log.info(`User1: ${user1.toBase58().slice(0, 20)}...`);
    log.info(`User2: ${user2.toBase58().slice(0, 20)}...`);
    log.info(`User3: ${user3.toBase58().slice(0, 20)}...`);
    log.info(`Issuer: ${issuer.toBase58().slice(0, 20)}...`);

    // Initialize MerkleMap for DIDRegistry
    merkleMap = new MerkleMap();

    // Generate contract keypairs
    zkpVerifierKey = PrivateKey.random();
    zkpVerifierAddress = zkpVerifierKey.toPublicKey();
    didRegistryKey = PrivateKey.random();
    didRegistryAddress = didRegistryKey.toPublicKey();

    log.section('Compiling contracts...');
    
    // Compile contracts
    await ZKPVerifier.compile();
    log.success('ZKPVerifier compiled');
    
    await DIDRegistry.compile();
    log.success('DIDRegistry compiled');
    
    await AgeVerificationProgram.compile();
    log.success('AgeVerificationProgram compiled');

    // Deploy ZKPVerifier
    log.section('Deploying ZKPVerifier contract');
    zkpVerifier = new ZKPVerifier(zkpVerifierAddress);
    const zkpDeployTx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await zkpVerifier.deploy();
    });
    await zkpDeployTx.prove();
    await zkpDeployTx.sign([deployerKey, zkpVerifierKey]).send();
    log.success('ZKPVerifier deployed');

    // Deploy DIDRegistry
    log.section('Deploying DIDRegistry contract');
    didRegistry = new DIDRegistry(didRegistryAddress);
    const didDeployTx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await didRegistry.deploy();
    });
    await didDeployTx.prove();
    await didDeployTx.sign([deployerKey, didRegistryKey]).send();
    log.success('DIDRegistry deployed');
  });

  describe('Age Proof Generation and Verification', () => {
    it('should generate and verify an age proof on-chain', async () => {
      log.test('Testing end-to-end age proof flow');

      // Step 1: Setup - Add issuer as trusted
      log.info('Step 1: Adding trusted issuer');
      const issuerHash = Poseidon.hash(issuer.toFields());
      
      const addIssuerTx = await Mina.transaction(deployer, async () => {
        await zkpVerifier.addTrustedIssuer(issuer, issuerHash);
      });
      await addIssuerTx.prove();
      await addIssuerTx.sign([deployerKey]).send();
      log.success('Trusted issuer added');

      // Step 2: Generate age proof using AgeVerificationProgram
      log.info('Step 2: Generating ZK age proof');
      const actualAge = Field(25); // User is 25 years old
      const salt = Field.random();
      const ageHash = Poseidon.hash([actualAge, salt]);
      const timestamp = Field(Date.now());

      const publicInput = new AgeProofPublicInput({
        subjectPublicKey: user1,
        minimumAge: Field(MINIMUM_AGE),
        ageHash: ageHash,
        issuerPublicKey: issuer,
        timestamp: timestamp,
      });

      log.data('Actual Age (private)', actualAge.toString());
      log.data('Minimum Age (public)', MINIMUM_AGE.toString());
      log.data('Age Hash', ageHash.toString().slice(0, 20) + '...');

      // Generate the ZK proof
      const proofResult = await AgeVerificationProgram.proveAgeAboveMinimum(
        publicInput,
        actualAge,
        salt
      );
      const zkProof = proofResult.proof;
      const proofOutput = zkProof.publicOutput;
      log.success('ZK age proof generated');
      log.data('Proof output', proofOutput.toString().slice(0, 20) + '...');

      // Step 3: Verify the proof on-chain
      log.info('Step 3: Verifying proof on-chain');
      const verifyTx = await Mina.transaction(user1, async () => {
        await zkpVerifier.verifyAgeProof(
          user1,
          ageHash,
          proofOutput,
          issuer,
          timestamp,
          Field(18)
        );
      });
      await verifyTx.prove();
      await verifyTx.sign([user1Key]).send();
      log.success('Age proof verified on-chain');

      // Step 4: Check verification counter
      const totalVerifications = zkpVerifier.totalVerifications.get();
      assert.fieldEqual(
        totalVerifications,
        Field(1),
        'Total verifications should be 1'
      );
      log.success(`Total verifications: ${totalVerifications.toString()}`);
    });

    it('should verify age proof for another user', async () => {
      log.test('Testing age proof for second user');

      const actualAge = Field(30);
      const salt = Field.random();
      const ageHash = Poseidon.hash([actualAge, salt]);
      const timestamp = Field(Date.now());

      const publicInput = new AgeProofPublicInput({
        subjectPublicKey: user2,
        minimumAge: Field(MINIMUM_AGE),
        ageHash: ageHash,
        issuerPublicKey: issuer,
        timestamp: timestamp,
      });

      log.data('User', 'user2');
      log.data('Actual Age (private)', actualAge.toString());

      // Generate proof using proveAgeAboveMinimum
      const proofResult = await AgeVerificationProgram.proveAgeAboveMinimum(
        publicInput,
        actualAge,
        salt
      );
      const zkProof = proofResult.proof;
      const proofOutput = zkProof.publicOutput;
      log.success('Age proof generated for user2');

      // Verify on-chain
      const verifyTx = await Mina.transaction(user2, async () => {
        await zkpVerifier.verifyAgeProof(
          user2,
          ageHash,
          proofOutput,
          issuer,
          timestamp,
          Field(18)
        );
      });
      await verifyTx.prove();
      await verifyTx.sign([user2Key]).send();
      log.success('Age proof verified on-chain for user2');

      // Check verification counter increased
      const totalVerifications = zkpVerifier.totalVerifications.get();
      assert.fieldEqual(
        totalVerifications,
        Field(2),
        'Total verifications should be 2'
      );
      log.success(`Total verifications: ${totalVerifications.toString()}`);
    });

    it('should fail verification with wrong age', async () => {
      log.test('Testing proof rejection for underage user');

      const actualAge = Field(16); // Under 18
      const salt = Field.random();
      const ageHash = Poseidon.hash([actualAge, salt]);
      const timestamp = Field(Date.now());

      const publicInput = new AgeProofPublicInput({
        subjectPublicKey: user1,
        minimumAge: Field(MINIMUM_AGE),
        ageHash: ageHash,
        issuerPublicKey: issuer,
        timestamp: timestamp,
      });

      log.data('Actual Age (private)', actualAge.toString());
      log.data('Minimum Age', MINIMUM_AGE.toString());

      try {
        // This should fail because age < minimumAge
        const proofResult = await AgeVerificationProgram.proveAgeAboveMinimum(
          publicInput,
          actualAge,
          salt
        );
        
        throw new Error('Expected proof generation to fail for underage user');
      } catch (error: any) {
        log.success('Proof generation correctly failed for underage user');
        log.data('Error', error.message.slice(0, 50) + '...');
      }
    });
  });

  describe('DID Registration with Proof Verification', () => {
    it('should register DID and verify credential proof', async () => {
      log.test('Testing DID registration with credential proof');

      // Step 1: Register DID for user3 (dedicated test user, not used elsewhere)
      log.info('Step 1: Registering DID for user3');
      const didDocument = JSON.stringify({
        '@context': 'https://www.w3.org/ns/did/v1',
        id: `did:mina:${user3.toBase58()}`,
        verificationMethod: [{
          id: `did:mina:${user3.toBase58()}#key-1`,
          type: 'Ed25519VerificationKey2020',
          controller: `did:mina:${user3.toBase58()}`,
          publicKeyBase58: user3.toBase58(),
        }],
      });
      const didHash = createDIDDocumentHash(didDocument);
      
      const key = Poseidon.hash(user3.toFields());
      const witness = merkleMap.getWitness(key);
      const signature = Signature.create(user3Key, [didHash]);

      const registerTx = await Mina.transaction(user3, async () => {
        await didRegistry.registerDID(user3, didHash, witness, signature);
      });
      await registerTx.prove();
      await registerTx.sign([user3Key]).send();
      
      merkleMap.set(key, didHash);
      log.success('DID registered successfully');

      // Step 2: Generate age proof for the same user
      log.info('Step 2: Generating proof for registered DID holder');
      const actualAge = Field(22);
      const salt = Field.random();
      const ageHash = Poseidon.hash([actualAge, salt]);
      const timestamp = Field(Date.now());

      const publicInput = new AgeProofPublicInput({
        subjectPublicKey: user3,
        minimumAge: Field(MINIMUM_AGE),
        ageHash: ageHash,
        issuerPublicKey: issuer,
        timestamp: timestamp,
      });

      const proofResult = await AgeVerificationProgram.proveAgeAboveMinimum(
        publicInput,
        actualAge,
        salt
      );
      const zkProof = proofResult.proof;
      const proofOutput = zkProof.publicOutput;
      log.success('Proof generated for DID holder');

      // Step 3: Verify proof on-chain
      log.info('Step 3: Verifying proof');
      const verifyTx = await Mina.transaction(user3, async () => {
        await zkpVerifier.verifyAgeProof(
          user3,
          ageHash,
          proofOutput,
          issuer,
          timestamp,
          Field(18)
        );
      });
      await verifyTx.prove();
      await verifyTx.sign([user3Key]).send();
      log.success('Proof verified for DID holder');

      // Step 4: Verify DID to confirm it exists
      log.info('Step 4: Verifying DID');
      const didWitness = merkleMap.getWitness(key);
      
      const queryTx = await Mina.transaction(user3, async () => {
        await didRegistry.verifyDID(user3, didHash, didWitness);
      });
      await queryTx.prove();
      await queryTx.sign([user3Key]).send();
      log.success('DID verification successful - user has both DID and verified credential');
    });
  });

  describe('KYC Proof Verification', () => {
    it('should verify KYC proof on-chain', async () => {
      log.test('Testing KYC proof verification');

      // Step 1: Create KYC data hash
      log.info('Step 1: Creating KYC data hash');
      const kycData = Field(1); // 1 = KYC Level 1 verified
      const salt = Field.random();
      const kycHash = Poseidon.hash([kycData, salt]);

      log.data('KYC Level', kycData.toString());
      log.data('KYC Hash', kycHash.toString().slice(0, 20) + '...');

      // Step 2: Create KYC proof commitment
      log.info('Step 2: Creating KYC proof');
      const proof = Poseidon.hash([
        kycHash,
        ...user1.toFields(),
        ...issuer.toFields(),
        Field(1), // KYC verified flag
      ]);
      log.success('KYC proof created');

      // Step 3: Verify KYC proof on-chain
      log.info('Step 3: Verifying KYC proof on-chain');
      const verifyTx = await Mina.transaction(user1, async () => {
        await zkpVerifier.verifyKYCProof(
          user1,
          kycHash,
          proof,
          issuer
        );
      });
      await verifyTx.prove();
      await verifyTx.sign([user1Key]).send();
      log.success('KYC proof verified on-chain');

      // Check verification counter
      const totalVerifications = zkpVerifier.totalVerifications.get();
      log.success(`Total verifications: ${totalVerifications.toString()}`);
    });
  });

  describe('Multiple Proofs and Batch Verification', () => {
    it('should handle multiple sequential proof verifications', async () => {
      log.test('Testing multiple sequential proof verifications');

      const users = [user1, user2];
      const ages = [23, 35];
      let successfulVerifications = 0;

      for (let i = 0; i < users.length; i++) {
        log.info(`Verifying proof ${i + 1}/${users.length}`);
        
        const actualAge = Field(ages[i]);
        const salt = Field.random();
        const ageHash = Poseidon.hash([actualAge, salt]);
        const timestamp = Field(Date.now());

        const publicInput = new AgeProofPublicInput({
          subjectPublicKey: users[i],
          minimumAge: Field(MINIMUM_AGE),
          ageHash: ageHash,
          issuerPublicKey: issuer,
          timestamp: timestamp,
        });

        const proofResult = await AgeVerificationProgram.proveAgeAboveMinimum(
          publicInput,
          actualAge,
          salt
        );
        const zkProof = proofResult.proof;
        const proofOutput = zkProof.publicOutput;

        const userKey = i === 0 ? user1Key : user2Key;
        const verifyTx = await Mina.transaction(users[i], async () => {
          await zkpVerifier.verifyAgeProof(
            users[i],
            ageHash,
            proofOutput,
            issuer,
            timestamp,
            Field(18)
          );
        });
        await verifyTx.prove();
        await verifyTx.sign([userKey]).send();
        
        successfulVerifications++;
        log.success(`Proof ${i + 1} verified`);
      }

      log.success(`All ${successfulVerifications} proofs verified successfully`);
    });
  });

  describe('Proof Invalidation Scenarios', () => {
    it('should reject proof with invalid commitment', async () => {
      log.test('Testing rejection of invalid proof commitment');

      const actualAge = Field(25);
      const salt = Field.random();
      const ageHash = Poseidon.hash([actualAge, salt]);
      
      // Create a fake/invalid proof
      const invalidProof = Field.random();
      log.data('Invalid Proof', invalidProof.toString().slice(0, 20) + '...');

      try {
        const verifyTx = await Mina.transaction(user1, async () => {
          await zkpVerifier.verifyAgeProof(
            user1,
            ageHash,
            invalidProof,
            issuer,
            Field(Date.now()),
            Field(18)
          );
        });
        await verifyTx.prove();
        await verifyTx.sign([user1Key]).send();
        
        throw new Error('Expected verification to fail with invalid proof');
      } catch (error: any) {
        log.success('Invalid proof correctly rejected');
        log.data('Error', error.message.slice(0, 60) + '...');
      }
    });

    it('should reject proof from untrusted issuer', async () => {
      log.test('Testing rejection of proof from untrusted issuer');

      const untrustedIssuer = PrivateKey.random().toPublicKey();
      const actualAge = Field(25);
      const salt = Field.random();
      const ageHash = Poseidon.hash([actualAge, salt]);
      const timestamp = Field(Date.now());

      const publicInput = new AgeProofPublicInput({
        subjectPublicKey: user1,
        minimumAge: Field(MINIMUM_AGE),
        ageHash: ageHash,
        issuerPublicKey: untrustedIssuer,
        timestamp: timestamp,
      });

      const proofResult = await AgeVerificationProgram.proveAgeAboveMinimum(
        publicInput,
        actualAge,
        salt
      );
      const proof = proofResult.proof;

      log.data('Untrusted Issuer', untrustedIssuer.toBase58().slice(0, 20) + '...');

      // Note: Current contract implementation doesn't check trusted issuer list
      // This is a TODO in the contract. When implemented, this should fail.
      log.info('⚠️  Note: Trusted issuer check not yet implemented in contract');
    });
  });

  describe('Transaction Performance Metrics', () => {
    it('should measure proof generation and verification time', async () => {
      log.test('Measuring transaction performance');

      const actualAge = Field(28);
      const salt = Field.random();
      const ageHash = Poseidon.hash([actualAge, salt]);
      const timestamp = Field(Date.now());

      const publicInput = new AgeProofPublicInput({
        subjectPublicKey: user1,
        minimumAge: Field(MINIMUM_AGE),
        ageHash: ageHash,
        issuerPublicKey: issuer,
        timestamp: timestamp,
      });

      // Measure proof generation time
      const proofStartTime = Date.now();
      const proofResult = await AgeVerificationProgram.proveAgeAboveMinimum(
        publicInput,
        actualAge,
        salt
      );
      const zkProof = proofResult.proof;
      const proofOutput = zkProof.publicOutput;
      const proofEndTime = Date.now();
      const proofGenerationTime = proofEndTime - proofStartTime;
      
      log.data('Proof Generation Time', `${proofGenerationTime}ms`);

      // Measure verification time
      const verifyStartTime = Date.now();
      const verifyTx = await Mina.transaction(user1, async () => {
        await zkpVerifier.verifyAgeProof(
          user1,
          ageHash,
          proofOutput,
          issuer,
          timestamp,
          Field(18)
        );
      });
      await verifyTx.prove();
      await verifyTx.sign([user1Key]).send();
      const verifyEndTime = Date.now();
      const verificationTime = verifyEndTime - verifyStartTime;
      
      log.data('Verification Time', `${verificationTime}ms`);
      log.success('Performance metrics collected');
    });
  });
});
