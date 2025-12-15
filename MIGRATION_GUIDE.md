# Migration Guide: Old to New Proof Generation

## Quick Reference

### Old Way (❌ Don't Use)

```typescript
// OLD - ProofGenerator.ts (on-chain generation)
import { generateAgeProof, generateKYCProof } from './lib/ProofGenerator';

const ageProof = await generateAgeProof(aadharData, 18, privateKey);
const kycProof = await generateKYCProof(aadharData, privateKey, ['citizenship']);
```

### New Way (✅ Use This)

```typescript
// NEW - ZKProofGenerator.ts (off-chain generation)
import {
  generateAgeProofZK,
  generateCitizenshipProofZK,
  generateNameProofZK,
  compileAgeProgram,
  compileCitizenshipProgram
} from './lib/ZKProofGenerator';

// 1. Compile first (one-time)
await compileAgeProgram();

// 2. Generate proof (off-chain)
const ageProof = await generateAgeProofZK(
  25,           // actualAge
  18,           // minimumAge
  privateKey,
  'salt123'
);

// 3. Verify on-chain
const contract = new ContractInterface();
await contract.initialize();
await contract.verifyZKProofOnChain(ageProof, privateKey.toBase58());
```

---

## API Changes

### Age Proofs

```typescript
// OLD ❌
const proof = await generateAgeProof(
  aadharData,    // Entire Aadhar object
  18,            // minimumAge
  privateKey
);

// NEW ✅
await compileAgeProgram();  // One-time compilation
const proof = await generateAgeProofZK(
  25,            // Just the age number
  18,            // minimumAge
  privateKey,
  'salt123'      // Random salt for privacy
);
```

### Citizenship Proofs

```typescript
// OLD ❌
const proof = await generateKYCProof(
  aadharData,
  privateKey,
  ['citizenship']
);

// NEW ✅
await compileCitizenshipProgram();  // One-time compilation
const proof = await generateCitizenshipProofZK(
  "India",       // Just the citizenship country
  privateKey,
  'salt456'
);
```

### Name Proofs

```typescript
// OLD ❌
const { generateSelectiveDisclosureProof } = await import('./lib/ProofGenerator');
const proof = generateSelectiveDisclosureProof(
  name,
  'name',
  privateKey,
  salt
);

// NEW ✅
await compileCitizenshipProgram();  // One-time compilation
const proof = await generateNameProofZK(
  "John Doe",    // Just the name
  privateKey,
  'salt789'
);
```

---

## Component Updates

### React Component Example

```tsx
// Before ❌
import { generateAgeProof } from '../lib/ProofGenerator';

function MyComponent() {
  const handleGenerate = async () => {
    const proof = await generateAgeProof(aadharData, 18, privateKey);
    // ... submit to blockchain
  };
}

// After ✅
import {
  generateAgeProofZK,
  compileAgeProgram
} from '../lib/ZKProofGenerator';
import { ContractInterface } from '../lib/ContractInterface';

function MyComponent() {
  const [isCompiled, setIsCompiled] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleGenerate = async () => {
    // Step 1: Compile (if not done)
    if (!isCompiled) {
      await compileAgeProgram((msg, pct) => {
        console.log(msg, pct);
        setProgress(pct);
      });
      setIsCompiled(true);
    }

    // Step 2: Generate proof OFF-CHAIN
    const proof = await generateAgeProofZK(
      25,
      18,
      privateKey,
      'salt123',
      (msg, pct) => {
        console.log(msg, pct);
        setProgress(pct);
      }
    );

    // Step 3: Verify ON-CHAIN
    const contract = new ContractInterface();
    await contract.initialize();
    const result = await contract.verifyZKProofOnChain(
      proof,
      privateKey.toBase58()
    );

    console.log('Verified on-chain:', result.txHash);
  };
}
```

---

## Key Differences

| Aspect | Old Way | New Way |
|--------|---------|---------|
| **Generation** | On-chain (blockchain) | Off-chain (browser) |
| **Time** | Fast (~5s) | Slow (2-3 min) |
| **Cost** | 0.1 MINA | FREE |
| **Privacy** | Hash-based | TRUE zkSNARK |
| **Security** | Weak (can fake) | Strong (mathematical proof) |
| **Input** | Entire Aadhar object | Just the value (age/name/citizenship) |
| **Compilation** | Not needed | Required (30s, one-time) |
| **Verification** | Simple hash check | zkSNARK verification |

---

## Common Mistakes

### ❌ Mistake 1: Not Compiling

```typescript
// Wrong - will fail!
const proof = await generateAgeProofZK(25, 18, privateKey, 'salt');
```

```typescript
// Correct - compile first
await compileAgeProgram();
const proof = await generateAgeProofZK(25, 18, privateKey, 'salt');
```

---

### ❌ Mistake 2: Using Old Verification

```typescript
// Wrong - old method
await contract.verifyAgeProof(proof, publicKey, minimumAge);
```

```typescript
// Correct - new method
await contract.verifyZKProofOnChain(proof, privateKey.toBase58());
```

---

### ❌ Mistake 3: Passing Entire Aadhar Object

```typescript
// Wrong - don't pass entire object
const proof = await generateCitizenshipProofZK(aadharData, privateKey, salt);
```

```typescript
// Correct - just pass citizenship string
const proof = await generateCitizenshipProofZK("India", privateKey, salt);
```

---

## Deprecation Notice

### ⚠️ Deprecated (Don't Use)

- ❌ `ProofGenerator.ts` → Use `ZKProofGenerator.ts`
- ❌ `SmartProofGenerator.ts` → Use `ZKProofGenerator.ts`
- ❌ `generateAgeProof()` → Use `generateAgeProofZK()`
- ❌ `generateKYCProof()` → Use `generateCitizenshipProofZK()` or `generateNameProofZK()`
- ❌ `generateSelectiveDisclosureProof()` → Use `generateNameProofZK()` or `generateCitizenshipProofZK()`
- ❌ `contract.verifyAgeProof()` → Use `contract.verifyZKProofOnChain()`
- ❌ `contract.verifyKYCProof()` → Use `contract.verifyZKProofOnChain()`

### ✅ Use Instead

- ✅ `ZKProofGenerator.ts` - All new proof generation
- ✅ `generateAgeProofZK()` - Age proofs
- ✅ `generateCitizenshipProofZK()` - Citizenship proofs
- ✅ `generateNameProofZK()` - Name proofs
- ✅ `generateKYCProofZK()` - KYC proofs
- ✅ `contract.verifyZKProofOnChain()` - All proof verification

---

## Step-by-Step Migration

### 1. Update Imports

```typescript
// Remove old imports
// import { generateAgeProof } from './lib/ProofGenerator';

// Add new imports
import {
  generateAgeProofZK,
  compileAgeProgram
} from './lib/ZKProofGenerator';
import { ContractInterface } from './lib/ContractInterface';
```

### 2. Add Compilation

```typescript
// Add compilation state
const [isCompiled, setIsCompiled] = useState(false);

// Add compilation function
const compile = async () => {
  if (!isCompiled) {
    await compileAgeProgram();
    setIsCompiled(true);
  }
};
```

### 3. Update Proof Generation

```typescript
// Before
const proof = await generateAgeProof(aadharData, 18, privateKey);

// After
await compile();  // Ensure compiled
const proof = await generateAgeProofZK(
  calculateAge(aadharData.dateOfBirth),  // Extract age
  18,
  privateKey,
  generateSalt()  // Add salt
);
```

### 4. Update Verification

```typescript
// Before
await someSubmissionFunction(proof);

// After
const contract = new ContractInterface();
await contract.initialize();
await contract.verifyZKProofOnChain(proof, privateKey.toBase58());
```

---

## Testing Checklist

- [ ] Compilation works (30s, one-time)
- [ ] Age proof generates (2-3 min)
- [ ] Citizenship proof generates (2-3 min)
- [ ] Name proof generates (2-3 min)
- [ ] On-chain verification succeeds (~5s)
- [ ] Transaction appears on Minascan
- [ ] Progress callbacks work correctly
- [ ] Error handling works
- [ ] Salt is random and unique
- [ ] Private data never exposed

---

## Support

If you encounter issues:

1. Check compilation is complete
2. Verify salt is at least 4 characters
3. Ensure private key is valid
4. Check contract is initialized
5. Verify wallet has sufficient balance
6. Check browser console for errors

---

**Status**: Migration guide complete  
**Last Updated**: December 11, 2025
