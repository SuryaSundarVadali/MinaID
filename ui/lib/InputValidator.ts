/**
 * InputValidator.ts
 * 
 * Input validation and sanitization utilities
 */

/**
 * Validate DID format
 */
export function validateDID(did: string): boolean {
  // Format: did:mina:B62q...
  const didRegex = /^did:mina:B62[a-zA-Z0-9]{50,55}$/;
  return didRegex.test(did);
}

/**
 * Validate Mina address format
 */
export function validateMinaAddress(address: string): boolean {
  // Mina addresses start with B62q and are 55 characters
  const addressRegex = /^B62q[a-zA-Z0-9]{51}$/;
  return addressRegex.test(address);
}

/**
 * Validate passkey ID format
 */
export function validatePasskeyId(passkeyId: string): boolean {
  // Base64url encoded, typically 32+ characters, alphanumeric plus - and _
  if (typeof passkeyId !== 'string') return false;
  if (passkeyId.length < 3 || passkeyId.length > 256) return false;
  // Allow alphanumeric, dash, and underscore
  const passkeyRegex = /^[A-Za-z0-9\-_]+$/;
  return passkeyRegex.test(passkeyId);
}

/**
 * Validate age value
 */
export function validateAge(age: number): { valid: boolean; error?: string } {
  if (isNaN(age) || !isFinite(age)) {
    return { valid: false, error: 'Age must be a valid number' };
  }
  if (!Number.isInteger(age)) {
    return { valid: false, error: 'Age must be a whole number' };
  }
  if (age < 0) {
    return { valid: false, error: 'Age must be a positive number' };
  }
  if (age > 150) {
    return { valid: false, error: 'Age must be between 0 and 150' };
  }
  return { valid: true };
}

/**
 * Sanitize string input (remove potential XSS)
 */
export function sanitizeString(input: string): string {
  if (!input) return input;
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, ''); // Remove event handlers like onclick=
}

/**
 * Validate JSON string
 */
export function validateJSON(jsonString: string): boolean {
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate proof data structure
 */
export function validateProofData(proof: any): { valid: boolean; error?: string } {
  if (!proof || typeof proof !== 'object') {
    return { valid: false, error: 'Proof must be an object' };
  }

  // Support both old format (id, type) and new format (proofType, metadata.proofId)
  // Check proofType first (new format) before falling back to type (old format)
  const proofId = proof.metadata?.proofId || proof.id;
  const proofType = proof.proofType || proof.type;

  if (!proofId || typeof proofId !== 'string') {
    return { valid: false, error: 'Proof must have a valid ID' };
  }

  // Accept various proof types including name verification and citizenship
  const validTypes = ['age', 'kyc', 'composite', 'citizenship', 'age18', 'age21', 'name', 'identity'];
  if (!proofType || !validTypes.includes(proofType)) {
    return { valid: false, error: `Proof must have a valid type. Got: ${proofType}` };
  }

  const timestamp = proof.timestamp || proof.metadata?.generatedAt;
  if (!timestamp) {
    return { valid: false, error: 'Proof must have a valid timestamp' };
  }

  // Validate proof data exists
  if (!proof.proof) {
    return { valid: false, error: 'Proof must contain proof data' };
  }

  return { valid: true };
}

/**
 * Validate credential data (Aadhar)
 */
export function validateCredentialData(data: any): { valid: boolean; error?: string } {
  if (!data || typeof data !== 'object') {
    return { valid: false, error: 'Credential data must be an object' };
  }

  // Check required Aadhar fields
  const requiredFields = ['name', 'aadharNumber', 'dateOfBirth'];
  for (const field of requiredFields) {
    if (!data[field]) {
      return { valid: false, error: `Missing required field: ${field}` };
    }
  }

  // Validate Aadhar number (12 digits)
  if (!/^\d{12}$/.test(data.aadharNumber)) {
    return { valid: false, error: 'aadharNumber must be 12 digits' };
  }

  // Validate date of birth format (YYYY-MM-DD)
  const dobRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dobRegex.test(data.dateOfBirth)) {
    return { valid: false, error: 'dateOfBirth must be in YYYY-MM-DD format' };
  }

  return { valid: true };
}

/**
 * Check if string contains suspicious patterns
 */
export function containsSuspiciousPatterns(input: string): boolean {
  const suspiciousPatterns = [
    /<script/i,
    /javascript:/i,
    /on\w+\s*=/i,
    /<iframe/i,
    /eval\(/i,
    /expression\(/i,
    // SQL injection patterns
    /'\s*OR\s*'?\d/i,
    /'\s*OR\s*'\d*'\s*=\s*'\d/i,
    /DROP\s+TABLE/i,
    /SELECT\s+\*\s+FROM/i,
    /UNION\s+SELECT/i,
  ];

  return suspiciousPatterns.some((pattern) => pattern.test(input));
}

/**
 * Validate URL
 */
export function validateURL(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Only allow http and https protocols
    return ['http:', 'https:'].includes(urlObj.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate file size
 */
export function validateFileSize(size: number, maxSizeMB: number = 5): { valid: boolean; error?: string } {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (size > maxSizeBytes) {
    return { 
      valid: false, 
      error: `File size exceeds ${maxSizeMB}MB limit` 
    };
  }
  
  return { valid: true };
}

/**
 * Validate email format
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Rate limit key generator (for consistent rate limiting)
 */
export function generateRateLimitKey(operation: string, identifier: string): string {
  return `${operation}:${identifier}`;
}
