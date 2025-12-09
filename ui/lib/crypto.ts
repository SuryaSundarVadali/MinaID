/**
 * crypto.ts
 * Browser cryptography utilities using WebCrypto API
 */

/**
 * Compute SHA-256 hash of ArrayBuffer and return as hex string
 */
export async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Compute SHA-256 hash of string and return as hex string
 */
export async function sha256String(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  return sha256Hex(data.buffer);
}

/**
 * Convert hex string to Uint8Array
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert Uint8Array to hex string
 */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Verify Ed25519 signature (placeholder for future implementation)
 * TODO: Implement with WebCrypto or libsodium wrapper
 */
export async function verifySignature(
  message: string,
  signature: string,
  publicKey: string
): Promise<boolean> {
  // For now, skip signature verification
  // In production, implement with:
  // - WebCrypto Ed25519 (when available)
  // - Or libsodium-wrappers
  console.warn('[Crypto] Signature verification not yet implemented');
  return true;
}
