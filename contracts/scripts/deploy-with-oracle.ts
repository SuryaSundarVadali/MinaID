/**
 * Deploy MinaIDContract with Oracle Integration
 * 
 * This script deploys the contract and sets the Oracle public key
 */

import { AccountUpdate, Mina, PrivateKey, PublicKey } from 'o1js';
import { MinaIDContract } from '../build/src/MinaIDContract.js';

// Oracle Public Key from server deployment
const ORACLE_PUBLIC_KEY = 'B62qova14dZ5BZCgD6xDxtxjW6ahbrUL1h9suL69NvDwmZBiXzZZxoT';

async function deployWithOracle() {
  console.log('🚀 Deploying MinaID Contract with Oracle Integration...\n');
  
  // Setup network (Berkeley testnet or local)
  const network = Mina.Network({
    mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
    archive: 'https://archive.berkeley.minaexplorer.com',
  });
  Mina.setActiveInstance(network);
  
  // Load deployer account
  const deployerPrivateKeyBase58 = process.env.DEPLOYER_PRIVATE_KEY;
  if (!deployerPrivateKeyBase58) {
    throw new Error('DEPLOYER_PRIVATE_KEY environment variable not set');
  }
  
  const deployerPrivateKey = PrivateKey.fromBase58(deployerPrivateKeyBase58);
  const deployerPublicKey = deployerPrivateKey.toPublicKey();
  
  console.log('📋 Deployer address:', deployerPublicKey.toBase58());
  
  // Generate contract keypair
  const contractPrivateKey = PrivateKey.random();
  const contractPublicKey = contractPrivateKey.toPublicKey();
  const contractAddress = contractPublicKey.toBase58();
  
  console.log('📝 Contract address:', contractAddress);
  console.log('');
  
  // Compile contract
  console.log('⚙️  Compiling contract...');
  const { verificationKey } = await MinaIDContract.compile();
  console.log('✅ Contract compiled\n');
  
  // Create contract instance
  const contract = new MinaIDContract(contractPublicKey);
  
  // Deploy transaction
  console.log('📤 Creating deployment transaction...');
  const deployTx = await Mina.transaction(
    { sender: deployerPublicKey, fee: 100_000_000 },
    async () => {
      AccountUpdate.fundNewAccount(deployerPublicKey);
      await contract.deploy();
      await contract.init();
    }
  );
  
  await deployTx.prove();
  await deployTx.sign([deployerPrivateKey, contractPrivateKey]).send();
  console.log('✅ Contract deployed\n');
  
  // Set Oracle public key
  console.log('🔑 Setting Oracle public key...');
  const oraclePublicKey = PublicKey.fromBase58(ORACLE_PUBLIC_KEY);
  
  const updateTx = await Mina.transaction(
    { sender: deployerPublicKey, fee: 100_000_000 },
    async () => {
      await contract.updateOracleKey(oraclePublicKey);
    }
  );
  
  await updateTx.prove();
  await updateTx.sign([deployerPrivateKey]).send();
  console.log('✅ Oracle key set\n');
  
  // Summary
  console.log('═'.repeat(60));
  console.log('🎉 Deployment Complete!');
  console.log('═'.repeat(60));
  console.log('');
  console.log('📋 Contract Details:');
  console.log('   Address:', contractAddress);
  console.log('   Oracle:', ORACLE_PUBLIC_KEY);
  console.log('   Network: Berkeley Testnet');
  console.log('');
  console.log('📝 Save these for your frontend .env:');
  console.log('   NEXT_PUBLIC_CONTRACT_ADDRESS=' + contractAddress);
  console.log('   NEXT_PUBLIC_ORACLE_URL=http://localhost:4000');
  console.log('');
  console.log('🔐 Save contract private key (KEEP SECRET):');
  console.log('   CONTRACT_PRIVATE_KEY=' + contractPrivateKey.toBase58());
  console.log('');
  
  return {
    contractAddress,
    contractPrivateKey: contractPrivateKey.toBase58(),
    oraclePublicKey: ORACLE_PUBLIC_KEY,
  };
}

// Run deployment
if (import.meta.url === `file://${process.argv[1]}`) {
  deployWithOracle()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Deployment failed:', error);
      process.exit(1);
    });
}

export { deployWithOracle };
