/**
 * PreSubmissionValidator.ts
 * 
 * Validates proofs before submission to prevent "Invalid_proof" errors.
 * Checks VK hashes, proof structure, and detects duplicates.
 */

import { GeneratedProof } from './SmartProofGenerator';

// Known verification key hashes for deployed contracts
const KNOWN_VK_HASHES: Record<string, string> = {
  'DIDRegistry': 'did-registry-vk-v1',
  'ZKPVerifier': 'zkp-verifier-vk-v1',
};

// Track submitted proof hashes to detect duplicates
const submittedProofs = new Set<string>();

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  proofHash: string;
}

/**
 * Validate proof structure
 */
function validateProofStructure(proof: GeneratedProof): string[] {
  const errors: string[] = [];
  
  // Check required fields
  if (!proof.proof) errors.push('Missing proof data');
  if (!proof.publicInput) errors.push('Missing public input');
  if (!proof.publicOutput) errors.push('Missing public output');
  if (!proof.proofType) errors.push('Missing proof type');
  if (!proof.did) errors.push('Missing DID');
  if (!proof.metadata) errors.push('Missing metadata');
  
  // Validate public input structure
  if (proof.publicInput) {
    if (!proof.publicInput.subjectPublicKey) errors.push('Missing subject public key');
    if (!proof.publicInput.timestamp) errors.push('Missing timestamp');
    if (!proof.publicInput.ageHash) errors.push('Missing age hash');
  }
  
  // Validate metadata
  if (proof.metadata) {
    if (!proof.metadata.verificationKeyHash) errors.push('Missing VK hash in metadata');
    if (!proof.metadata.generatedAt) errors.push('Missing generation timestamp');
  }
  
  // Validate proof type
  const validTypes = ['age18', 'age21', 'kyc', 'age13', 'age16', 'age25', 'age65'];
  if (proof.proofType && !validTypes.includes(proof.proofType) && !proof.proofType.startsWith('age')) {
    errors.push(`Invalid proof type: ${proof.proofType}`);
  }
  
  return errors;
}

/**
 * Validate proof freshness
 */
function validateProofFreshness(proof: GeneratedProof): string[] {
  const warnings: string[] = [];
  
  const proofAge = Date.now() - proof.timestamp;
  const ONE_HOUR = 60 * 60 * 1000;
  const ONE_DAY = 24 * ONE_HOUR;
  
  if (proofAge > ONE_DAY) {
    warnings.push(`Proof is ${Math.round(proofAge / ONE_HOUR)} hours old. Consider regenerating.`);
  } else if (proofAge > ONE_HOUR) {
    warnings.push(`Proof is ${Math.round(proofAge / (60 * 1000))} minutes old.`);
  }
  
  return warnings;
}

/**
 * Generate unique hash for proof deduplication
 */
function generateProofHash(proof: GeneratedProof): string {
  const key = `${proof.publicInput.subjectPublicKey}-${proof.proofType}-${proof.publicOutput}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Check for duplicate submission
 */
function checkDuplicate(proofHash: string): boolean {
  return submittedProofs.has(proofHash);
}

/**
 * Validate proof can be verified by the contract
 */
function validateForContract(proof: GeneratedProof): string[] {
  const errors: string[] = [];
  
  try {
    // Parse the proof data
    const proofData = JSON.parse(proof.proof);
    
    // Check required fields for contract verification
    if (!proofData.signature) errors.push('Missing signature in proof');
    if (!proofData.commitment) errors.push('Missing commitment in proof');
    if (!proofData.publicKey) errors.push('Missing public key in proof');
    
    // For age proofs, check age hash
    if (proof.proofType.startsWith('age') && !proofData.ageHash) {
      errors.push('Missing age hash for age proof');
    }
    
    // For KYC proofs, check KYC hash
    if (proof.proofType === 'kyc' && !proofData.kycHash) {
      errors.push('Missing KYC hash for KYC proof');
    }
    
  } catch (e) {
    errors.push('Invalid proof JSON format');
  }
  
  return errors;
}

/**
 * Main validation function
 */
export async function validateProofForSubmission(
  proof: GeneratedProof,
  options: { allowDuplicates?: boolean; strictFreshness?: boolean } = {}
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  console.log('[PreSubmissionValidator] Validating proof...');
  
  // 1. Validate structure
  const structureErrors = validateProofStructure(proof);
  errors.push(...structureErrors);
  
  // 2. Validate for contract
  const contractErrors = validateForContract(proof);
  errors.push(...contractErrors);
  
  // 3. Check freshness
  const freshnessWarnings = validateProofFreshness(proof);
  if (options.strictFreshness) {
    errors.push(...freshnessWarnings);
  } else {
    warnings.push(...freshnessWarnings);
  }
  
  // 4. Generate and check for duplicates
  const proofHash = generateProofHash(proof);
  if (!options.allowDuplicates && checkDuplicate(proofHash)) {
    errors.push('Duplicate proof detected. This proof has already been submitted.');
  }
  
  const isValid = errors.length === 0;
  
  if (isValid) {
    console.log('[PreSubmissionValidator] ✅ Proof is valid for submission');
  } else {
    console.log('[PreSubmissionValidator] ❌ Validation failed:', errors);
  }
  
  if (warnings.length > 0) {
    console.log('[PreSubmissionValidator] ⚠️ Warnings:', warnings);
  }
  
  return {
    isValid,
    errors,
    warnings,
    proofHash,
  };
}

/**
 * Mark proof as submitted
 */
export function markProofSubmitted(proofHash: string): void {
  submittedProofs.add(proofHash);
  console.log(`[PreSubmissionValidator] Marked proof ${proofHash} as submitted`);
}

/**
 * Clear submitted proofs tracking
 */
export function clearSubmittedProofs(): void {
  submittedProofs.clear();
  console.log('[PreSubmissionValidator] Cleared submitted proofs tracking');
}

/**
 * Get count of submitted proofs
 */
export function getSubmittedCount(): number {
  return submittedProofs.size;
}

/**
 * Quick validation for UI display
 */
export function quickValidate(proof: GeneratedProof | null): { 
  canSubmit: boolean; 
  reason?: string;
} {
  if (!proof) {
    return { canSubmit: false, reason: 'No proof available' };
  }
  
  const structureErrors = validateProofStructure(proof);
  if (structureErrors.length > 0) {
    return { canSubmit: false, reason: structureErrors[0] };
  }
  
  const proofHash = generateProofHash(proof);
  if (checkDuplicate(proofHash)) {
    return { canSubmit: false, reason: 'Proof already submitted' };
  }
  
  return { canSubmit: true };
}

/**
 * Validate multiple proofs
 */
export async function validateProofsBatch(
  proofs: GeneratedProof[]
): Promise<Map<string, ValidationResult>> {
  const results = new Map<string, ValidationResult>();
  
  for (const proof of proofs) {
    const result = await validateProofForSubmission(proof);
    results.set(proof.did, result);
  }
  
  return results;
}
