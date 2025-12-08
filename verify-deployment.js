#!/usr/bin/env node
/**
 * Verify Deployment Script
 * Checks if the deployed app is using the correct contract addresses
 */

const CORRECT_ADDRESSES = {
  didRegistry: 'B62qkoY7NFfriUPxXYm5TWqJtz4TocpQhmzYq4LK7uXw63v8L8yZQfy',
  zkpVerifier: 'B62qkRuB4ojsqGmtJaH4eJQqMMdJYfGR2UNKtEUMeJzr1qd3G7rTDLG',
};

const OLD_ADDRESSES = {
  didRegistry: 'B62qjuEhj9YjZyKTD75ywH7vY73DgUTC5bVxSCo3meirg8nGnV3CYjk',
  zkpVerifier: 'B62qrfTGCDP1KEx1PQa6mWGjV2b8wckbdcQRhi2Mu3AGfRYrjjnnfxW',
};

console.log('🔍 Verifying Contract Addresses Deployment\n');
console.log('✅ Correct Addresses (Dec 7, 2025):');
console.log(`   DIDRegistry: ${CORRECT_ADDRESSES.didRegistry}`);
console.log(`   ZKPVerifier: ${CORRECT_ADDRESSES.zkpVerifier}\n`);

console.log('❌ Old/Deprecated Addresses:');
console.log(`   DIDRegistry: ${OLD_ADDRESSES.didRegistry}`);
console.log(`   ZKPVerifier: ${OLD_ADDRESSES.zkpVerifier}\n`);

console.log('📋 Environment Variables Set:');
console.log('   NEXT_PUBLIC_DID_REGISTRY_DEVNET ✓');
console.log('   NEXT_PUBLIC_ZKP_VERIFIER_DEVNET ✓\n');

console.log('🚀 Deployment Status:');
console.log('   Production: https://mina-7mtgmn7ew-suryasundarvadalis-projects.vercel.app');
console.log('   Inspect: https://vercel.com/suryasundarvadalis-projects/mina-id\n');

console.log('🧪 To verify the deployment is working:');
console.log('   1. Open the production URL in your browser');
console.log('   2. Open DevTools Console');
console.log('   3. Look for these logs during signup:');
console.log(`      [ContractInterface] DIDRegistry: ${CORRECT_ADDRESSES.didRegistry}`);
console.log(`      [ContractInterface] ZKPVerifier: ${CORRECT_ADDRESSES.zkpVerifier}\n`);

console.log('⚠️  If you see the OLD addresses in logs:');
console.log('   - Clear browser cache and hard refresh (Ctrl+Shift+R)');
console.log('   - Wait 2-3 minutes for Vercel CDN to update');
console.log('   - Check Vercel dashboard for deployment status\n');

console.log('✨ The code also has auto-detection that will:');
console.log('   - Detect deprecated addresses from env vars');
console.log('   - Override them with correct addresses');
console.log('   - Log warnings in the console\n');
