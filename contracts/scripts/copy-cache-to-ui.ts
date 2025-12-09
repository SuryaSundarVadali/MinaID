import fs from 'fs/promises';
import path from 'path';

async function copyCacheToUI() {
  try {
    // Define paths (use __dirname to get absolute path in built JS)
    const scriptDir = path.dirname(new URL(import.meta.url).pathname);
    const contractsRoot = path.join(scriptDir, '..', '..');
    const cacheDir = path.join(contractsRoot, 'cache');
    const uiPublicCacheDir = path.join(contractsRoot, '..', 'ui', 'public', 'cache');
    const cacheJsonSource = path.join(contractsRoot, 'cache.json');
    const cacheJsonDest = path.join(contractsRoot, '..', 'ui', 'app', 'cache.json');

    // Check if cache directory exists
    try {
      await fs.access(cacheDir);
    } catch {
      console.log('Cache directory not found - skipping cache copy (will be generated during compile)');
      return;
    }

    // Create UI cache directory if it doesn't exist
    await fs.mkdir(uiPublicCacheDir, { recursive: true });

    // Read files from cache directory
    const files = await fs.readdir(cacheDir);

    // Copy each file except README.md
    for (const file of files) {
      if (file !== 'README.md') {
        const sourceFile = path.join(cacheDir, file);
        const destFile = path.join(uiPublicCacheDir, file);

        const data = await fs.readFile(sourceFile);
        await fs.writeFile(destFile, data);
      }
    }

    // Copy cache.json to UI app directory
    try {
      const cacheJsonData = await fs.readFile(cacheJsonSource);
      await fs.writeFile(cacheJsonDest, cacheJsonData);
    } catch (err: any) {
      if (err.code === 'ENOENT') {
        console.log('cache.json not found, skipping');
      } else {
        throw err;
      }
    }

    console.log('Cache files copied to UI successfully');
  } catch (error) {
    console.error('Error copying cache files:', error);
    console.log('Note: Cache files will be generated during contract compilation');
    // Don't exit with error - cache will be created during compile
    // process.exit(1);
  }
}

await copyCacheToUI();
