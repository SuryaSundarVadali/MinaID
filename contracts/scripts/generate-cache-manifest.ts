/**
 * Generate cache manifest with two-level Merkle tree
 * - Per-file Merkle root (chunk integrity)
 * - Global manifest root (all files integrity)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHUNK_SIZE = 1024 * 1024; // 1MB chunks
const CACHE_DIR = path.join(__dirname, '..', 'cache');
const OUTPUT_FILE = path.join(__dirname, '..', 'cache.json');

function sha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

function sha256String(str: string): string {
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

function hexToBytes(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

interface FileChunkData {
  chunkHashes: string[];
  totalChunks: number;
  fileSize: number;
}

function readChunks(filePath: string): FileChunkData {
  const stat = fs.statSync(filePath);
  const fd = fs.openSync(filePath, 'r');
  const totalChunks = Math.ceil(stat.size / CHUNK_SIZE);
  const chunkHashes: string[] = [];
  
  for (let i = 0; i < totalChunks; i++) {
    const chunkSize = Math.min(CHUNK_SIZE, stat.size - i * CHUNK_SIZE);
    const buf = Buffer.alloc(chunkSize);
    fs.readSync(fd, buf, 0, buf.length, i * CHUNK_SIZE);
    chunkHashes.push(sha256(buf));
  }
  
  fs.closeSync(fd);
  return { chunkHashes, totalChunks, fileSize: stat.size };
}

/**
 * Compute Merkle root from hex hash strings
 * Promotes last node if odd number
 */
function merkleRootFromHex(hashes: string[]): string {
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
        const concat = Buffer.concat([left, right]);
        next.push(sha256(concat));
      } else {
        // Odd number - promote last node
        next.push(level[i]);
      }
    }
    
    level = next;
  }
  
  return level[0];
}

interface FileManifestEntry {
  fileId: string;
  totalChunks: number;
  fileSize: number;
  chunkHashes: string[];
  fileMerkleRoot: string;
  index: number;
  modified: string;
}

interface Manifest {
  version: number;
  generatedAt: number;
  totalSize: number;
  totalFiles: number;
  files: Record<string, FileManifestEntry>;
  root: string;
  signature?: string;
}

async function generateManifest(): Promise<Manifest> {
  console.log('📂 Reading cache directory:', CACHE_DIR);
  
  // Read all files (excluding .header files and special files)
  const allFiles = fs.readdirSync(CACHE_DIR);
  const cacheFiles = allFiles.filter(f => 
    !f.endsWith('.header') && 
    !f.endsWith('.json') && 
    f !== 'README.md' && 
    !f.startsWith('.')
  );
  
  console.log(`📋 Found ${cacheFiles.length} cache files`);
  
  const manifest: Manifest = {
    version: 2, // Two-level Merkle
    generatedAt: Date.now(),
    totalSize: 0,
    totalFiles: cacheFiles.length,
    files: {},
    root: ''
  };
  
  // Process each file
  for (let idx = 0; idx < cacheFiles.length; idx++) {
    const fileId = cacheFiles[idx];
    const filePath = path.join(CACHE_DIR, fileId);
    const stat = fs.statSync(filePath);
    
    console.log(`  [${idx + 1}/${cacheFiles.length}] Processing ${fileId} (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);
    
    const { chunkHashes, totalChunks, fileSize } = readChunks(filePath);
    const fileMerkleRoot = merkleRootFromHex(chunkHashes);
    
    manifest.files[fileId] = {
      fileId,
      totalChunks,
      fileSize,
      chunkHashes,
      fileMerkleRoot,
      index: idx,
      modified: stat.mtime.toISOString()
    };
    
    manifest.totalSize += fileSize;
    
    console.log(`    ✓ ${totalChunks} chunks, root: ${fileMerkleRoot.slice(0, 16)}...`);
  }
  
  // Compute global manifest root over file leaves
  console.log('\n🌳 Computing global Merkle root...');
  const fileLeaves = Object.values(manifest.files)
    .sort((a, b) => a.index - b.index) // Sort by index for deterministic order
    .map(entry => {
      // Leaf = SHA256(fileId + ':' + fileMerkleRoot + ':' + version)
      const leafData = `${entry.fileId}:${entry.fileMerkleRoot}:${manifest.version}`;
      return sha256String(leafData);
    });
  
  manifest.root = merkleRootFromHex(fileLeaves);
  
  console.log(`✅ Global root: ${manifest.root}`);
  console.log(`📊 Total size: ${(manifest.totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
  
  // TODO: Sign manifest.root with Ed25519 private key in CI
  // For now, we'll leave signature undefined
  // manifest.signature = await signManifestRoot(manifest.root);
  
  return manifest;
}

async function main() {
  try {
    const manifest = await generateManifest();
    
    // Write manifest to cache.json
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`\n💾 Wrote manifest to ${OUTPUT_FILE}`);
    
    // Also write to UI directory
    const uiCacheJson = path.join(__dirname, '..', '..', 'ui', 'app', 'cache.json');
    fs.writeFileSync(uiCacheJson, JSON.stringify(manifest, null, 2) + '\n');
    console.log(`💾 Wrote manifest to ${uiCacheJson}`);
    
    console.log('\n✨ Cache manifest generation complete!');
    
  } catch (error) {
    console.error('❌ Error generating cache manifest:', error);
    process.exit(1);
  }
}

main();
