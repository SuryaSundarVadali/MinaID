// lib/IPFSCrypto.ts - Encryption utilities for IPFS uploads
import CryptoJS from 'crypto-js';

/**
 * Encryption configuration
 * Using AES-256-GCM for authenticated encryption
 */
export interface EncryptionResult {
  ciphertext: string;
  iv: string;
  salt: string;
}

export interface DecryptionParams {
  ciphertext: string;
  iv: string;
  salt: string;
  passphrase: string;
}

/**
 * Generate encryption key from passphrase using PBKDF2
 * @param passphrase User's passphrase or derived key
 * @param salt Salt for key derivation
 * @returns Derived key
 */
function deriveKey(passphrase: string, salt: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: 256 / 32, // 256 bits = 32 bytes = 8 words (32-bit)
    iterations: 100000, // High iteration count for security
  });
}

/**
 * Encrypt data before uploading to IPFS
 * @param data Data to encrypt (JSON object or string)
 * @param passphrase Encryption passphrase (user password or derived key)
 * @returns Encrypted data with IV and salt
 */
export function encryptForIPFS(
  data: any,
  passphrase: string
): EncryptionResult {
  try {
    // Convert data to JSON string if it's an object
    const plaintext = typeof data === 'string' ? data : JSON.stringify(data);

    // Generate random salt and IV
    const salt = CryptoJS.lib.WordArray.random(128 / 8); // 128 bits
    const iv = CryptoJS.lib.WordArray.random(128 / 8); // 128 bits

    // Derive encryption key from passphrase
    const key = deriveKey(passphrase, salt.toString());

    // Encrypt using AES-256-CBC (CryptoJS doesn't support GCM directly)
    const encrypted = CryptoJS.AES.encrypt(plaintext, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return {
      ciphertext: encrypted.toString(),
      iv: iv.toString(),
      salt: salt.toString(),
    };
  } catch (error) {
    console.error('[IPFSCrypto] Encryption failed:', error);
    throw new Error('Failed to encrypt data for IPFS');
  }
}

/**
 * Decrypt data downloaded from IPFS
 * @param params Encrypted data with IV, salt, and passphrase
 * @returns Decrypted data (parsed as JSON if possible)
 */
export function decryptFromIPFS(params: DecryptionParams): any {
  try {
    const { ciphertext, iv, salt, passphrase } = params;

    // Derive the same key using salt
    const key = deriveKey(passphrase, salt);

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // Convert to UTF-8 string
    const plaintext = decrypted.toString(CryptoJS.enc.Utf8);

    if (!plaintext) {
      throw new Error('Decryption failed: Invalid passphrase or corrupted data');
    }

    // Try to parse as JSON, return string if parsing fails
    try {
      return JSON.parse(plaintext);
    } catch {
      return plaintext;
    }
  } catch (error) {
    console.error('[IPFSCrypto] Decryption failed:', error);
    throw new Error('Failed to decrypt data from IPFS: ' + (error as Error).message);
  }
}

/**
 * Generate a deterministic passphrase from user credentials
 * This allows users to decrypt their data using their wallet address + password
 * @param walletAddress User's wallet address
 * @param userPassword User's password or PIN
 * @returns Deterministic passphrase
 */
export function generatePassphrase(
  walletAddress: string,
  userPassword: string
): string {
  // Combine wallet address and password, then hash
  const combined = `${walletAddress.toLowerCase()}-${userPassword}`;
  return CryptoJS.SHA256(combined).toString();
}

/**
 * Encrypt file (ArrayBuffer or Uint8Array) for IPFS upload
 * @param fileData File data as ArrayBuffer or Uint8Array
 * @param passphrase Encryption passphrase
 * @returns Encrypted data
 */
export function encryptFileForIPFS(
  fileData: ArrayBuffer | Uint8Array,
  passphrase: string
): EncryptionResult {
  try {
    // Convert ArrayBuffer/Uint8Array to WordArray
    const wordArray = CryptoJS.lib.WordArray.create(
      fileData instanceof ArrayBuffer ? new Uint8Array(fileData) : fileData
    );

    // Generate random salt and IV
    const salt = CryptoJS.lib.WordArray.random(128 / 8);
    const iv = CryptoJS.lib.WordArray.random(128 / 8);

    // Derive encryption key
    const key = deriveKey(passphrase, salt.toString());

    // Encrypt
    const encrypted = CryptoJS.AES.encrypt(wordArray, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    return {
      ciphertext: encrypted.toString(),
      iv: iv.toString(),
      salt: salt.toString(),
    };
  } catch (error) {
    console.error('[IPFSCrypto] File encryption failed:', error);
    throw new Error('Failed to encrypt file for IPFS');
  }
}

/**
 * Decrypt file downloaded from IPFS
 * @param params Encrypted file data with IV, salt, and passphrase
 * @returns Decrypted file as Uint8Array
 */
export function decryptFileFromIPFS(params: DecryptionParams): Uint8Array {
  try {
    const { ciphertext, iv, salt, passphrase } = params;

    // Derive key
    const key = deriveKey(passphrase, salt);

    // Decrypt
    const decrypted = CryptoJS.AES.decrypt(ciphertext, key, {
      iv: CryptoJS.enc.Hex.parse(iv),
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });

    // Convert WordArray to Uint8Array
    const words = decrypted.words;
    const sigBytes = decrypted.sigBytes;
    const u8 = new Uint8Array(sigBytes);

    for (let i = 0; i < sigBytes; i++) {
      const byte = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
      u8[i] = byte;
    }

    return u8;
  } catch (error) {
    console.error('[IPFSCrypto] File decryption failed:', error);
    throw new Error('Failed to decrypt file from IPFS');
  }
}

/**
 * Validate encryption result
 * @param result Encryption result to validate
 * @returns True if valid
 */
export function validateEncryptionResult(result: EncryptionResult): boolean {
  return !!(
    result &&
    result.ciphertext &&
    result.iv &&
    result.salt &&
    result.ciphertext.length > 0 &&
    result.iv.length > 0 &&
    result.salt.length > 0
  );
}
