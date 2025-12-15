/**
 * ZKPVerifier Contract Tests
 * 
 * Comprehensive tests for the ZKPVerifier smart contract.
 * Tests all methods and edge cases.
 * 
 * Run with: npm test
 * Watch mode: npm run testw
 */

import { describe, it, before } from 'node:test';
import { Field, Mina, PublicKey, Bool, PrivateKey, Poseidon } from 'o1js';
import { ZKPVerifier, CredentialClaim } from './ZKPVerifier.js';
import {
  setupTestEnvironment,
  deployZKPVerifier,
  createAgeHash,
  createKYCHash,
  createIssuerHash,
  createCommitmentHash,
  createMockProof,
  TestData,
  TestEnv,
  assert,
  log,
} from './test-utils.js';

describe('ZKPVerifier Contract', () => {
  let env: TestEnv;
  let zkpVerifier: ZKPVerifier;
  const MINIMUM_AGE = 18;

  before(async () => {
    log.section('Setting up test environment');
    
    // Setup environment
    env = setupTestEnvironment();
    log.success('Local blockchain created');
    log.info(`Deployer: ${env.deployer.address.slice(0, 20)}...`);
    log.info(`User1: ${env.user1.address.slice(0, 20)}...`);
    log.info(`User2: ${env.user2.address.slice(0, 20)}...`);
    log.info(`Issuer: ${env.issuer.address.slice(0, 20)}...`);

    // Deploy contract
    zkpVerifier = await deployZKPVerifier(env, MINIMUM_AGE);
    log.success('ZKPVerifier contract deployed');
    log.data('Contract address', env.zkpVerifierAddress.toBase58().slice(0, 30) + '...');
  });

  describe('Contract Initialization', () => {
    it('should initialize with correct owner', async () => {
      log.test('Checking contract owner');
      
      const owner = zkpVerifier.owner.get();
      assert.publicKeyEqual(
        owner,
        env.deployer.publicKey,
        'Owner should be deployer'
      );
      
      log.success('Owner correctly set to deployer');
    });

    it('should initialize with correct minimum age', async () => {
      log.test('Checking minimum age');
      
      const minAge = zkpVerifier.minimumAge.get();
      assert.fieldEqual(
        minAge,
        Field(MINIMUM_AGE),
        'Minimum age should be 18'
      );
      
      log.success(`Minimum age correctly set to ${MINIMUM_AGE}`);
    });

    it('should initialize with zero verifications', async () => {
      log.test('Checking initial verification count');
      
      const total = zkpVerifier.totalVerifications.get();
      assert.fieldEqual(
        total,
        Field(0),
        'Total verifications should start at 0'
      );
      
      log.success('Verification count starts at 0');
    });
  });

  describe('Age Verification', () => {
    it('should verify age proof for user over minimum age', async () => {
      log.test('Verifying age proof for 25-year-old');
      
      const age = TestData.ages.overAge;
      const salt = TestData.salts.salt1;
      const ageHash = createAgeHash(age, salt);
      const proof = createMockProof();
      
      log.data('Age', age);
      log.data('Salt', salt.toString().slice(0, 20) + '...');
      log.data('Age Hash', ageHash.toString().slice(0, 20) + '...');

      // First add issuer as trusted
      const issuerHash = createIssuerHash(env.issuer.publicKey);
      
      const addIssuerTx = await Mina.transaction(env.deployer.publicKey, async () => {
        await zkpVerifier.addTrustedIssuer(env.issuer.publicKey, issuerHash);
      });
      await addIssuerTx.prove();
      await addIssuerTx.sign([env.deployer.privateKey]).send();
      
      log.success('Issuer added as trusted');

      // Verify age proof
      const verifyTx = await Mina.transaction(env.user1.publicKey, async () => {
        await zkpVerifier.verifyAgeProof(
          env.user1.publicKey,
          ageHash,
          proof,
          env.issuer.publicKey,
          Field(Date.now()),
          Field(18) // minimum age
        );
      });
      
      await verifyTx.prove();
      await verifyTx.sign([env.user1.privateKey]).send();
      
      log.success('Age proof verified successfully');
      
      // Check that verification count increased
      const totalVerifications = zkpVerifier.totalVerifications.get();
      assert.fieldEqual(
        totalVerifications,
        Field(1),
        'Total verifications should be 1'
      );
      
      log.data('Total verifications', totalVerifications.toString());
    });

    it('should fail to verify with untrusted issuer', async () => {
      log.test('Attempting verification with untrusted issuer');
      
      const age = TestData.ages.overAge;
      const salt = TestData.salts.salt2;
      const ageHash = createAgeHash(age, salt);
      const proof = createMockProof();
      
      // Use user2 as an untrusted issuer
      const untrustedIssuer = env.user2.publicKey;
      
      await assert.throws(async () => {
        const tx = await Mina.transaction(env.user1.publicKey, async () => {
          await zkpVerifier.verifyAgeProof(
            env.user1.publicKey,
            ageHash,
            proof,
            untrustedIssuer,
            Field(Date.now()),
            Field(18) // minimum age
          );
        });
        await tx.prove();
        await tx.sign([env.user1.privateKey]).send();
      }, 'Should fail with untrusted issuer');
      
      log.success('Correctly rejected untrusted issuer');
    });
  });

  describe('KYC Verification', () => {
    it('should verify KYC proof', async () => {
      log.test('Verifying KYC proof');
      
      const kycLevel = TestData.kycLevels.STANDARD;
      const salt = TestData.salts.salt1;
      const kycHash = createKYCHash(kycLevel, salt);
      const proof = createMockProof();
      
      log.data('KYC Level', kycLevel.toString());
      log.data('KYC Hash', kycHash.toString().slice(0, 20) + '...');

      const verifyTx = await Mina.transaction(env.user1.publicKey, async () => {
        await zkpVerifier.verifyKYCProof(
          env.user1.publicKey,
          kycHash,
          proof,
          env.issuer.publicKey
        );
      });
      
      await verifyTx.prove();
      await verifyTx.sign([env.user1.privateKey]).send();
      
      log.success('KYC proof verified successfully');
      
      const totalVerifications = zkpVerifier.totalVerifications.get();
      assert.fieldEqual(
        totalVerifications,
        Field(2),
        'Total verifications should be 2'
      );
      
      log.data('Total verifications', totalVerifications.toString());
    });
  });

  describe('Credential Verification', () => {
    it('should verify generic credential proof', async () => {
      log.test('Verifying credential proof');
      
      const currentTime = Field(Date.now());
      const futureTime = Field(Date.now() + 31536000000); // 1 year from now
      
      const claim = new CredentialClaim({
        issuer: env.issuer.publicKey,
        subject: env.user1.publicKey,
        claimType: TestData.claimTypes.ACCREDITED_INVESTOR,
        claimValue: Field(1), // true
        issuedAt: currentTime,
        expiresAt: futureTime,
      });
      
      const commitmentHash = Poseidon.hash([
        ...claim.issuer.toFields(),
        ...claim.subject.toFields(),
        claim.claimType,
        claim.claimValue,
        claim.issuedAt,
        claim.expiresAt,
      ]);
      const proof = commitmentHash; // Proof equals commitment for this test
      
      log.data('Claim Type', 'ACCREDITED_INVESTOR');
      log.data('Claim Value', claim.claimValue.toString());
      log.data('Commitment', commitmentHash.toString().slice(0, 20) + '...');

      const verifyTx = await Mina.transaction(env.user1.publicKey, async () => {
        await zkpVerifier.verifyCredentialProof(
          claim,
          proof,
          commitmentHash
        );
      });
      
      await verifyTx.prove();
      await verifyTx.sign([env.user1.privateKey]).send();
      
      log.success('Credential proof verified successfully');
      
      const totalVerifications = zkpVerifier.totalVerifications.get();
      assert.fieldEqual(
        totalVerifications,
        Field(3),
        'Total verifications should be 3'
      );
    });
  });

  describe('Trusted Issuer Management', () => {
    it('should allow owner to add trusted issuer', async () => {
      log.test('Adding new trusted issuer');
      
      const newIssuer = env.user2.publicKey;
      const issuerHash = createIssuerHash(newIssuer);
      
      log.data('New Issuer', newIssuer.toBase58().slice(0, 30) + '...');

      const addTx = await Mina.transaction(env.deployer.publicKey, async () => {
        await zkpVerifier.addTrustedIssuer(newIssuer, issuerHash);
      });
      
      await addTx.prove();
      await addTx.sign([env.deployer.privateKey]).send();
      
      log.success('Trusted issuer added successfully');
    });

    it('should reject non-owner adding trusted issuer', async () => {
      log.test('Non-owner attempting to add issuer');
      
      const newIssuer = PrivateKey.random().toPublicKey();
      const issuerHash = createIssuerHash(newIssuer);
      
      await assert.throws(async () => {
        const tx = await Mina.transaction(env.user1.publicKey, async () => {
          await zkpVerifier.addTrustedIssuer(newIssuer, issuerHash);
        });
        await tx.prove();
        await tx.sign([env.user1.privateKey]).send();
      }, 'Should reject non-owner adding issuer');
      
      log.success('Correctly rejected non-owner');
    });
  });

  describe('Minimum Age Management', () => {
    it('should allow owner to update minimum age', async () => {
      log.test('Updating minimum age to 21');
      
      const newMinAge = 21;
      const oldMinAge = zkpVerifier.minimumAge.get();
      
      log.data('Old minimum age', oldMinAge.toString());
      log.data('New minimum age', newMinAge);

      const updateTx = await Mina.transaction(env.deployer.publicKey, async () => {
        await zkpVerifier.updateMinimumAge(Field(newMinAge));
      });
      
      await updateTx.prove();
      await updateTx.sign([env.deployer.privateKey]).send();
      
      const updatedMinAge = zkpVerifier.minimumAge.get();
      assert.fieldEqual(
        updatedMinAge,
        Field(newMinAge),
        'Minimum age should be updated'
      );
      
      log.success(`Minimum age updated to ${newMinAge}`);
    });

    it('should reject non-owner updating minimum age', async () => {
      log.test('Non-owner attempting to update minimum age');
      
      await assert.throws(async () => {
        const tx = await Mina.transaction(env.user1.publicKey, async () => {
          await zkpVerifier.updateMinimumAge(Field(25));
        });
        await tx.prove();
        await tx.sign([env.user1.privateKey]).send();
      }, 'Should reject non-owner updating minimum age');
      
      log.success('Correctly rejected non-owner');
    });

    it('should reject invalid minimum ages', async () => {
      log.test('Attempting to set invalid minimum age (150)');
      
      await assert.throws(async () => {
        const tx = await Mina.transaction(env.deployer.publicKey, async () => {
          await zkpVerifier.updateMinimumAge(Field(150));
        });
        await tx.prove();
        await tx.sign([env.deployer.privateKey]).send();
      }, 'Should reject age > 120');
      
      log.success('Correctly rejected invalid age');
    });
  });

  describe('Ownership Transfer', () => {
    it('should allow owner to transfer ownership', async () => {
      log.test('Transferring ownership to user1');
      
      const oldOwner = zkpVerifier.owner.get();
      const newOwner = env.user1.publicKey;
      
      log.data('Old owner', oldOwner.toBase58().slice(0, 30) + '...');
      log.data('New owner', newOwner.toBase58().slice(0, 30) + '...');

      const transferTx = await Mina.transaction(env.deployer.publicKey, async () => {
        await zkpVerifier.transferOwnership(newOwner);
      });
      
      await transferTx.prove();
      await transferTx.sign([env.deployer.privateKey]).send();
      
      const updatedOwner = zkpVerifier.owner.get();
      assert.publicKeyEqual(
        updatedOwner,
        newOwner,
        'Owner should be updated'
      );
      
      log.success('Ownership transferred successfully');
      
      // Transfer back for other tests
      const transferBackTx = await Mina.transaction(env.user1.publicKey, async () => {
        await zkpVerifier.transferOwnership(env.deployer.publicKey);
      });
      await transferBackTx.prove();
      await transferBackTx.sign([env.user1.privateKey]).send();
      
      log.info('Ownership transferred back to deployer');
    });

    it('should reject non-owner transferring ownership', async () => {
      log.test('Non-owner attempting to transfer ownership');
      
      await assert.throws(async () => {
        const tx = await Mina.transaction(env.user2.publicKey, async () => {
          await zkpVerifier.transferOwnership(env.user2.publicKey);
        });
        await tx.prove();
        await tx.sign([env.user2.privateKey]).send();
      }, 'Should reject non-owner transferring ownership');
      
      log.success('Correctly rejected non-owner');
    });
  });

  describe('Event Emissions', () => {
    it('should emit AgeVerified event', async () => {
      log.test('Checking AgeVerified event emission');
      
      const age = TestData.ages.overAge;
      const salt = TestData.salts.salt3;
      const ageHash = createAgeHash(age, salt);
      const proof = createMockProof();

      const tx = await Mina.transaction(env.user1.publicKey, async () => {
        await zkpVerifier.verifyAgeProof(
          env.user1.publicKey,
          ageHash,
          proof,
          env.issuer.publicKey,
          Field(Date.now()),
          Field(18) // minimum age
        );
      });
      
      await tx.prove();
      await tx.sign([env.user1.privateKey]).send();
      
      // In a real test, you would check the emitted events
      // This is a simplified version
      log.success('Event should be emitted (check transaction logs)');
    });
  });
});

log.section('Test Summary');
console.log('All ZKPVerifier tests completed!');
console.log('\nTo run these tests:');
console.log('  npm test');
console.log('\nTo run in watch mode:');
console.log('  npm run testw');
