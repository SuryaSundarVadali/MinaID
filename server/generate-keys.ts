#!/usr/bin/env ts-node

/**
 * Generate Oracle Key Pair for MinaID Passport Verification
 * Run: npx ts-node generate-keys.ts
 */

import { PrivateKey } from 'o1js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateOracleKeys() {
  console.log('\n🔑 Generating Oracle Key Pair for MinaID...\n');
  
  const privateKey = PrivateKey.random();
  const publicKey = privateKey.toPublicKey();
  
  const privateKeyBase58 = privateKey.toBase58();
  const publicKeyBase58 = publicKey.toBase58();
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ Keys Generated Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('🔐 Private Key (Keep SECRET - Add to .env):');
  console.log(privateKeyBase58);
  console.log('\n🔓 Public Key (Add to Smart Contract):');
  console.log(publicKeyBase58);
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // Create or update .env file
  const envPath = path.join(__dirname, '.env');
  const envContent = `# MinaID Oracle Server Configuration
# Generated on ${new Date().toISOString()}
# ⚠️  NEVER commit this file to version control!

# Oracle Signing Key (KEEP SECRET!)
ORACLE_PRIVATE_KEY=${privateKeyBase58}

# Server Configuration
PORT=4000
NODE_ENV=development

# CORS Configuration (Update for production)
CORS_ORIGIN=http://localhost:3000,https://mina-id-suryasundarvadalis-projects.vercel.app

# Logging
LOG_LEVEL=info

# Optional: Third-party Document Verification Services
# SMILE_ID_API_KEY=your_smile_id_key
# SMILE_ID_PARTNER_ID=your_partner_id
# HYPERVERGE_API_KEY=your_hyperverge_key
`;

  fs.writeFileSync(envPath, envContent);
  console.log('✅ Created .env file at: server/.env\n');
  
  // Create a public-key.txt for reference
  const publicKeyPath = path.join(__dirname, 'oracle-public-key.txt');
  fs.writeFileSync(publicKeyPath, `Oracle Public Key for MinaID Smart Contract\n\nPublic Key (Base58):\n${publicKeyBase58}\n\nGenerated: ${new Date().toISOString()}\n`);
  console.log('✅ Saved public key to: server/oracle-public-key.txt\n');
  
  console.log('📋 Next Steps:\n');
  console.log('1. ✓ Private key saved to .env');
  console.log('2. → Update your smart contract with the public key above');
  console.log('3. → Start Oracle server: npm run oracle:dev');
  console.log('4. → Test endpoint: http://localhost:4000/health\n');
  
  console.log('🔒 Security Reminder:');
  console.log('   - NEVER share your private key');
  console.log('   - NEVER commit .env to version control');
  console.log('   - Use different keys for dev/staging/production\n');
}

generateOracleKeys().catch(console.error);
