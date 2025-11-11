/**
 * Test Utilities for MinaID Smart Contracts
 * 
 * This file provides helper functions, mock data, and utilities
 * for testing smart contracts using the Node.js test runner.
 */

import {
  Field,
  PrivateKey,
  PublicKey,
  MerkleMap,
  Poseidon,
  Bool,
} from 'o1js';
import { ZKPVerifier } from './ZKPVerifier.js';
import { DIDRegistry } from './DIDRegistry.js';

/**
 * Test Account Interface
 */
export interface TestAccount {
  privateKey: PrivateKey;
  publicKey: PublicKey;
  address: string;
}

/**
 * Test Environment Interface (simplified for documentation)
 */
export interface TestEnv {
  deployer: TestAccount;
  user1: TestAccount;
  user2: TestAccount;
  issuer: TestAccount;
  zkpVerifierAddress: PublicKey;
  zkpVerifierPrivateKey: PrivateKey;
  didRegistryAddress: PublicKey;
  didRegistryPrivateKey: PrivateKey;
}

/**
 * Setup test environment with mock accounts
 * 
 * Note: For full integration tests with LocalBlockchain, you need to:
 * 1. Use o1js LocalBlockchain API (which may be async in v2)
 * 2. Handle the Promise returned by LocalBlockchain
 * 3. Setup the blockchain instance properly
 * 
 * This simplified version provides the structure for test data.
 */
export function setupTestEnvironment(): TestEnv {
  // Generate test account keys
  const deployerKey = PrivateKey.random();
  const user1Key = PrivateKey.random();
  const user2Key = PrivateKey.random();
  const issuerKey = PrivateKey.random();

  // Generate contract keypairs
  const zkpVerifierPrivateKey = PrivateKey.random();
  const zkpVerifierAddress = zkpVerifierPrivateKey.toPublicKey();

  const didRegistryPrivateKey = PrivateKey.random();
  const didRegistryAddress = didRegistryPrivateKey.toPublicKey();

  return {
    deployer: {
      privateKey: deployerKey,
      publicKey: deployerKey.toPublicKey(),
      address: deployerKey.toPublicKey().toBase58(),
    },
    user1: {
      privateKey: user1Key,
      publicKey: user1Key.toPublicKey(),
      address: user1Key.toPublicKey().toBase58(),
    },
    user2: {
      privateKey: user2Key,
      publicKey: user2Key.toPublicKey(),
      address: user2Key.toPublicKey().toBase58(),
    },
    issuer: {
      privateKey: issuerKey,
      publicKey: issuerKey.toPublicKey(),
      address: issuerKey.toPublicKey().toBase58(),
    },
    zkpVerifierAddress,
    zkpVerifierPrivateKey,
    didRegistryAddress,
    didRegistryPrivateKey,
  };
}

/**
 * Deploy ZKPVerifier contract
 * 
 * Note: This is a template. For actual deployment:
 * 1. Initialize Mina.LocalBlockchain() or connect to network
 * 2. Create and sign transactions properly
 * 3. Handle async operations
 */
export async function deployZKPVerifier(
  env: TestEnv,
  minimumAge: number = 18
): Promise<ZKPVerifier> {
  const zkpVerifier = new ZKPVerifier(env.zkpVerifierAddress);
  
  // In actual tests, you would:
  // 1. Setup LocalBlockchain
  // 2. Create deploy transaction
  // 3. Prove and sign transaction
  // 4. Send transaction
  
  console.log('⚠️  Note: Full deployment requires LocalBlockchain setup');
  console.log('   See o1js documentation for LocalBlockchain API in v2');

  return zkpVerifier;
}

/**
 * Deploy DIDRegistry contract
 * 
 * Note: This is a template. See deployZKPVerifier notes above.
 */
export async function deployDIDRegistry(env: TestEnv): Promise<DIDRegistry> {
  const didRegistry = new DIDRegistry(env.didRegistryAddress);
  
  console.log('⚠️  Note: Full deployment requires LocalBlockchain setup');
  console.log('   See o1js documentation for LocalBlockchain API in v2');

  return didRegistry;
}

/**
 * Create a test age hash
 * 
 * @param age - The actual age
 * @param salt - Random salt for hashing
 * @returns The Poseidon hash of [age, salt]
 */
export function createAgeHash(age: number, salt: Field): Field {
  return Poseidon.hash([Field(age), salt]);
}

/**
 * Create a test KYC hash
 * 
 * @param kycData - KYC data (e.g., country code, verification level)
 * @param salt - Random salt
 * @returns The Poseidon hash
 */
export function createKYCHash(kycData: Field, salt: Field): Field {
  return Poseidon.hash([kycData, salt]);
}

/**
 * Create a test issuer hash (for trusted issuer list)
 * 
 * @param issuerPublicKey - Issuer's public key
 * @returns Hash of issuer's public key
 */
export function createIssuerHash(issuerPublicKey: PublicKey): Field {
  return Poseidon.hash(issuerPublicKey.toFields());
}

/**
 * Create a test commitment hash
 * 
 * @param claimType - Type of claim
 * @param claimValue - Value of claim
 * @param subject - Subject's public key
 * @param issuer - Issuer's public key
 * @returns Commitment hash
 */
export function createCommitmentHash(
  claimType: Field,
  claimValue: Field,
  subject: PublicKey,
  issuer: PublicKey
): Field {
  return Poseidon.hash([
    claimType,
    claimValue,
    ...subject.toFields(),
    ...issuer.toFields(),
  ]);
}

/**
 * Create a simple proof (mock for testing)
 * For actual ZK proofs, use AgeVerificationProgram
 */
export function createMockProof(): Field {
  // This is a mock proof for testing
  // In production, use the actual ZkProgram
  return Field(12345);
}

/**
 * Mock Test Data
 */
export const TestData = {
  ages: {
    underAge: 15,
    exactMinimum: 18,
    overAge: 25,
    senior: 65,
    invalid: 150,
  },
  
  claimTypes: {
    AGE_OVER_18: Field(1),
    KYC_VERIFIED: Field(2),
    COUNTRY_US: Field(3),
    ACCREDITED_INVESTOR: Field(4),
  },
  
  kycLevels: {
    BASIC: Field(1),
    STANDARD: Field(2),
    ENHANCED: Field(3),
  },
  
  // Generate random salts for testing
  salts: {
    salt1: Field.random(),
    salt2: Field.random(),
    salt3: Field.random(),
  },
  
  // Test timestamps
  timestamps: {
    now: Field(Date.now()),
    past: Field(Date.now() - 86400000), // 1 day ago
    future: Field(Date.now() + 86400000), // 1 day from now
  },
  
  // Test DID documents
  didDocuments: {
    basic: JSON.stringify({
      '@context': 'https://www.w3.org/ns/did/v1',
      id: 'did:mina:test123',
      verificationMethod: [],
    }),
    advanced: JSON.stringify({
      '@context': 'https://www.w3.org/ns/did/v1',
      id: 'did:mina:test456',
      verificationMethod: [
        {
          id: 'did:mina:test456#key-1',
          type: 'Ed25519VerificationKey2020',
          controller: 'did:mina:test456',
        },
      ],
      authentication: ['did:mina:test456#key-1'],
    }),
  },
};

/**
 * Create DID document hash
 */
export function createDIDDocumentHash(didDocument: string): Field {
  // Simple hash of the document string
  const bytes = new TextEncoder().encode(didDocument);
  const sum = Array.from(bytes).reduce((acc, byte) => acc + byte, 0);
  return Field(sum);
}

/**
 * Create Merkle Map for DIDs
 */
export function createTestDIDMap(dids: Array<{ publicKey: PublicKey; didHash: Field }>) {
  const map = new MerkleMap();
  
  for (const { publicKey, didHash } of dids) {
    const keyHash = Poseidon.hash(publicKey.toFields());
    map.set(keyHash, didHash);
  }
  
  return map;
}

/**
 * Assertion helpers
 */
export const assert = {
  equal: (actual: any, expected: any, message?: string) => {
    if (actual !== expected) {
      throw new Error(
        message || `Expected ${expected}, but got ${actual}`
      );
    }
  },
  
  fieldEqual: (actual: Field, expected: Field, message?: string) => {
    if (!actual.equals(expected).toBoolean()) {
      throw new Error(
        message || `Expected ${expected.toString()}, but got ${actual.toString()}`
      );
    }
  },
  
  publicKeyEqual: (actual: PublicKey, expected: PublicKey, message?: string) => {
    if (!actual.equals(expected).toBoolean()) {
      throw new Error(
        message || `Public keys don't match`
      );
    }
  },
  
  isTrue: (value: boolean | Bool, message?: string) => {
    const boolValue = typeof value === 'boolean' ? value : value.toBoolean();
    if (!boolValue) {
      throw new Error(message || 'Expected true, but got false');
    }
  },
  
  isFalse: (value: boolean | Bool, message?: string) => {
    const boolValue = typeof value === 'boolean' ? value : value.toBoolean();
    if (boolValue) {
      throw new Error(message || 'Expected false, but got true');
    }
  },
  
  throws: async (fn: () => Promise<any>, message?: string) => {
    let didThrow = false;
    try {
      await fn();
    } catch (e) {
      didThrow = true;
    }
    if (!didThrow) {
      throw new Error(message || 'Expected function to throw, but it did not');
    }
  },
};

/**
 * Log helpers for test output
 */
export const log = {
  section: (title: string) => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  ${title}`);
    console.log('='.repeat(60));
  },
  
  test: (name: string) => {
    console.log(`\n▶ ${name}`);
  },
  
  success: (message: string) => {
    console.log(`  ✓ ${message}`);
  },
  
  info: (message: string) => {
    console.log(`  ℹ ${message}`);
  },
  
  error: (message: string) => {
    console.log(`  ✗ ${message}`);
  },
  
  data: (label: string, value: any) => {
    console.log(`    ${label}: ${value}`);
  },
};
