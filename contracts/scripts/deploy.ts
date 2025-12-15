/**
 * deploy.ts
 * 
 * Deployment script for MinaID smart contracts.
 * Deploys DIDRegistry and ZKPVerifier to Berkeley testnet.
 * 
 * Usage:
 *   npm run deploy
 * 
 * Prerequisites:
 *   1. Funded deployer account on Berkeley
 *   2. config.json with deployer key
 *   3. Compiled contracts (npm run build)
 */

import {
  Mina,
  PrivateKey,
  PublicKey,
  AccountUpdate,
  MerkleMap,
  Field,
} from 'o1js';
import fs from 'fs/promises';
import { DIDRegistry } from '../src/DIDRegistry.js';
import { ZKPVerifier } from '../src/ZKPVerifier.js';

// Network configuration
const NETWORK = 'devnet';
const MINA_ENDPOINT = 'https://api.minascan.io/node/devnet/v1/graphql';
const ARCHIVE_ENDPOINT = 'https://api.minascan.io/archive/devnet/v1/graphql';

// Transaction fee - 0.1 MINA
const FEE = 100_000_000;

interface DeployConfig {
  version: number;
  deployAliases: {
    [alias: string]: {
      networkId: string;
      url: string;
      keyPath: string;
      fee: string;
      feepayerKeyPath: string;
      feepayerAlias: string;
    };
  };
  deployer?: {
    privateKey: string;
    publicKey: string;
  };
}

/**
 * Initialize Mina network
 */
function initNetwork() {
  const network = Mina.Network({
    mina: MINA_ENDPOINT,
    archive: ARCHIVE_ENDPOINT,
  });

  Mina.setActiveInstance(network);
  console.log('✅ Connected to Devnet');
}

/**
 * Load deployer key from config
 */
async function loadDeployerKey(): Promise<PrivateKey> {
  try {
    const configFile = await fs.readFile('config.json', 'utf-8');
    const config: DeployConfig = JSON.parse(configFile);

    if (config.deployer?.privateKey) {
      console.log('✅ Loaded deployer key from config');
      return PrivateKey.fromBase58(config.deployer.privateKey);
    }

    // If no deployer key, generate one and save it
    console.log('⚠️  No deployer key found. Generating new key...');
    const privateKey = PrivateKey.random();
    const publicKey = privateKey.toPublicKey();

    config.deployer = {
      privateKey: privateKey.toBase58(),
      publicKey: publicKey.toBase58(),
    };

    await fs.writeFile('config.json', JSON.stringify(config, null, 2));

    console.log('🔑 Generated new deployer key:');
    console.log('   Address:', publicKey.toBase58());
    console.log('   ⚠️  FUND THIS ADDRESS WITH MINA BEFORE DEPLOYING!');
    console.log('   Get testnet MINA from: https://faucet.minaprotocol.com');

    throw new Error('Please fund the deployer address and run the script again');
  } catch (error) {
    if (error instanceof Error && error.message.includes('fund')) {
      throw error;
    }
    throw new Error('Failed to load deployer key: ' + (error as Error).message);
  }
}

/**
 * Check deployer account balance
 */
async function checkBalance(publicKey: PublicKey): Promise<void> {
  console.log('\n📊 Checking deployer balance...');

  try {
    const account = await Mina.getAccount(publicKey);
    const balance = Number(account.balance.toBigInt()) / 1e9;

    console.log('   Balance:', balance, 'MINA');

    if (balance < 1) {
      throw new Error(
        `Insufficient balance. Need at least 1 MINA for deployment. Current: ${balance} MINA\n` +
        'Get testnet MINA from: https://faucet.minaprotocol.com'
      );
    }

    console.log('✅ Sufficient balance for deployment');
  } catch (error) {
    if (error instanceof Error && error.message.includes('Insufficient')) {
      throw error;
    }
    console.warn('⚠️  Could not check balance. Proceeding with deployment...');
  }
}

/**
 * Deploy DIDRegistry contract
 */
async function deployDIDRegistry(
  deployerKey: PrivateKey
): Promise<PublicKey> {
  console.log('\n🚀 Deploying DIDRegistry contract...');

  // Generate new keypair for the contract
  const contractKey = PrivateKey.random();
  const contractAddress = contractKey.toPublicKey();

  console.log('   Contract address:', contractAddress.toBase58());

  // Create contract instance
  const contract = new DIDRegistry(contractAddress);

  // Compile contract
  console.log('   Compiling contract...');
  const { verificationKey } = await DIDRegistry.compile();
  console.log('   ✅ Compilation complete');

  // Deploy transaction
  console.log('   Creating deployment transaction...');
  const tx = await Mina.transaction(
    { sender: deployerKey.toPublicKey(), fee: FEE },
    async () => {
      AccountUpdate.fundNewAccount(deployerKey.toPublicKey());
      await contract.deploy();
    }
  );

  // Sign and send
  console.log('   Proving transaction...');
  await tx.prove();

  console.log('   Signing transaction...');
  tx.sign([deployerKey, contractKey]);

  console.log('   Sending transaction...');
  const pendingTx = await tx.send();

  console.log('   Transaction hash:', pendingTx.hash);
  console.log('   Waiting for confirmation...');
  await pendingTx.wait();
  console.log('   View on Minascan: https://minascan.io/devnet/tx/' + pendingTx.hash);

  console.log('✅ DIDRegistry deployed successfully!');
  console.log('   Address:', contractAddress.toBase58());

  return contractAddress;
}

/**
 * Deploy ZKPVerifier contract
 */
async function deployZKPVerifier(
  deployerKey: PrivateKey
): Promise<PublicKey> {
  console.log('\n🚀 Deploying ZKPVerifier contract...');

  const contractKey = PrivateKey.random();
  const contractAddress = contractKey.toPublicKey();

  console.log('   Contract address:', contractAddress.toBase58());

  const contract = new ZKPVerifier(contractAddress);

  console.log('   Compiling contract...');
  const { verificationKey } = await ZKPVerifier.compile();
  console.log('   ✅ Compilation complete');

  console.log('   Creating deployment transaction...');
  const tx = await Mina.transaction(
    { sender: deployerKey.toPublicKey(), fee: FEE },
    async () => {
      AccountUpdate.fundNewAccount(deployerKey.toPublicKey());
      await contract.deploy();
    }
  );


  console.log('   Proving transaction...');
  await tx.prove();

  console.log('   Signing transaction...');
  tx.sign([deployerKey, contractKey]);

  console.log('   Sending transaction...');
  const pendingTx = await tx.send();

  console.log('   Transaction hash:', pendingTx.hash);
  console.log('   Waiting for confirmation...');
  await pendingTx.wait();
  console.log('   View on Minascan: https://minascan.io/devnet/tx/' + pendingTx.hash);

  console.log('✅ ZKPVerifier deployed successfully!');
  console.log('   Address:', contractAddress.toBase58());

  return contractAddress;
}

/**
 * Update config.json with deployed addresses
 */
async function updateConfig(
  didRegistryAddress: PublicKey,
  zkpVerifierAddress: PublicKey
): Promise<void> {
  console.log('\n📝 Updating config.json...');

  const configFile = await fs.readFile('config.json', 'utf-8');
  const config: any = JSON.parse(configFile);

  config.contracts = {
    didRegistry: {
      address: didRegistryAddress.toBase58(),
      network: NETWORK,
      deployedAt: new Date().toISOString(),
    },
    zkpVerifier: {
      address: zkpVerifierAddress.toBase58(),
      network: NETWORK,
      deployedAt: new Date().toISOString(),
    },
  };

  await fs.writeFile('config.json', JSON.stringify(config, null, 2));
  console.log('✅ Config updated');
}

/**
 * Update UI .env.local with deployed addresses
 */
async function updateUIEnv(
  didRegistryAddress: PublicKey,
  zkpVerifierAddress: PublicKey
): Promise<void> {
  console.log('\n📝 Updating ui/.env.local...');

  const envPath = '../ui/.env.local';

  try {
    let envContent = await fs.readFile(envPath, 'utf-8');

    // Update DIDRegistry address
    envContent = envContent.replace(
      /NEXT_PUBLIC_DID_REGISTRY_DEVNET=.*/,
      `NEXT_PUBLIC_DID_REGISTRY_DEVNET=${didRegistryAddress.toBase58()}`
    );

    // Update ZKPVerifier address
    envContent = envContent.replace(
      /NEXT_PUBLIC_ZKP_VERIFIER_DEVNET=.*/,
      `NEXT_PUBLIC_ZKP_VERIFIER_DEVNET=${zkpVerifierAddress.toBase58()}`
    );

    await fs.writeFile(envPath, envContent);
    console.log('✅ UI environment updated');
  } catch (error) {
    console.warn('⚠️  Could not update UI .env.local:', (error as Error).message);
  }
}

/**
 * Main deployment function
 */
async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║   MinaID Contract Deployment Script      ║');
  console.log('║   Network: Devnet                        ║');
  console.log('╚═══════════════════════════════════════════╝\n');

  try {
    // Initialize network
    initNetwork();

    // Load deployer key
    const deployerKey = await loadDeployerKey();
    const deployerAddress = deployerKey.toPublicKey();

    console.log('🔑 Deployer address:', deployerAddress.toBase58());

    // Check balance
    await checkBalance(deployerAddress);

    // Deploy contracts
    const didRegistryAddress = await deployDIDRegistry(deployerKey);
    const zkpVerifierAddress = await deployZKPVerifier(deployerKey);

    // Update configs
    await updateConfig(didRegistryAddress, zkpVerifierAddress);
    await updateUIEnv(didRegistryAddress, zkpVerifierAddress);

    // Success summary
    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║   ✅ DEPLOYMENT SUCCESSFUL!               ║');
    console.log('╚═══════════════════════════════════════════╝\n');

    console.log('📝 Deployed Contracts:');
    console.log('   DIDRegistry: ', didRegistryAddress.toBase58());
    console.log('   ZKPVerifier: ', zkpVerifierAddress.toBase58());
    console.log('\n🌐 Network:     ', NETWORK);
    console.log('🔗 Explorer:    ', `https://minascan.io/devnet/account/${didRegistryAddress.toBase58()}`);
    console.log('\n💡 Next Steps:');
    console.log('   1. Verify contracts on Minascan (Devnet)');
    console.log('   2. Test signup flow in UI');
    console.log('   3. Generate and verify proofs');

  } catch (error) {
    console.error('\n❌ Deployment failed:');
    console.error('   ', (error as Error).message);
    process.exit(1);
  }
}

// Run deployment
main().catch(console.error);
