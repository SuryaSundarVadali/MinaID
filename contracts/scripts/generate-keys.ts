import { PrivateKey } from 'o1js';
import fs from 'fs';
import path from 'path';

/**
 * Generate deployment keys for MinaID contracts
 * 
 * Usage:
 *   npx tsx scripts/generate-keys.ts devnet
 *   npx tsx scripts/generate-keys.ts berkeley
 *   npx tsx scripts/generate-keys.ts mainnet
 */

const network = process.argv[2] || 'devnet';
const keysDir = path.join(process.cwd(), 'keys');

// Create keys directory if it doesn't exist
if (!fs.existsSync(keysDir)) {
  fs.mkdirSync(keysDir, { recursive: true });
  console.log('✓ Created keys directory');
}

// Generate deployer key
console.log(`Generating keys for ${network}...`);

// Try to load keys from config.json first
let deployerKey: PrivateKey;
let feepayerKey: PrivateKey;
let usingExistingKeys = false;

try {
  const configPath = path.join(process.cwd(), 'config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    if (config.deployer && config.deployer.privateKey) {
      console.log('✓ Found existing deployer key in config.json');
      deployerKey = PrivateKey.fromBase58(config.deployer.privateKey);
      
      // Use the same key for feepayer if not specified otherwise
      // This saves having to fund two accounts
      feepayerKey = deployerKey;
      usingExistingKeys = true;
    } else {
      deployerKey = PrivateKey.random();
      feepayerKey = PrivateKey.random();
    }
  } else {
    deployerKey = PrivateKey.random();
    feepayerKey = PrivateKey.random();
  }
} catch (error) {
  console.warn('⚠️  Could not read config.json, generating new keys');
  deployerKey = PrivateKey.random();
  feepayerKey = PrivateKey.random();
}

const deployerData = {
  privateKey: deployerKey.toBase58(),
  publicKey: deployerKey.toPublicKey().toBase58()
};

const feepayerData = {
  privateKey: feepayerKey.toBase58(),
  publicKey: feepayerKey.toPublicKey().toBase58()
};

// Save keys
const deployerPath = path.join(keysDir, `${network}.json`);
const feepayerPath = path.join(keysDir, `${network}-feepayer.json`);

fs.writeFileSync(deployerPath, JSON.stringify(deployerData, null, 2));
fs.writeFileSync(feepayerPath, JSON.stringify(feepayerData, null, 2));

console.log('\n✓ Keys processed successfully!\n');
console.log('Deployer Key:');
console.log(`  Address: ${deployerData.publicKey}`);
console.log(`  File: ${deployerPath}\n`);

console.log('Fee Payer Key:');
console.log(`  Address: ${feepayerData.publicKey}`);
console.log(`  File: ${feepayerPath}\n`);

if (!usingExistingKeys) {
  console.log('⚠️  IMPORTANT: Fund these addresses before deployment\n');

  const faucetUrls: Record<string, string> = {
    devnet: 'https://faucet.minaprotocol.com/?network=devnet',
    berkeley: 'https://faucet.minaprotocol.com/?network=berkeley',
    mainnet: 'N/A - Use real MINA tokens'
  };

  console.log(`Faucet: ${faucetUrls[network] || 'Unknown network'}\n`);

  console.log('Next steps:');
  console.log('1. Fund both addresses from the faucet');
  console.log('2. Wait 3-5 minutes for confirmation');
} else {
  console.log('✅ Using existing funded keys from config.json');
}

console.log('3. Run: npm run deploy ' + network);
console.log('\n⚠️  Keep these keys secure - they control contract deployment!\n');
