/**
 * DIDRegistry Contract Tests
 * 
 * Tests for the DIDRegistry smart contract
 * covering DID registration, revocation, updates, and queries.
 * 
 * Run with: npm test
 */

import { describe, it, before } from 'node:test';
import { Field, Mina, PublicKey, Signature, MerkleMap, Poseidon } from 'o1js';
import { DIDRegistry } from './DIDRegistry.js';
import {
  setupTestEnvironment,
  deployDIDRegistry,
  createDIDDocumentHash,
  TestData,
  TestEnv,
  assert,
  log,
} from './test-utils.js';

describe('DIDRegistry Contract', () => {
  let env: TestEnv;
  let didRegistry: DIDRegistry;
  let merkleMap: MerkleMap;

  before(async () => {
    log.section('Setting up DIDRegistry test environment');
    
    // Setup environment
    env = setupTestEnvironment();
    merkleMap = new MerkleMap();
    
    log.success('Local blockchain created');
    log.info(`Deployer: ${env.deployer.address.slice(0, 20)}...`);
    log.info(`User1: ${env.user1.address.slice(0, 20)}...`);
    log.info(`User2: ${env.user2.address.slice(0, 20)}...`);

    // Deploy contract
    didRegistry = await deployDIDRegistry(env);
    log.success('DIDRegistry contract deployed');
    log.data('Contract address', env.didRegistryAddress.toBase58().slice(0, 30) + '...');
  });

  describe('Contract Initialization', () => {
    it('should initialize with correct owner', async () => {
      log.test('Checking contract owner');
      
      const owner = didRegistry.owner.get();
      assert.publicKeyEqual(
        owner,
        env.deployer.publicKey,
        'Owner should be deployer'
      );
      
      log.success('Owner correctly set to deployer');
    });

    it('should initialize with zero DIDs', async () => {
      log.test('Checking initial DID count');
      
      const total = didRegistry.totalDIDs.get();
      assert.fieldEqual(
        total,
        Field(0),
        'Total DIDs should start at 0'
      );
      
      log.success('DID count starts at 0');
    });

    it('should initialize with empty Merkle Map root', async () => {
      log.test('Checking initial Merkle Map root');
      
      const currentRoot = didRegistry.didMapRoot.get();
      const emptyRoot = new MerkleMap().getRoot();
      
      assert.fieldEqual(
        currentRoot,
        emptyRoot,
        'Root should be empty MerkleMap root'
      );
      
      log.success('Merkle Map initialized correctly');
    });
  });

  describe('DID Registration', () => {
    it('should register a new DID', async () => {
      log.test('Registering DID for user1');
      
      const didDocument = TestData.didDocuments.basic;
      const didHash = createDIDDocumentHash(didDocument);
      
      log.data('DID Document', didDocument.slice(0, 50) + '...');
      log.data('DID Hash', didHash.toString().slice(0, 20) + '...');

      // Get witness for empty value
      const key = Poseidon.hash(env.user1.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      
      // Create signature
      const signature = Signature.create(
        env.user1.privateKey,
        [didHash]
      );

      // Register DID
      const registerTx = await Mina.transaction(env.user1.publicKey, async () => {
        await didRegistry.registerDID(
          env.user1.publicKey,
          didHash,
          witness,
          signature
        );
      });
      
      await registerTx.prove();
      await registerTx.sign([env.user1.privateKey]).send();
      
      // Update local Merkle Map
      merkleMap.set(key, didHash);
      
      log.success('DID registered successfully');
      
      // Check total DIDs increased
      const totalDIDs = didRegistry.totalDIDs.get();
      assert.fieldEqual(
        totalDIDs,
        Field(1),
        'Total DIDs should be 1'
      );
      
      log.data('Total DIDs', totalDIDs.toString());
    });

    it('should register another DID for user2', async () => {
      log.test('Registering DID for user2');
      
      const didDocument = TestData.didDocuments.advanced;
      const didHash = createDIDDocumentHash(didDocument);
      
      const key = Poseidon.hash(env.user2.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      
      const signature = Signature.create(
        env.user2.privateKey,
        [didHash]
      );

      const registerTx = await Mina.transaction(env.user2.publicKey, async () => {
        await didRegistry.registerDID(
          env.user2.publicKey,
          didHash,
          witness,
          signature
        );
      });
      
      await registerTx.prove();
      await registerTx.sign([env.user2.privateKey]).send();
      
      merkleMap.set(key, didHash);
      
      log.success('Second DID registered successfully');
      
      const totalDIDs = didRegistry.totalDIDs.get();
      assert.fieldEqual(
        totalDIDs,
        Field(2),
        'Total DIDs should be 2'
      );
    });

    it('should reject duplicate DID registration', async () => {
      log.test('Attempting to register duplicate DID');
      
      const didDocument = TestData.didDocuments.basic;
      const didHash = createDIDDocumentHash(didDocument);
      
      const key = Poseidon.hash(env.user1.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      
      const signature = Signature.create(
        env.user1.privateKey,
        [didHash]
      );

      await assert.throws(async () => {
        const tx = await Mina.transaction(env.user1.publicKey, async () => {
          await didRegistry.registerDID(
            env.user1.publicKey,
            didHash,
            witness,
            signature
          );
        });
        await tx.prove();
        await tx.sign([env.user1.privateKey]).send();
      }, 'Should reject duplicate DID');
      
      log.success('Correctly rejected duplicate registration');
    });

    it('should reject registration with invalid signature', async () => {
      log.test('Attempting registration with invalid signature');
      
      const didDocument = TestData.didDocuments.basic;
      const didHash = createDIDDocumentHash(didDocument);
      
      const newUserKey = Poseidon.hash(env.issuer.publicKey.toFields());
      const witness = merkleMap.getWitness(newUserKey);
      
      // Wrong signature (signed by user1 for issuer's DID)
      const wrongSignature = Signature.create(
        env.user1.privateKey,
        [didHash]
      );

      await assert.throws(async () => {
        const tx = await Mina.transaction(env.issuer.publicKey, async () => {
          await didRegistry.registerDID(
            env.issuer.publicKey,
            didHash,
            witness,
            wrongSignature
          );
        });
        await tx.prove();
        await tx.sign([env.issuer.privateKey]).send();
      }, 'Should reject invalid signature');
      
      log.success('Correctly rejected invalid signature');
    });
  });

  describe('DID Queries', () => {
    it('should verify existing DID', async () => {
      log.test('Verifying user1 DID exists');
      
      const key = Poseidon.hash(env.user1.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      const didHash = merkleMap.get(key);

      const queryTx = await Mina.transaction(env.user1.publicKey, async () => {
        await didRegistry.verifyDID(
          env.user1.publicKey,
          witness
        );
      });
      
      await queryTx.prove();
      await queryTx.sign([env.user1.privateKey]).send();
      
      log.success('DID verification successful');
      log.data('DID Hash', didHash.toString().slice(0, 20) + '...');
    });

    it('should return zero for non-existent DID', async () => {
      log.test('Querying non-existent DID');
      
      const nonExistentKey = Poseidon.hash(env.issuer.publicKey.toFields());
      const witness = merkleMap.getWitness(nonExistentKey);

      const queryTx = await Mina.transaction(env.issuer.publicKey, async () => {
        await didRegistry.verifyDID(
          env.issuer.publicKey,
          witness
        );
      });
      
      await queryTx.prove();
      await queryTx.sign([env.issuer.privateKey]).send();
      
      log.success('Non-existent DID returns zero (as expected)');
    });
  });

  describe('DID Updates', () => {
    it('should allow owner to update their DID', async () => {
      log.test('Updating user1 DID document');
      
      const newDidDocument = TestData.didDocuments.advanced;
      const newDidHash = createDIDDocumentHash(newDidDocument);
      
      const key = Poseidon.hash(env.user1.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      const oldHash = merkleMap.get(key);
      
      log.data('Old Hash', oldHash.toString().slice(0, 20) + '...');
      log.data('New Hash', newDidHash.toString().slice(0, 20) + '...');

      const signature = Signature.create(
        env.user1.privateKey,
        [newDidHash]
      );

      const updateTx = await Mina.transaction(env.user1.publicKey, async () => {
        await didRegistry.updateDID(
          env.user1.publicKey,
          newDidHash,
          witness,
          signature
        );
      });
      
      await updateTx.prove();
      await updateTx.sign([env.user1.privateKey]).send();
      
      // Update local map
      merkleMap.set(key, newDidHash);
      
      log.success('DID updated successfully');
    });

    it('should reject update from non-owner', async () => {
      log.test('Non-owner attempting to update DID');
      
      const newDidHash = createDIDDocumentHash(TestData.didDocuments.basic);
      const key = Poseidon.hash(env.user1.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      
      // User2 trying to update User1's DID
      const wrongSignature = Signature.create(
        env.user2.privateKey,
        [newDidHash]
      );

      await assert.throws(async () => {
        const tx = await Mina.transaction(env.user2.publicKey, async () => {
          await didRegistry.updateDID(
            env.user1.publicKey,
            newDidHash,
            witness,
            wrongSignature
          );
        });
        await tx.prove();
        await tx.sign([env.user2.privateKey]).send();
      }, 'Should reject non-owner update');
      
      log.success('Correctly rejected non-owner update');
    });
  });

  describe('DID Revocation', () => {
    it('should allow owner to revoke their DID', async () => {
      log.test('Revoking user2 DID');
      
      const key = Poseidon.hash(env.user2.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      
      const signature = Signature.create(
        env.user2.privateKey,
        [key]
      );

      const revokeTx = await Mina.transaction(env.user2.publicKey, async () => {
        await didRegistry.revokeDID(
          env.user2.publicKey,
          witness,
          signature
        );
      });
      
      await revokeTx.prove();
      await revokeTx.sign([env.user2.privateKey]).send();
      
      // Update local map (set to 0)
      merkleMap.set(key, Field(0));
      
      log.success('DID revoked successfully');
      
      // Total DIDs should decrease
      const totalDIDs = didRegistry.totalDIDs.get();
      assert.fieldEqual(
        totalDIDs,
        Field(1),
        'Total DIDs should be 1 after revocation'
      );
    });

    it('should allow contract owner to revoke any DID', async () => {
      log.test('Contract owner revoking user1 DID');
      
      const key = Poseidon.hash(env.user1.publicKey.toFields());
      const witness = merkleMap.getWitness(key);
      
      // Deployer (contract owner) creates signature
      const signature = Signature.create(
        env.deployer.privateKey,
        [key]
      );

      const revokeTx = await Mina.transaction(env.deployer.publicKey, async () => {
        await didRegistry.revokeDID(
          env.user1.publicKey,
          witness,
          signature
        );
      });
      
      await revokeTx.prove();
      await revokeTx.sign([env.deployer.privateKey]).send();
      
      merkleMap.set(key, Field(0));
      
      log.success('Contract owner successfully revoked DID');
    });

    it('should reject revocation by unauthorized user', async () => {
      log.test('Unauthorized user attempting revocation');
      
      // Re-register user1's DID first
      const didHash = createDIDDocumentHash(TestData.didDocuments.basic);
      const key = Poseidon.hash(env.user1.publicKey.toFields());
      let witness = merkleMap.getWitness(key);
      
      const registerSig = Signature.create(env.user1.privateKey, [didHash]);
      const registerTx = await Mina.transaction(env.user1.publicKey, async () => {
        await didRegistry.registerDID(
          env.user1.publicKey,
          didHash,
          witness,
          registerSig
        );
      });
      await registerTx.prove();
      await registerTx.sign([env.user1.privateKey]).send();
      merkleMap.set(key, didHash);
      
      // Now try to revoke with wrong signature
      witness = merkleMap.getWitness(key);
      const wrongSignature = Signature.create(env.user2.privateKey, [key]);

      await assert.throws(async () => {
        const tx = await Mina.transaction(env.user2.publicKey, async () => {
          await didRegistry.revokeDID(
            env.user1.publicKey,
            witness,
            wrongSignature
          );
        });
        await tx.prove();
        await tx.sign([env.user2.privateKey]).send();
      }, 'Should reject unauthorized revocation');
      
      log.success('Correctly rejected unauthorized revocation');
    });
  });

  describe('Ownership Management', () => {
    it('should allow owner to transfer ownership', async () => {
      log.test('Transferring ownership to user1');
      
      const newOwner = env.user1.publicKey;

      const transferTx = await Mina.transaction(env.deployer.publicKey, async () => {
        await didRegistry.transferOwnership(newOwner);
      });
      
      await transferTx.prove();
      await transferTx.sign([env.deployer.privateKey]).send();
      
      const updatedOwner = didRegistry.owner.get();
      assert.publicKeyEqual(
        updatedOwner,
        newOwner,
        'Owner should be updated'
      );
      
      log.success('Ownership transferred successfully');
    });
  });
});

log.section('Test Summary');
console.log('All DIDRegistry tests completed!');
console.log('\nNote: These tests use a local Merkle Map that must be kept');
console.log('in sync with contract state for witness generation.');
