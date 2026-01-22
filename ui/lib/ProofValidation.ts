/**
 * ProofValidation.ts
 * 
 * Utilities for validating proof validity, usage limits, and expiry
 */

export interface ProofValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  canUse: boolean;
  metadata?: {
    isExpired: boolean;
    daysUntilExpiry?: number;
    remainingUses?: number;
    usageCount: number;
  };
}

/**
 * Validate proof expiry and usage limits
 */
export function validateProofValidity(proofData: any): ProofValidationResult {
  const result: ProofValidationResult = {
    isValid: true,
    errors: [],
    warnings: [],
    canUse: true,
    metadata: {
      isExpired: false,
      usageCount: 0,
    },
  };

  if (!proofData || !proofData.metadata) {
    result.isValid = false;
    result.canUse = false;
    result.errors.push('Invalid proof structure: missing metadata');
    return result;
  }

  const metadata = proofData.metadata;
  const now = Date.now();

  // Check validity period
  if (metadata.validFrom && now < metadata.validFrom) {
    result.isValid = false;
    result.canUse = false;
    result.errors.push(`Proof is not yet valid. Valid from: ${new Date(metadata.validFrom).toLocaleString()}`);
  }

  if (metadata.validUntil) {
    const isExpired = now > metadata.validUntil;
    result.metadata!.isExpired = isExpired;

    if (isExpired) {
      result.isValid = false;
      result.canUse = false;
      result.errors.push(`Proof has expired on ${new Date(metadata.validUntil).toLocaleString()}`);
    } else {
      // Calculate days until expiry
      const daysUntilExpiry = Math.floor((metadata.validUntil - now) / (1000 * 60 * 60 * 24));
      result.metadata!.daysUntilExpiry = daysUntilExpiry;

      if (daysUntilExpiry <= 30) {
        result.warnings.push(`Proof expires in ${daysUntilExpiry} days`);
      }
    }
  }

  // Check usage limits
  const usageCount = metadata.usageCount || 0;
  result.metadata!.usageCount = usageCount;

  if (metadata.maxUses !== undefined) {
    const remainingUses = metadata.maxUses - usageCount;
    result.metadata!.remainingUses = remainingUses;

    if (remainingUses <= 0) {
      result.isValid = false;
      result.canUse = false;
      result.errors.push(`Proof has reached maximum usage limit (${metadata.maxUses} uses)`);
    } else if (remainingUses <= 2) {
      result.warnings.push(`Only ${remainingUses} use(s) remaining`);
    }
  }

  return result;
}

/**
 * Record proof usage
 */
export function recordProofUsage(proofData: any): any {
  if (!proofData || !proofData.metadata) {
    throw new Error('Invalid proof data');
  }

  const metadata = proofData.metadata;
  const now = Date.now();

  // Update usage count
  metadata.usageCount = (metadata.usageCount || 0) + 1;

  // Record usage timestamp
  if (!metadata.usedAt) {
    metadata.usedAt = [];
  }
  metadata.usedAt.push(now);

  return proofData;
}

/**
 * Calculate default validity period based on proof type
 */
export function getDefaultValidityPeriod(proofType: string): {
  validFrom: number;
  validUntil: number;
} {
  const now = Date.now();
  const oneYear = 365 * 24 * 60 * 60 * 1000;
  const fiveYears = 5 * oneYear;

  // Age proofs are valid for 1 year (ages change)
  if (proofType.includes('age')) {
    return {
      validFrom: now,
      validUntil: now + oneYear,
    };
  }

  // KYC and citizenship proofs valid for 5 years
  return {
    validFrom: now,
    validUntil: now + fiveYears,
  };
}

/**
 * Format validity period for display
 */
export function formatValidityPeriod(validFrom: number, validUntil: number): string {
  const fromDate = new Date(validFrom).toLocaleDateString();
  const untilDate = new Date(validUntil).toLocaleDateString();
  return `Valid: ${fromDate} - ${untilDate}`;
}

/**
 * Check if proof satisfies circuit constraints (client-side verification)
 */
export async function verifyProofCircuit(proofData: any, expectedData?: {
  minimumAge?: number;
  citizenship?: string;
  name?: string;
}): Promise<{
  satisfiesCircuit: boolean;
  details: string;
  checks: Record<string, boolean>;
}> {
  const checks: Record<string, boolean> = {};
  const proofType = proofData.proofType || proofData.type;

  try {
    // Import o1js for field operations
    const { Field, PublicKey, Poseidon } = await import('o1js');

    // Age proof verification
    if (proofType.includes('age') && expectedData?.minimumAge) {
      const publicInput = proofData.publicInput;
      const publicOutput = proofData.publicOutput;

      const minAge = Field(publicInput.minimumAge || '18');
      const expectedMinAge = Field(expectedData.minimumAge);

      // Check if proof satisfies minimum age requirement
      checks.minimumAge = minAge.greaterThanOrEqual(expectedMinAge).toBoolean();

      // Verify commitment
      const ageHash = Field(publicInput.ageHash || publicInput.kycHash || '0');
      const subject = PublicKey.fromBase58(publicInput.subjectPublicKey);
      const issuer = PublicKey.fromBase58(publicInput.issuerPublicKey);
      const timestamp = Field(publicInput.timestamp || 0);

      const expectedCommitment = Poseidon.hash([
        ageHash,
        minAge,
        ...subject.toFields(),
        ...issuer.toFields(),
        timestamp,
      ]);

      const actualCommitment = Field(publicOutput);
      checks.commitment = expectedCommitment.equals(actualCommitment).toBoolean();
    }

    // Citizenship proof verification
    if (proofType === 'citizenship' && expectedData?.citizenship) {
      const { generateAttributeCommitment } = await import('./ProofGenerator');
      const selectiveDisclosure = proofData.selectiveDisclosure;

      if (selectiveDisclosure?.salt) {
        const publicHash = proofData.publicInput.citizenshipHash;
        const calculatedCommitment = generateAttributeCommitment(
          expectedData.citizenship,
          selectiveDisclosure.salt
        );

        checks.citizenship = calculatedCommitment.toString() === publicHash;
      }
    }

    // Name proof verification
    if (proofType === 'name' && expectedData?.name) {
      const { generateAttributeCommitment } = await import('./ProofGenerator');
      const selectiveDisclosure = proofData.selectiveDisclosure;

      if (selectiveDisclosure?.salt) {
        const publicHash = proofData.publicInput.nameHash;
        const calculatedCommitment = generateAttributeCommitment(
          expectedData.name,
          selectiveDisclosure.salt
        );

        checks.name = calculatedCommitment.toString() === publicHash;
      }
    }

    const satisfiesCircuit = Object.values(checks).every((check) => check === true);

    return {
      satisfiesCircuit,
      details: satisfiesCircuit
        ? `✅ Proof satisfies all circuit constraints for ${proofType}`
        : `❌ Proof does not satisfy circuit constraints: ${Object.entries(checks)
            .filter(([_, v]) => !v)
            .map(([k]) => k)
            .join(', ')} failed`,
      checks,
    };
  } catch (error) {
    return {
      satisfiesCircuit: false,
      details: `Error verifying circuit: ${(error as Error).message}`,
      checks,
    };
  }
}
