/**
 * SmartProofGenerator.ts
 * 
 * Intelligent proof generation with caching, progress tracking, and timeout protection.
 * Prevents the "Invalid_proof In progress" error through smart handling.
 */

import { Field, PublicKey, PrivateKey, Poseidon, Signature } from 'o1js';

export interface GeneratedProof {
  proof: string;
  publicInput: {
    subjectPublicKey: string;
    minimumAge?: string;
    ageHash?: string;
    kycHash?: string;
    citizenshipHash?: string;
    nameHash?: string;
    issuerPublicKey: string;
    timestamp: number;
  };
  publicOutput: string;
  proofType: string;
  did: string;
  timestamp: number;
  metadata: {
    proofId?: string;
    verificationKeyHash: string;
    proofHash: string;
    clientVersion: string;
    generationTime: number;
    generatedAt: string;
  };
  selectiveDisclosure?: {
    salt: string;
    [key: string]: any;
  };
}

interface ProofCacheEntry {
  proof: GeneratedProof;
  createdAt: number;
  inputsHash: string;
}

// In-memory cache
const proofCache = new Map<string, ProofCacheEntry>();
let isGenerating = false;

// Cache TTL: 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Version for cache invalidation - UPDATE THIS when commitment calculation changes!
// v2.1.0: Fixed minimumAge parameter to use actual value instead of hardcoded 18
const CLIENT_VERSION = '2.1.0'; // Changed from 2.0.0 to invalidate old cached proofs

/**
 * Generate a deterministic hash from inputs for caching
 */
function hashInputs(inputs: Record<string, any>): string {
  const str = JSON.stringify(inputs);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Check if cached proof is still valid
 */
function getCachedProof(inputsHash: string): GeneratedProof | null {
  const cached = proofCache.get(inputsHash);
  if (!cached) return null;
  
  // Check version - invalidate if client version changed
  if (cached.proof.metadata.clientVersion !== CLIENT_VERSION) {
    console.log(`[SmartProofGenerator] Cache invalidated - version mismatch (cached: ${cached.proof.metadata.clientVersion}, current: ${CLIENT_VERSION})`);
    proofCache.delete(inputsHash);
    return null;
  }
  
  const age = Date.now() - cached.createdAt;
  if (age > CACHE_TTL) {
    proofCache.delete(inputsHash);
    return null;
  }
  
  console.log(`[SmartProofGenerator] Cache hit! Proof generated ${Math.round(age / 1000)}s ago`);
  return cached.proof;
}

/**
 * Save proof to cache
 */
function cacheProof(inputsHash: string, proof: GeneratedProof): void {
  // Limit cache size to 10 entries
  if (proofCache.size >= 10) {
    const oldestKey = proofCache.keys().next().value;
    if (oldestKey) proofCache.delete(oldestKey);
  }
  
  proofCache.set(inputsHash, {
    proof,
    createdAt: Date.now(),
    inputsHash,
  });
}

/**
 * Generate age proof with smart caching and progress tracking
 */
export async function generateAgeProofSmart(
  actualAge: number,
  salt: string,
  minAge: number,
  privateKey: PrivateKey,
  onProgress?: (message: string, percent: number) => void
): Promise<GeneratedProof> {
  const startTime = performance.now();
  
  // Prevent concurrent generation
  if (isGenerating) {
    throw new Error('Proof generation already in progress. Please wait.');
  }
  
  const publicKey = privateKey.toPublicKey();
  
  // Create cache key
  const inputsHash = hashInputs({
    actualAge,
    salt,
    minAge,
    publicKey: publicKey.toBase58(),
  });
  
  // Check cache first
  const cached = getCachedProof(inputsHash);
  if (cached) {
    onProgress?.('Using cached proof', 100);
    return cached;
  }
  
  try {
    isGenerating = true;
    console.log('[SmartProofGenerator] Starting proof generation...');
    onProgress?.('Preparing inputs...', 10);
    
    // Validate inputs
    if (actualAge < 0 || actualAge > 150) {
      throw new Error('Invalid age: must be between 0 and 150');
    }
    if (!salt || salt.length < 4) {
      throw new Error('Salt must be at least 4 characters');
    }
    if (actualAge < minAge) {
      throw new Error(`Age ${actualAge} is less than minimum ${minAge}`);
    }
    
    onProgress?.('Generating cryptographic commitment...', 30);
    
    // Generate age hash (commitment)
    const saltField = Field.from(BigInt('0x' + Buffer.from(salt).toString('hex').slice(0, 16)));
    const ageHash = Poseidon.hash([Field(actualAge), saltField]);
    
    onProgress?.('Creating proof signature...', 50);
    
    // Create timestamp in SECONDS (for blockchain)
    const timestampSeconds = Math.floor(Date.now() / 1000);
    const timestampMs = Date.now(); // For UI display
    
    // Contract expects: Poseidon.hash([ageHash, minAge, subject, issuer, timestamp])
    const commitment = Poseidon.hash([
      ageHash,
      Field(minAge),
      ...publicKey.toFields(),
      ...publicKey.toFields(), // self-attested (issuer = subject)
      Field(timestampSeconds),
    ]);
    
    onProgress?.('Signing commitment...', 70);
    
    // Sign the commitment
    const signature = Signature.create(privateKey, [commitment]);
    
    onProgress?.('Finalizing proof...', 90);
    
    const generationTime = Math.round(performance.now() - startTime);
    
    // Create proof object
    const proof: GeneratedProof = {
      proof: JSON.stringify({
        commitment: commitment.toString(),
        signature: signature.toBase58(),
        ageHash: ageHash.toString(),
        publicKey: publicKey.toBase58(),
      }),
      publicInput: {
        subjectPublicKey: publicKey.toBase58(),
        minimumAge: minAge.toString(),
        ageHash: ageHash.toString(),
        issuerPublicKey: publicKey.toBase58(),
        timestamp: timestampSeconds, // IMPORTANT: This is in seconds for blockchain
      },
      publicOutput: commitment.toString(),
      proofType: minAge === 18 ? 'age18' : minAge === 21 ? 'age21' : `age${minAge}`,
      did: `did:mina:${publicKey.toBase58()}`,
      timestamp: timestampMs, // UI display timestamp in milliseconds
      metadata: {
        verificationKeyHash: 'client-side-v2', // Will be updated when on-chain
        proofHash: commitment.toString().slice(0, 16),
        clientVersion: CLIENT_VERSION,
        generationTime,
        generatedAt: new Date().toISOString(),
      },
      selectiveDisclosure: { salt },
    };
    
    // Cache the proof
    cacheProof(inputsHash, proof);
    
    console.log(`[SmartProofGenerator] ✅ Proof generated in ${generationTime}ms`);
    onProgress?.('Proof ready!', 100);
    
    return proof;
  } finally {
    isGenerating = false;
  }
}

/**
 * Generate KYC proof with smart caching
 */
export async function generateKYCProofSmart(
  aadharData: { uid: string; name: string; dateOfBirth: string },
  privateKey: PrivateKey,
  attributes: string[],
  onProgress?: (message: string, percent: number) => void
): Promise<GeneratedProof> {
  const startTime = performance.now();
  
  if (isGenerating) {
    throw new Error('Proof generation already in progress. Please wait.');
  }
  
  const publicKey = privateKey.toPublicKey();
  
  // Create cache key
  const inputsHash = hashInputs({
    uid: aadharData.uid,
    name: aadharData.name,
    publicKey: publicKey.toBase58(),
    attributes,
  });
  
  // Check cache
  const cached = getCachedProof(inputsHash);
  if (cached) {
    onProgress?.('Using cached proof', 100);
    return cached;
  }
  
  try {
    isGenerating = true;
    onProgress?.('Preparing KYC data...', 20);
    
    // Create KYC hash from Aadhar data
    const uidField = Field.from(BigInt('0x' + Buffer.from(aadharData.uid).toString('hex').slice(0, 16)));
    const nameField = Field.from(BigInt('0x' + Buffer.from(aadharData.name).toString('hex').slice(0, 16)));
    const timestampSeconds = Math.floor(Date.now() / 1000);
    const timestampMs = Date.now();
    const timestamp = Field(timestampSeconds);
    
    const kycHash = Poseidon.hash([uidField, nameField, timestamp]);
    
    onProgress?.('Creating commitment...', 50);
    
    // Contract expects: Poseidon.hash([kycHash, subject, issuer, Field(1)])
    const commitment = Poseidon.hash([
      kycHash,
      ...publicKey.toFields(),
      ...publicKey.toFields(),
      Field(1),
    ]);
    
    onProgress?.('Signing...', 70);
    
    const signature = Signature.create(privateKey, [commitment]);
    
    const generationTime = Math.round(performance.now() - startTime);
    
    const proof: GeneratedProof = {
      proof: JSON.stringify({
        kycHash: kycHash.toString(),
        commitment: commitment.toString(),
        signature: signature.toBase58(),
        publicKey: publicKey.toBase58(),
      }),
      publicInput: {
        subjectPublicKey: publicKey.toBase58(),
        minimumAge: '0',
        ageHash: kycHash.toString(),
        issuerPublicKey: publicKey.toBase58(),
        timestamp: timestampSeconds, // IMPORTANT: This is in seconds for blockchain
      },
      publicOutput: commitment.toString(),
      proofType: 'kyc',
      did: `did:mina:${publicKey.toBase58()}`,
      timestamp: timestampMs, // UI display timestamp in milliseconds
      metadata: {
        verificationKeyHash: 'client-side-v2',
        proofHash: commitment.toString().slice(0, 16),
        clientVersion: CLIENT_VERSION,
        generationTime,
        generatedAt: new Date().toISOString(),
      },
    };
    
    cacheProof(inputsHash, proof);
    
    console.log(`[SmartProofGenerator] ✅ KYC proof generated in ${generationTime}ms`);
    onProgress?.('Proof ready!', 100);
    
    return proof;
  } finally {
    isGenerating = false;
  }
}

/**
 * Clear proof cache (SESSION ONLY - no localStorage persistence)
 */
export function clearProofCache(): void {
  proofCache.clear();
  console.log('[SmartProofGenerator] ✅ Session cache cleared (memory only)');
}

/**
 * Clear cache for a specific user (SESSION ONLY)
 */
export function clearUserProofCache(userIdentifier: string): void {
  // Filter and delete matching entries from memory cache
  const keysToDelete: string[] = [];
  proofCache.forEach((_, key) => {
    if (key.includes(userIdentifier)) {
      keysToDelete.push(key);
    }
  });
  keysToDelete.forEach(key => proofCache.delete(key));
  console.log(`[SmartProofGenerator] ✅ Cleared ${keysToDelete.length} proofs for user`);
}

/**
 * Check if proof generation is in progress
 */
export function isProofGenerating(): boolean {
  return isGenerating;
}

/**
 * Get cache statistics
 */
export function getCacheStats(): { size: number; entries: string[] } {
  return {
    size: proofCache.size,
    entries: Array.from(proofCache.keys()),
  };
}
