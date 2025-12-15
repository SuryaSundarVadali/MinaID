# 🚀 Quick Start: Zero-Knowledge Proof Generation (All Types)

## TL;DR

Generate TRUE zero-knowledge proofs for:
- **Age**: Prove age >= 18/21 WITHOUT revealing actual age
- **Citizenship**: Prove citizenship WITHOUT revealing it directly  
- **Name**: Prove name matches WITHOUT revealing it
- **KYC**: Prove identity verified WITHOUT revealing PII

## Prerequisites

- Modern browser (Chrome, Firefox, Edge, Brave)
- 4GB+ RAM recommended
- ~3-4 minutes for first-time proof generation

## Step-by-Step Guide

### Step 1: Open Browser Console

1. Navigate to your MinaID app
2. Press `F12` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Click the "Console" tab

### Step 2: Import Modules

```javascript
// Import ALL ZK proof generators
const { 
  generateAgeProofZK, 
  generateCitizenshipProofZK,
  generateNameProofZK,
  generateKYCProofZK,
  compileAgeProgram,
  compileCitizenshipProgram,
  verifyProofLocally 
} = await import('./lib/ZKProofGenerator.js');

// Import o1js for key generation
const { PrivateKey } = await import('o1js');

console.log('✅ Modules loaded');
```

### Step 3: Compile ZK Circuits (One-Time, ~30 seconds)

```javascript
console.log('⏳ Compiling zero-knowledge circuits...');
console.log('This will take about 30 seconds...');

await compileAgeProgram((message, percent) => {
  console.log(`${percent}% - ${message}`);
});

console.log('✅ Compilation complete!');
```

**Expected Output:**
```
10% - Compiling zero-knowledge circuits...
100% - Circuit compilation complete
✅ Compilation complete!
Verification key hash: fe4b8c92a1d3e5...
```

### Step 4: Generate Your Proof (~2-3 minutes)

```javascript
// Your private information
const actualAge = 25;              // Your REAL age (never revealed!)
const minimumAge = 18;             // What you want to prove (age >= 18)
const salt = 'random123xyz';       // Random string for privacy

// Generate or use existing private key
const privateKey = PrivateKey.random();  // Or: PrivateKey.fromBase58('your-key')

console.log('⏳ Generating zero-knowledge proof...');
console.log('This proves age >= ' + minimumAge + ' without revealing ' + actualAge);
console.log('Please wait 2-3 minutes...');

const zkProof = await generateAgeProofZK(
  actualAge,
  minimumAge,
  privateKey,
  salt,
  (message, percent) => {
    console.log(`${percent}% - ${message}`);
  }
);

console.log('✅ Proof generated successfully!');
console.log('Proof ID:', zkProof.metadata.proofId);
console.log('Generation time:', zkProof.metadata.generationTime + 'ms');
```

**Expected Output:**
```
20% - Creating cryptographic inputs...
30% - Generating zero-knowledge proof (this may take 2-3 minutes)...
⏳ Proving (this will take time)...
90% - Proof generated successfully!
95% - Finalizing...
100% - Ready for verification!
✅ Proof generated in 147.2s
Proof ID: zkp-1702345678901-a3f9d2c
Generation time: 147234ms
```

### Step 5: Verify Locally (Optional, <1 second)

```javascript
console.log('🔍 Verifying proof locally...');

const isValid = await verifyProofLocally(zkProof);

console.log('Local verification:', isValid ? '✅ VALID' : '❌ INVALID');
```

### Step 6: Submit to Blockchain (~10 seconds)

```javascript
// Import contract interface
const { ContractInterface } = await import('./lib/ContractInterface.js');

// Initialize contract
console.log('🔗 Connecting to blockchain...');
const contract = new ContractInterface();
await contract.initialize();

// Verify on-chain
console.log('📤 Submitting proof to blockchain...');
console.log('This will take about 10 seconds...');

const result = await contract.verifyZKProofOnChain(
  zkProof,
  privateKey.toBase58()  // Or null to use Auro Wallet
);

if (result.success) {
  console.log('✅ Proof verified on-chain!');
  console.log('Transaction hash:', result.hash);
  console.log('Explorer URL:', result.explorerUrl);
} else {
  console.log('❌ Verification failed:', result.error);
}
```

---

## Additional Proof Types

### Citizenship Proof

```javascript
// Step 1: Compile citizenship circuits
await compileCitizenshipProgram((msg, pct) => console.log(`${pct}% ${msg}`));

// Step 2: Generate citizenship proof
const actualCitizenship = "India";      // Your REAL citizenship (private!)
const expectedCitizenship = "India";    // What to prove
const salt = 'salt' + Date.now();
const privateKey = PrivateKey.random();

const citizenshipProof = await generateCitizenshipProofZK(
  actualCitizenship,
  expectedCitizenship,
  privateKey,
  salt,
  (msg, pct) => console.log(`${pct}% ${msg}`)
);

// Step 3: Verify on-chain
const contract = new ContractInterface();
await contract.initialize();
const result = await contract.verifyZKProofOnChain(citizenshipProof, privateKey.toBase58());
console.log('✅ Citizenship verified!', result);
```

### Name Proof

```javascript
// Step 1: Compile (uses same circuits as citizenship)
await compileCitizenshipProgram((msg, pct) => console.log(`${pct}% ${msg}`));

// Step 2: Generate name proof
const actualName = "John Doe";          // Your REAL name (private!)
const expectedName = "John Doe";        // What to prove
const salt = 'salt' + Date.now();
const privateKey = PrivateKey.random();

const nameProof = await generateNameProofZK(
  actualName,
  expectedName,
  privateKey,
  salt,
  (msg, pct) => console.log(`${pct}% ${msg}`)
);

// Step 3: Verify on-chain
const contract = new ContractInterface();
await contract.initialize();
const result = await contract.verifyZKProofOnChain(nameProof, privateKey.toBase58());
console.log('✅ Name verified!', result);
```

### KYC Proof

```javascript
// Step 1: Compile age circuits (KYC uses same)
await compileAgeProgram((msg, pct) => console.log(`${pct}% ${msg}`));

// Step 2: Generate KYC proof
const kycData = {
  uid: "123456789012",
  name: "John Doe",
  dateOfBirth: "1990-01-01"
};
const salt = 'salt' + Date.now();
const privateKey = PrivateKey.random();

const kycProof = await generateKYCProofZK(
  kycData,
  privateKey,
  salt,
  (msg, pct) => console.log(`${pct}% ${msg}`)
);

// Step 3: Verify on-chain
const contract = new ContractInterface();
await contract.initialize();
const result = await contract.verifyZKProofOnChain(kycProof, privateKey.toBase58());
console.log('✅ KYC verified!', result);
```

**Expected Output:**
```
🔗 Connecting to blockchain...
[ContractInterface] Using Devnet
[ContractInterface] DIDRegistry: B62qr6Cbas...
[ContractInterface] ZKPVerifier: B62qjikgRy...
✅ Contracts initialized

📤 Submitting proof to blockchain...
[ContractInterface] *** verifyZKProofOnChain - TRUE zkSNARK VERIFICATION ***
[ContractInterface] Reconstructing proof from JSON...
✅ Proof reconstructed
[ContractInterface] Proving transaction locally...
✅ Transaction proved
[ContractInterface] ✅ Transaction submitted: 5JxA9K...

✅ Proof verified on-chain!
Transaction hash: 5JxA9K2m3p4N...
Explorer URL: https://minascan.io/devnet/tx/5JxA9K2m3p4N...
```

## Complete Script (Copy-Paste)

```javascript
// ==========================================
// COMPLETE ZK PROOF GENERATION SCRIPT
// ==========================================

(async () => {
  try {
    console.log('🚀 Starting Zero-Knowledge Proof Generation\n');
    
    // Step 1: Import modules
    console.log('📦 Step 1: Importing modules...');
    const { generateAgeProofZK, compileAgeProgram, verifyProofLocally } = await import('./lib/ZKProofGenerator.js');
    const { PrivateKey } = await import('o1js');
    const { ContractInterface } = await import('./lib/ContractInterface.js');
    console.log('✅ Modules loaded\n');
    
    // Step 2: Compile circuits
    console.log('⚙️ Step 2: Compiling ZK circuits (~30s)...');
    await compileAgeProgram((msg, pct) => console.log(`  ${pct}% - ${msg}`));
    console.log('✅ Compilation complete\n');
    
    // Step 3: Configure your proof
    const actualAge = 25;           // YOUR REAL AGE (never revealed!)
    const minimumAge = 18;          // What to prove (age >= 18 or 21)
    const salt = 'random' + Date.now();  // Random salt
    const privateKey = PrivateKey.random();
    
    console.log('🔒 Step 3: Generating proof...');
    console.log(`  Proving: age >= ${minimumAge}`);
    console.log(`  Actual age: ${actualAge} (WILL NOT BE REVEALED)`);
    console.log('  ⏳ This takes 2-3 minutes, please wait...\n');
    
    // Step 4: Generate proof
    const zkProof = await generateAgeProofZK(
      actualAge,
      minimumAge,
      privateKey,
      salt,
      (msg, pct) => console.log(`  ${pct}% - ${msg}`)
    );
    console.log(`✅ Proof generated in ${(zkProof.metadata.generationTime / 1000).toFixed(1)}s\n`);
    
    // Step 5: Verify locally
    console.log('🔍 Step 4: Verifying locally...');
    const isValid = await verifyProofLocally(zkProof);
    console.log(`  ${isValid ? '✅ VALID' : '❌ INVALID'}\n`);
    
    // Step 6: Submit to blockchain
    console.log('📤 Step 5: Submitting to blockchain...');
    const contract = new ContractInterface();
    await contract.initialize();
    
    const result = await contract.verifyZKProofOnChain(zkProof, privateKey.toBase58());
    
    if (result.success) {
      console.log('\n🎉 SUCCESS! Proof verified on-chain!');
      console.log('📋 Transaction:', result.hash);
      console.log('🔗 Explorer:', result.explorerUrl);
    } else {
      console.log('\n❌ Verification failed:', result.error);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
})();
```

## Troubleshooting

### "Module not found" error
```javascript
// Try with full path
const { generateAgeProofZK } = await import('/app/lib/ZKProofGenerator.js');
```

### "Out of memory" error
- Close other browser tabs
- Proof generation needs ~2-4GB RAM
- Try on desktop instead of mobile

### "Compilation failed" error
- Ensure browser supports WebAssembly
- Clear browser cache: `localStorage.clear(); location.reload()`
- Check console for detailed error

### "Proof verification failed" error
- Ensure actualAge >= minimumAge
- Check that proof hasn't expired
- Try local verification first to debug

## What's Happening Behind the Scenes?

1. **Compilation** (30s)
   - Loads proving & verification keys
   - Prepares ZK circuits
   - Cached for subsequent proofs

2. **Proof Generation** (2-3 min)
   - Creates cryptographic commitment to your age
   - Generates mathematical proof that age >= minimum
   - **Your actual age is NEVER revealed!**
   - Uses pairing-based cryptography

3. **Local Verification** (<1s)
   - Tests proof validity
   - Catches errors before blockchain submission
   - Free, instant

4. **Blockchain Verification** (~10s)
   - Smart contract verifies proof cryptographically
   - Emits verification event
   - Costs 0.1 MINA (~$0.05)

## Why So Slow?

### Proof Generation (2-3 min)
- zkSNARK proofs are **computationally expensive** by design
- This ensures security (can't fake proofs!)
- Done **once** on your device, not on blockchain
- Much faster than Ethereum (minutes vs hours)

### Blockchain Verification (10s)
- Fast! Contract only verifies cryptographic signature
- No heavy computation on-chain
- Cheaper than recomputing everything

## Privacy Guarantees

### What's Revealed
- ✅ Your public key (DID)
- ✅ Minimum age requirement (18 or 21)
- ✅ Proof was generated at timestamp X
- ✅ Proof is valid (math-proven)

### What's NEVER Revealed
- ❌ Your actual age (25, 30, 45, etc.)
- ❌ Your date of birth
- ❌ Salt used in proof
- ❌ Any private inputs

### How It Works
```
Your Age: 25 (private)
Minimum: 18 (public)

zkSNARK Proof:
"I mathematically prove that 25 >= 18 
 without telling you what 25 is!"

Blockchain Verification:
✅ Math checks out - proof valid!
❌ Still don't know actual age
```

## Use Cases

1. **Age Verification**
   - Prove you're 18+ for services
   - Prove you're 21+ for alcohol/gambling
   - No need to share ID or DOB

2. **Age-Gated Content**
   - Access adult content anonymously
   - Meet age requirements without revealing age
   - Reusable proof for multiple services

3. **Identity Verification**
   - KYC without revealing PII
   - Prove citizenship without showing passport
   - Prove employment without sharing salary

## Next Steps

- [ ] Generate your first proof (use the Complete Script above)
- [ ] Experiment with different ages (18, 21, 25, etc.)
- [ ] Try with Auro Wallet (set privateKey param to `null`)
- [ ] View transaction on [Minascan](https://minascan.io/devnet)
- [ ] Build an app that accepts ZK proofs!

## Need Help?

- **Documentation:** [ZK_ARCHITECTURE.md](./ZK_ARCHITECTURE.md)
- **Implementation:** [ZK_IMPLEMENTATION_SUMMARY.md](./ZK_IMPLEMENTATION_SUMMARY.md)
- **Code:** `/ui/lib/ZKProofGenerator.ts`
- **Contract:** `/contracts/src/ZKPVerifierV2.ts`

---

**Happy Proving! 🎉**

*Remember: Your age is mathematically proven, never revealed. That's the beauty of zero-knowledge proofs!*
