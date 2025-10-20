/**
 * CryptoUtils.ts
 * 
 * Cryptographic utilities for MinaID - provides secure key encryption, 
 * decryption, and storage using Web Crypto API with Passkey-derived keys.
 * 
 * Features:
 * - PBKDF2 key derivation from Passkey credentials
 * - AES-GCM encryption/decryption for private keys
 * - Secure localStorage management with encryption
 * - Challenge generation for authentication
 * 
 * Security:
 * - Uses Web Crypto API (SubtleCrypto) for cryptographic operations
 * - Passkey credential ID + user verification = encryption key
 * - AES-256-GCM for authenticated encryption
 * - Random IVs for each encryption operation
 * - PBKDF2 with 100k iterations for key derivation
 */

// Types
export interface EncryptedData {
  ciphertext: string;      // Base64 encoded encrypted data
  iv: string;              // Base64 encoded initialization vector
  salt: string;            // Base64 encoded salt for key derivation
  passkeyId: string;       // Passkey credential ID used for encryption
  timestamp: number;       // When the data was encrypted
}

export interface StorageKey {
  did: string;
  type: 'privateKey' | 'credentials' | 'metadata';
}

// Constants
const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;

/**
 * Generate a cryptographically secure random challenge
 * @param length Length of the challenge in bytes (default: 32)
 * @returns Base64 encoded challenge string
 */
export async function generateChallenge(length: number = 32): Promise<string> {
  const buffer = new Uint8Array(length);
  crypto.getRandomValues(buffer);
  return bufferToBase64(buffer);
}

/**
 * Derive an encryption key from Passkey credential using PBKDF2
 * @param passkeyId The Passkey credential ID
 * @param salt Salt for key derivation
 * @returns CryptoKey for AES-GCM encryption
 */
async function deriveKeyFromPasskey(
  passkeyId: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  // Use Passkey ID as the password material
  const encoder = new TextEncoder();
  const passwordMaterial = encoder.encode(passkeyId);

  // Import the password material as a key
  const baseKey = await crypto.subtle.importKey(
    'raw',
    passwordMaterial,
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive the AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt sensitive data using Passkey-derived key
 * @param data The data to encrypt (private key, credentials, etc.)
 * @param passkeyId The Passkey credential ID to derive encryption key from
 * @returns Encrypted data object
 */
export async function encryptWithPasskey(
  data: string,
  passkeyId: string
): Promise<EncryptedData> {
  try {
    // Generate random salt and IV
    const saltBuffer = new Uint8Array(SALT_LENGTH);
    const ivBuffer = new Uint8Array(IV_LENGTH);
    crypto.getRandomValues(saltBuffer);
    crypto.getRandomValues(ivBuffer);

    // Derive encryption key from Passkey
    const key = await deriveKeyFromPasskey(passkeyId, saltBuffer);

    // Encrypt the data
    const encoder = new TextEncoder();
    const encodedData = encoder.encode(data);
    const ciphertext = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: ivBuffer.buffer as ArrayBuffer,
      },
      key,
      encodedData
    );

    return {
      ciphertext: bufferToBase64(new Uint8Array(ciphertext)),
      iv: bufferToBase64(ivBuffer),
      salt: bufferToBase64(saltBuffer),
      passkeyId: passkeyId,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error('Encryption failed:', error);
    throw new Error('Failed to encrypt data with Passkey');
  }
}

/**
 * Decrypt data using Passkey-derived key
 * @param encryptedData The encrypted data object
 * @param passkeyId The Passkey credential ID (must match encryption passkeyId)
 * @returns Decrypted plaintext string
 */
export async function decryptWithPasskey(
  encryptedData: EncryptedData,
  passkeyId: string
): Promise<string> {
  try {
    // Verify Passkey ID matches
    if (encryptedData.passkeyId !== passkeyId) {
      throw new Error('Passkey ID mismatch - cannot decrypt');
    }

    // Convert Base64 strings to Uint8Array
    const ciphertext = base64ToBuffer(encryptedData.ciphertext);
    const iv = base64ToBuffer(encryptedData.iv);
    const salt = base64ToBuffer(encryptedData.salt);

    // Derive decryption key from Passkey
    const key = await deriveKeyFromPasskey(passkeyId, salt);

    // Decrypt the data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv.buffer as ArrayBuffer,
      },
      key,
      ciphertext.buffer as ArrayBuffer
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  } catch (error) {
    console.error('Decryption failed:', error);
    throw new Error('Failed to decrypt data - invalid Passkey or corrupted data');
  }
}

/**
 * Store encrypted data in localStorage
 * @param key Storage key (DID + data type)
 * @param data The data to encrypt and store
 * @param passkeyId The Passkey credential ID for encryption
 */
export async function secureStore(
  key: StorageKey,
  data: string,
  passkeyId: string
): Promise<void> {
  const storageKey = `minaid:${key.did}:${key.type}`;
  const encrypted = await encryptWithPasskey(data, passkeyId);
  localStorage.setItem(storageKey, JSON.stringify(encrypted));
}

/**
 * Retrieve and decrypt data from localStorage
 * @param key Storage key (DID + data type)
 * @param passkeyId The Passkey credential ID for decryption
 * @returns Decrypted data or null if not found
 */
export async function secureRetrieve(
  key: StorageKey,
  passkeyId: string
): Promise<string | null> {
  const storageKey = `minaid:${key.did}:${key.type}`;
  const stored = localStorage.getItem(storageKey);
  
  if (!stored) {
    return null;
  }

  try {
    const encrypted: EncryptedData = JSON.parse(stored);
    return await decryptWithPasskey(encrypted, passkeyId);
  } catch (error) {
    console.error('Failed to retrieve secure data:', error);
    return null;
  }
}

/**
 * Remove encrypted data from localStorage
 * @param key Storage key (DID + data type)
 */
export function secureDelete(key: StorageKey): void {
  const storageKey = `minaid:${key.did}:${key.type}`;
  localStorage.removeItem(storageKey);
}

/**
 * Check if encrypted data exists in storage
 * @param key Storage key (DID + data type)
 * @returns True if data exists
 */
export function secureExists(key: StorageKey): boolean {
  const storageKey = `minaid:${key.did}:${key.type}`;
  return localStorage.getItem(storageKey) !== null;
}

/**
 * List all MinaID storage keys for a specific DID
 * @param did The DID to search for
 * @returns Array of storage types found
 */
export function listStorageKeys(did: string): string[] {
  const prefix = `minaid:${did}:`;
  const keys: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keys.push(key.replace(prefix, ''));
    }
  }
  
  return keys;
}

/**
 * Clear all MinaID data from localStorage (use with caution!)
 * @param did Optional - clear only data for specific DID
 */
export function clearAllStorage(did?: string): void {
  const prefix = did ? `minaid:${did}:` : 'minaid:';
  const keysToDelete: string[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(prefix)) {
      keysToDelete.push(key);
    }
  }
  
  keysToDelete.forEach(key => localStorage.removeItem(key));
}

// Helper functions for Base64 encoding/decoding

/**
 * Convert ArrayBuffer/Uint8Array to Base64 string
 */
function bufferToBase64(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Convert Base64 string to Uint8Array
 */
function base64ToBuffer(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Hash data using SHA-256
 * @param data The data to hash
 * @returns Base64 encoded hash
 */
export async function sha256Hash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const encodedData = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', encodedData);
  return bufferToBase64(new Uint8Array(hashBuffer));
}

/**
 * Validate that Web Crypto API is available
 * @throws Error if Web Crypto is not available
 */
export function validateCryptoAvailable(): void {
  if (!crypto || !crypto.subtle) {
    throw new Error('Web Crypto API is not available in this environment');
  }
}

// Validate crypto availability on module load
validateCryptoAvailable();
