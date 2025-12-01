/**
 * SecurityUtils.ts
 * 
 * Security utilities for MinaID
 */

/**
 * Safe base64 decode without using atob (browser-compatible)
 * Supports both standard Base64 and Base64URL
 * @param base64 Base64 encoded string
 * @returns Uint8Array of decoded bytes
 */
export function base64ToBytes(base64: string): Uint8Array {
  // Normalize Base64URL to Base64
  base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
  
  const base64abc = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const l = base64.length;
  const placeHolders = base64[l - 2] === '=' ? 2 : base64[l - 1] === '=' ? 1 : 0;
  const arr = new Uint8Array((l * 3 / 4) - placeHolders);
  let j = 0;
  
  for (let i = 0; i < l; i += 4) {
    const encoded1 = base64abc.indexOf(base64[i]);
    const encoded2 = base64abc.indexOf(base64[i + 1]);
    const encoded3 = base64abc.indexOf(base64[i + 2]);
    const encoded4 = base64abc.indexOf(base64[i + 3]);
    
    if (encoded1 === -1 || encoded2 === -1) continue;
    
    arr[j++] = (encoded1 << 2) | (encoded2 >> 4);
    if (encoded3 !== -1 && base64[i + 2] !== '=') {
      arr[j++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
    }
    if (encoded4 !== -1 && base64[i + 3] !== '=') {
      arr[j++] = ((encoded3 & 3) << 6) | encoded4;
    }
  }
  
  return arr;
}

/**
 * Content Security Policy configuration
 */
export const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': ["'self'", "'unsafe-eval'"], // unsafe-eval required for o1js
  'style-src': ["'self'", "'unsafe-inline'"], // unsafe-inline for Tailwind
  'img-src': ["'self'", 'data:', 'blob:'],
  'font-src': ["'self'", 'data:'],
  'connect-src': ["'self'", 'https://*.minaexplorer.com', 'https://*.minascan.io'],
  'worker-src': ["'self'", 'blob:'],
  'frame-ancestors': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
};

/**
 * Generate CSP header string
 */
export function generateCSPHeader(): string {
  return Object.entries(CSP_DIRECTIVES)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

/**
 * Secure random string generation
 */
export function generateSecureRandom(length: number = 32): string {
  const array = new Uint8Array(Math.ceil(length / 2));
  crypto.getRandomValues(array);
  const hex = Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return hex.substring(0, length);
}

/**
 * Hash sensitive data for logging (one-way)
 */
export async function hashForLogging(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

/**
 * Constant-time string comparison (prevent timing attacks)
 */
export function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

/**
 * Check if running in secure context
 */
export function isSecureContext(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext;
}

/**
 * Validate HTTPS connection
 */
export function requireHTTPS(): void {
  if (typeof window === 'undefined') return;

  if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
    throw new Error('HTTPS required for security. Please use https://');
  }
}

/**
 * Check if browser supports required security features
 */
export function checkSecurityFeatures(): {
  supported: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  // Check Web Crypto API
  if (!window.crypto || !window.crypto.subtle) {
    missing.push('Web Crypto API');
  }

  // Check WebAuthn/Passkey support
  if (!window.PublicKeyCredential) {
    missing.push('WebAuthn (Passkeys)');
  }

  // Check localStorage
  try {
    localStorage.setItem('test', 'test');
    localStorage.removeItem('test');
  } catch {
    missing.push('localStorage');
  }

  // Check SharedArrayBuffer (required for o1js)
  if (typeof SharedArrayBuffer === 'undefined') {
    missing.push('SharedArrayBuffer (required for zero-knowledge proofs)');
  }

  return {
    supported: missing.length === 0,
    missing,
  };
}

/**
 * Sanitize localStorage keys to prevent injection
 */
export function sanitizeStorageKey(key: string): string {
  return key.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Secure data deletion from memory (best effort)
 */
export function secureDelete(data: any): void {
  if (typeof data === 'string') {
    // Overwrite string data (best effort in JS)
    data = '\0'.repeat(data.length);
  } else if (data instanceof Uint8Array) {
    // Zero out typed array
    data.fill(0);
  } else if (typeof data === 'object' && data !== null) {
    // Recursively delete object properties
    Object.keys(data).forEach((key) => {
      secureDelete(data[key]);
      delete data[key];
    });
  }
}

/**
 * Generate TOTP-like code for verification (6 digits)
 */
export function generateVerificationCode(): string {
  const randomBytes = new Uint8Array(4);
  crypto.getRandomValues(randomBytes);
  const value = new DataView(randomBytes.buffer).getUint32(0, false);
  return (value % 1000000).toString().padStart(6, '0');
}

/**
 * Check if value is likely a private key (basic heuristic)
 */
export function looksLikePrivateKey(value: string): boolean {
  // Check for base58 private key pattern or hex pattern
  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{50,60}$/;
  const hexRegex = /^(0x)?[0-9a-fA-F]{64}$/;
  
  return base58Regex.test(value) || hexRegex.test(value);
}

/**
 * Redact sensitive data for logging
 */
export function redactSensitiveData(obj: any): any {
  const sensitiveKeys = [
    'privateKey',
    'privatekey',
    'private_key',
    'password',
    'passkey',
    'secret',
    'token',
    'apikey',
    'api_key',
    'seed',
    'mnemonic',
  ];

  if (typeof obj !== 'object' || obj === null) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(redactSensitiveData);
  }

  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some((sensitiveKey) => lowerKey.includes(sensitiveKey))) {
      redacted[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      redacted[key] = redactSensitiveData(value);
    } else if (typeof value === 'string' && looksLikePrivateKey(value)) {
      redacted[key] = '[REDACTED_KEY]';
    } else {
      redacted[key] = value;
    }
  }

  return redacted;
}

/**
 * Security headers for API calls
 */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=()',
};

/**
 * Log security event (for audit trail)
 */
export function logSecurityEvent(
  event: string,
  details: Record<string, any>,
  level: 'info' | 'warning' | 'error' = 'info'
): void {
  const timestamp = new Date().toISOString();
  const redactedDetails = redactSensitiveData(details);
  
  const logEntry = {
    timestamp,
    event,
    level,
    details: redactedDetails,
  };

  console[level === 'error' ? 'error' : level === 'warning' ? 'warn' : 'log'](
    `[SecurityLog] ${event}`,
    logEntry
  );

  // Store in localStorage for audit trail (limit size)
  try {
    const logs = JSON.parse(localStorage.getItem('minaid_security_logs') || '[]');
    logs.unshift(logEntry);
    
    // Keep only last 100 logs
    if (logs.length > 100) {
      logs.splice(100);
    }
    
    localStorage.setItem('minaid_security_logs', JSON.stringify(logs));
  } catch (error) {
    console.error('[SecurityLog] Failed to store log:', error);
  }
}
