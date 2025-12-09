/**
 * merkle.ts
 * Merkle tree utilities for browser
 */

import { sha256Hex, hexToBytes } from './crypto';

/**
 * Compute Merkle root from array of hex hash strings
 * Uses the same algorithm as the Node.js build script
 * 
 * @param hashes - Array of hex-encoded SHA-256 hashes
 * @returns Merkle root as hex string
 */
export async function merkleRootFromHex(hashes: string[]): Promise<string> {
  if (hashes.length === 0) return '';
  if (hashes.length === 1) return hashes[0];
  
  let level = hashes.slice();
  
  while (level.length > 1) {
    const next: string[] = [];
    
    for (let i = 0; i < level.length; i += 2) {
      if (i + 1 < level.length) {
        // Combine raw bytes: hex -> bytes -> concat -> hash
        const left = hexToBytes(level[i]);
        const right = hexToBytes(level[i + 1]);
        const concat = new Uint8Array(left.length + right.length);
        concat.set(left, 0);
        concat.set(right, left.length);
        const hash = await sha256Hex(concat.buffer);
        next.push(hash);
      } else {
        // Odd number of nodes - promote last node
        next.push(level[i]);
      }
    }
    
    level = next;
  }
  
  return level[0];
}

/**
 * Verify that a set of chunk hashes produces the expected file Merkle root
 * 
 * @param chunkHashes - Array of chunk hashes from manifest
 * @param expectedRoot - Expected file Merkle root from manifest
 * @returns true if verification succeeds
 */
export async function verifyFileMerkleRoot(
  chunkHashes: string[],
  expectedRoot: string
): Promise<boolean> {
  const computedRoot = await merkleRootFromHex(chunkHashes);
  return computedRoot === expectedRoot;
}

/**
 * Verify global manifest root from file entries
 * 
 * @param files - File manifest entries
 * @param expectedRoot - Expected global root from manifest
 * @param version - Manifest version
 * @returns true if verification succeeds
 */
export async function verifyManifestRoot(
  files: Array<{ fileId: string; fileMerkleRoot: string; index: number }>,
  expectedRoot: string,
  version: number
): Promise<boolean> {
  const { sha256String } = await import('./crypto');
  
  // Sort by index to ensure deterministic order
  const sortedFiles = files.slice().sort((a, b) => a.index - b.index);
  
  // Compute file leaves
  const fileLeaves = await Promise.all(
    sortedFiles.map(async entry => {
      const leafData = `${entry.fileId}:${entry.fileMerkleRoot}:${version}`;
      return sha256String(leafData);
    })
  );
  
  // Compute global root
  const computedRoot = await merkleRootFromHex(fileLeaves);
  
  return computedRoot === expectedRoot;
}
