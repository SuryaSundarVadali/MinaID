import { Cache } from 'o1js';
import fs from 'fs/promises';

// When running from build/scripts/, we need to go up one level to get to build/src/
const { DIDRegistry } = await import('../src/DIDRegistry.js');
const { ZKPVerifier } = await import('../src/ZKPVerifier.js');
const { AgeVerificationProgram } = await import('../src/AgeVerificationProgram.js');

const cache_directory = 'cache';

// Create a file system cache instance pointing to our cache directory
// This allows o1js to store and retrieve compiled circuit artifacts
const cache: Cache = Cache.FileSystem(cache_directory);

console.log('Starting contract compilation with cache...');
console.log('This may take several minutes...\n');

// Compile AgeVerificationProgram first (ZKProgram)
console.log('1/3 Compiling AgeVerificationProgram...');
console.time('AgeVerificationProgram');
await AgeVerificationProgram.compile({ cache });
console.timeEnd('AgeVerificationProgram');
console.log('✅ AgeVerificationProgram compiled\n');

// Compile DIDRegistry contract
console.log('2/3 Compiling DIDRegistry...');
console.time('DIDRegistry');
await DIDRegistry.compile({ cache });
console.timeEnd('DIDRegistry');
console.log('✅ DIDRegistry compiled\n');

// Compile ZKPVerifier contract
console.log('3/3 Compiling ZKPVerifier...');
console.time('ZKPVerifier');
await ZKPVerifier.compile({ cache });
console.timeEnd('ZKPVerifier');
console.log('✅ ZKPVerifier compiled\n');

type CacheList = {
  files: string[];
};
const cacheObj: CacheList = {
  files: [],
};

const files = await fs.readdir(cache_directory);
for (const fileName of files) {
  if (!fileName.endsWith('.header')) {
    cacheObj['files'].push(fileName);
  }
}

const jsonCacheFile = `cache.json`;

try {
  await fs.writeFile(jsonCacheFile, JSON.stringify(cacheObj, null, 2));
  console.log('✅ cache.json successfully saved');
  console.log(`Total cache files: ${cacheObj.files.length}`);
} catch (error) {
  console.error('Error writing JSON file:', error);
}
