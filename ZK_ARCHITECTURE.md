# Zero-Knowledge Proof Architecture - Off-Chain Generation, On-Chain Verification

## Overview

This document describes the **TRUE zero-knowledge proof architecture** for MinaID. Proofs are generated **entirely off-chain** (client-side) and only **verified on-chain** (smart contract).

## Architecture Comparison

### ❌ OLD: Commitment-Based (Not True ZK)

```
Client Side:
1. Create commitment = Hash(ageHash, minAge, subject, issuer, timestamp)
2. Sign commitment with private key
3. Send commitment to blockchain

Blockchain:
1. Recompute commitment
2. Compare with submitted commitment
3. Emit event if match

Problem: Not a true zero-knowledge proof - just a signed commitment
```

### ✅ NEW: True zkSNARK Proofs

```
Client Side (OFF-CHAIN):
1. User provides private data (actualAge = 25, salt = "random123")
2. AgeVerificationProgram generates zkSNARK proof (2-3 minutes)
   - Proves: actualAge >= minimumAge (18)
   - WITHOUT revealing actualAge!
3. Client gets proof + public inputs
4. Send proof to blockchain

Blockchain (ON-CHAIN):
1. Verify zkSNARK proof cryptographically (fast!)
2. No recomputation needed - crypto math verifies
3. Emit verification event

Benefits: 
- TRUE zero-knowledge (age never revealed, even in computation)
- Cryptographically secure (can't fake proofs)
- Verifiable by anyone with verification key
```

## File Structure

### New Files

1. **`ui/lib/ZKProofGenerator.ts`** - OFF-CHAIN proof generation
   - `compileAgeProgram()` - Compile ZK circuits (one-time, 30s)
   - `generateAgeProofZK()` - Generate actual zkSNARK proof (2-3 min)
   - `verifyProofLocally()` - Test proof before submitting
   
2. **`contracts/src/ZKPVerifierV2.ts`** - ON-CHAIN verification
   - `verifyAgeProofZK()` - Verify zkSNARK proof (NEW, secure)
   - `verifyAgeProofCommitment()` - Legacy commitment-based (backward compat)
   - `verifyKYCProof()` - KYC verification (commitment-based for now)

### Modified Files

1. **`ui/lib/SmartProofGenerator.ts`** (LEGACY)
   - Kept for backward compatibility
   - Generates commitment-based proofs (not true ZK)
   - Will be deprecated once zkSNARK flow is stable

2. **`ui/lib/ContractInterface.ts`**
   - Keep existing `verifyProofOnChain()` for legacy proofs
   - Add new `verifyZKProofOnChain()` for zkSNARK proofs

## Usage Guide

### For Users (Browser Console)

```javascript
// Step 1: Compile ZK Program (one-time, ~30 seconds)
const { ZKProofGenerator } = await import('./lib/ZKProofGenerator');
await ZKProofGenerator.compileAgeProgram((msg, pct) => console.log(msg, pct + '%'));

// Step 2: Generate Proof (2-3 minutes)
const { PrivateKey } = await import('o1js');
const privateKey = PrivateKey.random();
const actualAge = 25;        // Your real age (NEVER revealed!)
const minimumAge = 18;       // Requirement to prove
const salt = "random123";    // Random string for privacy

const zkProof = await ZKProofGenerator.generateAgeProofZK(
  actualAge,
  minimumAge,
  privateKey,
  salt,
  (msg, pct) => console.log(msg, pct + '%')
);

// Step 3: Verify Locally (optional, instant)
const isValid = await ZKProofGenerator.verifyProofLocally(zkProof);
console.log('Proof valid:', isValid);

// Step 4: Submit to Blockchain
const { ContractInterface } = await import('./lib/ContractInterface');
const contract = new ContractInterface();
await contract.initialize();

const result = await contract.verifyZKProofOnChain(zkProof, privateKey.toBase58());
console.log('Blockchain verification:', result);
```

### For Developers

#### Generate ZK Proof

```typescript
import { generateAgeProofZK, compileAgeProgram } from './lib/ZKProofGenerator';
import { PrivateKey } from 'o1js';

// Compile (one-time per session)
await compileAgeProgram();

// Generate proof
const privateKey = PrivateKey.fromBase58('...');
const zkProofData = await generateAgeProofZK(
  25,         // actualAge (private)
  18,         // minimumAge (public)
  privateKey,
  'salt123',  // random salt (private)
  onProgress  // optional callback
);

// zkProofData contains:
// - proof: JsonProof (actual zkSNARK)
// - publicInput: { subjectPublicKey, minimumAge, ageHash, issuerPublicKey, timestamp }
// - publicOutput: commitment
// - metadata: { verificationKeyHash, generationTime, ... }
```

#### Verify On-Chain

```typescript
import { ContractInterface } from './lib/ContractInterface';

const contract = new ContractInterface();
await contract.initialize();

// Option 1: Use private key
const result = await contract.verifyZKProofOnChain(zkProofData, privateKeyBase58);

// Option 2: Use Auro Wallet
const result = await contract.verifyZKProofOnChain(zkProofData, null);
```

## Technical Details

### ZK Circuit (AgeVerificationProgram)

**Public Inputs:**
- `subjectPublicKey`: User's public key
- `minimumAge`: Age requirement (e.g., 18)
- `ageHash`: Poseidon.hash([actualAge, salt])
- `issuerPublicKey`: Issuer's public key
- `timestamp`: Proof creation time

**Private Inputs:**
- `actualAge`: Real age (NEVER revealed!)
- `salt`: Random value for privacy

**Proof Logic:**
```
1. Verify: Hash(actualAge, salt) == ageHash
2. Verify: actualAge >= minimumAge
3. Verify: 0 <= actualAge <= 120 (sanity check)
4. Output: commitment = Hash(ageHash, minimumAge, subject, issuer, timestamp)
```

**Result:** Cryptographic proof that actualAge >= minimumAge WITHOUT revealing actualAge!

### Smart Contract Verification

**Old Method (verifyAgeProof):**
```solidity
// Just checks commitment match - not secure!
expectedCommitment = Hash(ageHash, minAge, subject, issuer, timestamp)
proof.assertEquals(expectedCommitment)
```

**New Method (verifyAgeProofZK):**
```solidity
// Cryptographically verifies zkSNARK proof
proof.verify()  // Uses pairing-based cryptography!
// If this passes, we KNOW age >= minimumAge mathematically
```

## Performance

### Off-Chain (Client Browser)

| Operation | Time | Notes |
|-----------|------|-------|
| Compile circuits | ~30s | One-time per session |
| Generate proof | 2-3 min | Uses cached proving keys |
| Local verification | <1s | Optional sanity check |

### On-Chain (Blockchain)

| Operation | Time | Gas Cost |
|-----------|------|----------|
| Verify zkSNARK | ~5s | ~0.1 MINA |
| Emit event | <1s | Included |

## Migration Path

### Phase 1: Parallel Support (CURRENT)
- Keep `SmartProofGenerator.ts` (legacy commitment-based)
- Add `ZKProofGenerator.ts` (new zkSNARK-based)
- Both methods work on existing contracts
- Users can choose which method to use

### Phase 2: Gradual Transition
- Update UI to prefer zkSNARK proofs
- Show educational popups explaining benefits
- Keep legacy method for backward compatibility

### Phase 3: Full Migration
- Deprecate commitment-based proofs
- Remove `SmartProofGenerator.ts`
- Update all documentation
- Deploy new contract version (ZKPVerifierV2)

## Security Benefits

### Commitment-Based (Old)
- ❌ Relies on hash function security only
- ❌ No mathematical proof of age
- ❌ Vulnerable to hash collisions (theoretical)
- ⚠️ Must trust client didn't lie about age

### zkSNARK-Based (New)
- ✅ Cryptographically proven (pairing-based crypto)
- ✅ Mathematical guarantee age >= minimum
- ✅ Can't fake proofs (would need to break elliptic curves)
- ✅ Verifiable by anyone with verification key
- ✅ Zero-knowledge: age never revealed

## Troubleshooting

### "Proof generation taking too long"
- Normal! zkSNARK proofs take 2-3 minutes
- Compilation takes ~30s first time
- Use progress callbacks to show status
- Consider showing educational content during wait

### "Out of memory during proof generation"
- zkSNARK proving is memory-intensive
- Ensure browser has enough RAM (recommend 4GB+)
- Close other tabs during proof generation
- Consider showing memory warning

### "Verification failed on-chain"
- Ensure proof was generated with correct parameters
- Check minimumAge matches contract requirement
- Verify timestamp hasn't expired
- Try local verification first to debug

### "Compilation failed"
- Check browser supports WebAssembly
- Ensure IndexedDB is not full
- Clear browser cache and retry
- Check console for detailed error

## Future Enhancements

1. **Recursive Proofs**: Chain multiple age proofs together
2. **Batch Verification**: Verify multiple proofs at once
3. **KYC zkSNARKs**: Extend to KYC proofs (not just commitments)
4. **Mobile Support**: Optimize for mobile browsers
5. **Proof Marketplace**: Buy/sell verified proofs (privacy-preserving)

## References

- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)
- [ZkProgram API](https://docs.minaprotocol.com/zkapps/o1js/recursion)
- [Mina Protocol](https://minaprotocol.com/)
- [zkSNARK Basics](https://z.cash/technology/zksnarks/)
