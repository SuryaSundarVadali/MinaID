/**
 * ZKPVerifierV2 Contract Tests
 * 
 * Tests for the ZKPVerifierV2 smart contract, focusing on Merkle tree
 * implementation for trusted issuers.
 * 
 * Run with: npm test
 */

import { describe, it, before } from 'node:test';
import { 
  Field, 
  Mina, 
  PublicKey, 
  PrivateKey, 
  AccountUpdate,
  MerkleMap,
} from 'o1js';
import { ZKPVerifierV2 } from './ZKPVerifierV2.js';
import { log, assert } from './test-utils.js';

describe('ZKPVerifierV2 - Merkle Tree Implementation', () => {
  let deployer: Awaited<ReturnType<typeof Mina.LocalBlockchain>>['testAccounts'][0];
  let issuer1: Awaited<ReturnType<typeof Mina.LocalBlockchain>>['testAccounts'][0];
  let issuer2: Awaited<ReturnType<typeof Mina.LocalBlockchain>>['testAccounts'][0];
  let zkpVerifier: ZKPVerifierV2;
  let zkpVerifierAddress: PublicKey;
  let merkleMap: MerkleMap;

  before(async () => {
    log.section('Setting up ZKPVerifierV2 test environment');
    
    // Create local blockchain
    const Local = await Mina.LocalBlockchain({ proofsEnabled: false });
    Mina.setActiveInstance(Local);
    
    // Setup test accounts
    deployer = Local.testAccounts[0];
    issuer1 = Local.testAccounts[1];
    issuer2 = Local.testAccounts[2];
    
    log.success('Local blockchain created');
    log.info(`Deployer: ${deployer.toBase58().slice(0, 20)}...`);
    log.info(`Issuer1: ${issuer1.toBase58().slice(0, 20)}...`);
    log.info(`Issuer2: ${issuer2.toBase58().slice(0, 20)}...`);

    // Create Merkle map for tracking trusted issuers off-chain
    merkleMap = new MerkleMap();

    // Deploy ZKPVerifierV2 contract
    log.section('Deploying ZKPVerifierV2');
    
    const contractKey = PrivateKey.random();
    zkpVerifierAddress = contractKey.toPublicKey();
    zkpVerifier = new ZKPVerifierV2(zkpVerifierAddress);

    log.info('Compiling contract...');
    await ZKPVerifierV2.compile();
    log.success('Contract compiled');

    const deployTx = await Mina.transaction(deployer, async () => {
      AccountUpdate.fundNewAccount(deployer);
      await zkpVerifier.deploy();
    });
    
    await deployTx.prove();
    await deployTx.sign([deployer.key, contractKey]).send();
    
    log.success('ZKPVerifierV2 deployed');
    log.data('Contract address', zkpVerifierAddress.toBase58().slice(0, 30) + '...');
  });

  describe('Merkle Tree Initialization', () => {
    it('should initialize with empty Merkle Map root', async () => {
      log.test('Checking trusted issuers root initialization');
      
      const trustedIssuersRoot = zkpVerifier.trustedIssuersRoot.get();
      const emptyMapRoot = new MerkleMap().getRoot();
      
      assert.fieldEqual(
        trustedIssuersRoot,
        emptyMapRoot,
        'Trusted issuers root should be empty Merkle Map root'
      );
      
      log.success('Root correctly initialized to empty Merkle Map');
    });
  });

  describe('Adding Trusted Issuers', () => {
    it('should allow owner to add trusted issuer with Merkle witness', async () => {
      log.test('Adding issuer1 to trusted list');
      
      // Generate witness for empty slot (issuer not yet added)
      const issuer1Key = issuer1;
      const witness = merkleMap.getWitness(
        Field.from(BigInt('0x' + issuer1Key.toFields()[0].toBigInt().toString(16)))
      );
      
      // Add issuer
      const addTx = await Mina.transaction(deployer, async () => {
        await zkpVerifier.addTrustedIssuer(issuer1Key, witness);
      });
      
      await addTx.prove();
      await addTx.sign([deployer.key]).send();
      
      log.success('Issuer1 added successfully');
      
      // Update local Merkle map
      merkleMap.set(
        Field.from(BigInt('0x' + issuer1Key.toFields()[0].toBigInt().toString(16))),
        Field(1)
      );
      
      // Verify root was updated
      const newRoot = zkpVerifier.trustedIssuersRoot.get();
      const expectedRoot = merkleMap.getRoot();
      
      assert.fieldEqual(
        newRoot,
        expectedRoot,
        'Root should match local Merkle map after adding issuer'
      );
      
      log.data('New root', newRoot.toString().slice(0, 20) + '...');
    });

    it('should allow owner to add second trusted issuer', async () => {
      log.test('Adding issuer2 to trusted list');
      
      const issuer2Key = issuer2;
      const witness = merkleMap.getWitness(
        Field.from(BigInt('0x' + issuer2Key.toFields()[0].toBigInt().toString(16)))
      );
      
      const addTx = await Mina.transaction(deployer, async () => {
        await zkpVerifier.addTrustedIssuer(issuer2Key, witness);
      });
      
      await addTx.prove();
      await addTx.sign([deployer.key]).send();
      
      log.success('Issuer2 added successfully');
      
      // Update local Merkle map
      merkleMap.set(
        Field.from(BigInt('0x' + issuer2Key.toFields()[0].toBigInt().toString(16))),
        Field(1)
      );
      
      // Verify root matches
      const newRoot = zkpVerifier.trustedIssuersRoot.get();
      const expectedRoot = merkleMap.getRoot();
      
      assert.fieldEqual(
        newRoot,
        expectedRoot,
        'Root should match local Merkle map after adding second issuer'
      );
    });

    it('should reject non-owner adding trusted issuer', async () => {
      log.test('Non-owner attempting to add issuer');
      
      const newIssuer = PrivateKey.random().toPublicKey();
      const witness = merkleMap.getWitness(
        Field.from(BigInt('0x' + newIssuer.toFields()[0].toBigInt().toString(16)))
      );
      
      await assert.throws(async () => {
        const tx = await Mina.transaction(issuer1, async () => {
          await zkpVerifier.addTrustedIssuer(newIssuer, witness);
        });
        await tx.prove();
        await tx.sign([issuer1.key]).send();
      }, 'Should reject non-owner adding issuer');
      
      log.success('Correctly rejected non-owner');
    });
  });

  describe('Verifying Trusted Issuers', () => {
    it('should verify that issuer1 is trusted', async () => {
      log.test('Verifying issuer1 is in trusted list');
      
      const issuer1Key = issuer1;
      const witness = merkleMap.getWitness(
        Field.from(BigInt('0x' + issuer1Key.toFields()[0].toBigInt().toString(16)))
      );
      
      const verifyTx = await Mina.transaction(deployer, async () => {
        await zkpVerifier.verifyTrustedIssuer(issuer1Key, witness);
      });
      
      await verifyTx.prove();
      await verifyTx.sign([deployer.key]).send();
      
      log.success('Issuer1 verified as trusted');
    });

    it('should verify that issuer2 is trusted', async () => {
      log.test('Verifying issuer2 is in trusted list');
      
      const issuer2Key = issuer2;
      const witness = merkleMap.getWitness(
        Field.from(BigInt('0x' + issuer2Key.toFields()[0].toBigInt().toString(16)))
      );
      
      const verifyTx = await Mina.transaction(deployer, async () => {
        await zkpVerifier.verifyTrustedIssuer(issuer2Key, witness);
      });
      
      await verifyTx.prove();
      await verifyTx.sign([deployer.key]).send();
      
      log.success('Issuer2 verified as trusted');
    });

    it('should reject verification of untrusted issuer', async () => {
      log.test('Attempting to verify untrusted issuer');
      
      const untrustedIssuer = PrivateKey.random().toPublicKey();
      const witness = merkleMap.getWitness(
        Field.from(BigInt('0x' + untrustedIssuer.toFields()[0].toBigInt().toString(16)))
      );
      
      await assert.throws(async () => {
        const tx = await Mina.transaction(deployer, async () => {
          await zkpVerifier.verifyTrustedIssuer(untrustedIssuer, witness);
        });
        await tx.prove();
        await tx.sign([deployer.key]).send();
      }, 'Should reject untrusted issuer');
      
      log.success('Correctly rejected untrusted issuer');
    });
  });
});

log.section('ZKPVerifierV2 Test Summary');
console.log('Merkle tree implementation tests completed!');
console.log('\nTo run these tests:');
console.log('  npm test');
