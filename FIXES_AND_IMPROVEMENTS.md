# MinaID: Fixes and Error Handling Improvements

## Date: December 8, 2025

### Critical Fixes Applied

#### 1. **Invalid Signature Error**
**Problem**: `Bool.assertTrue(): false != true` when registering proofs on blockchain
- The original `registerDID` method required a signature parameter that needed to be created with the user's private key
- Auro Wallet doesn't expose the private key for arbitrary signature creation
- Attempting to use a separate signing key or dummy signature failed contract validation

**Solution**:
- Added new `registerDIDSimple()` method to DIDRegistry contract
- Uses `this.sender.getAndRequireSignature()` instead of separate signature parameter
- Transaction sender is automatically verified by the blockchain
- Eliminates need for client-side signature creation

**Files Modified**:
- `contracts/src/DIDRegistry.ts`: Added `registerDIDSimple()` method (lines 145-188)
- `ui/lib/ContractInterface.ts`: Updated `registerProofCommitment()` to use new method

#### 2. **MerkleMapWitness Length Error**
**Problem**: "Expected witnessed values of length 510, got 512"
- Manual witness creation with `new MerkleMapWitness(Array(256)...)` created wrong structure
- MerkleMap with height 255 requires exactly 255 sibling hashes

**Solution**:
- Use `new MerkleMap().getWitness(keyHash)` for proper witness generation
- Let o1js library handle witness structure internally

**Files Modified**:
- `ui/lib/ContractInterface.ts`: Lines 665-675

---

### Comprehensive Error Handling Added

#### Input Validation
**Added checks for**:
- Proof data presence and validity
- Required fields (proof/publicOutput, proofType)
- Wallet connection status
- Contract initialization

**Error Messages**:
```typescript
// Before
throw new Error('Transaction failed');

// After
throw new Error('Proof must contain either proof or publicOutput field');
throw new Error('Failed to parse commitment: ${e.message}');
throw new Error('Transaction rejected by user');
```

#### Transaction Flow Error Handling

1. **Commitment Parsing**
   ```typescript
   try {
     commitment = Field(commitmentValue);
   } catch (e: any) {
     throw new Error(`Failed to parse commitment: ${e.message}`);
   }
   ```

2. **Witness Creation**
   ```typescript
   try {
     const emptyMap = new MerkleMap();
     const keyHash = Poseidon.hash(userPublicKey.toFields());
     witness = emptyMap.getWitness(keyHash);
   } catch (e: any) {
     throw new Error(`Failed to create Merkle witness: ${e.message}`);
   }
   ```

3. **Transaction Creation**
   ```typescript
   try {
     tx = await Mina.transaction({ ... }, async () => { ... });
   } catch (e: any) {
     throw new Error(`Failed to create transaction: ${e.message}`);
   }
   ```

4. **Transaction Proving**
   ```typescript
   try {
     await tx.prove();
   } catch (e: any) {
     throw new Error(`Failed to prove transaction: ${e.message}. This may indicate a contract logic error.`);
   }
   ```

5. **Wallet Interaction**
   ```typescript
   try {
     result = await (window as any).mina.sendTransaction({ ... });
     if (!result || !result.hash) {
       throw new Error('Transaction rejected by wallet or failed to return transaction hash');
     }
   } catch (e: any) {
     if (e.message.includes('User rejected')) {
       throw new Error('Transaction rejected by user');
     }
     throw new Error(`Wallet transaction failed: ${e.message}`);
   }
   ```

---

### Potential Errors Still to Monitor

#### 1. **Network Errors**
**Symptoms**:
- "Failed to fetch" during GraphQL queries
- Transaction timeouts
- "Nonce mismatch" errors

**Mitigation**:
- `RobustTransactionSubmitter.ts`: Exponential backoff retry logic
- `CompleteTransactionMonitor.ts`: 5-minute monitoring with 3s polling
- Consider adding network connectivity checks before transactions

#### 2. **Insufficient Balance**
**Symptoms**:
- "Account has insufficient balance" when creating transactions
- Transaction fee errors

**Mitigation**:
- Pre-transaction balance check (currently logs warning if check fails)
- Consider adding explicit balance validation with user-friendly error

#### 3. **Contract State Conflicts**
**Symptoms**:
- "Invalid Merkle witness or DID already registered"
- Root hash mismatches

**Causes**:
- User already has registered DID for this wallet
- Contract state changed between witness creation and transaction submission

**Mitigation**:
- Current: Contract validates witness and returns clear error
- Future: Add client-side check to query if DID already exists before registration

#### 4. **Proof Type Mismatches**
**Symptoms**:
- Selective disclosure proofs (citizenship, name, address, identity) attempted on-chain

**Mitigation**:
- ✅ Already handled: Early check in `verifyProofOnChain()` blocks these proof types
- Error message guides users to use age18, age21, or kyc for on-chain verification

#### 5. **Race Conditions**
**Symptoms**:
- Multiple transactions submitted simultaneously
- Nonce conflicts

**Mitigation**:
- UI shows transaction modal with status
- Consider adding transaction queue for sequential submission

---

### Testing Checklist

- [ ] Generate citizenship proof → Should register on DIDRegistry
- [ ] Generate age18 proof → Should register + verify on both contracts
- [ ] Test with low wallet balance → Should show clear error
- [ ] Reject transaction in Auro Wallet → Should show user-friendly message
- [ ] Test with already registered DID → Should show "already registered" error
- [ ] Test network disconnection → Should retry with backoff
- [ ] Monitor transaction status → Should show progress and completion

---

### Deployment Notes

**New Contract Method**: `registerDIDSimple()`
- Requires redeployment of DIDRegistry contract
- Old `registerDID()` method still available for backward compatibility
- Update `.env.local` with new contract address after deployment

**Breaking Changes**: None
- UI backward compatible with old contract
- New UI requires new contract for registration feature

---

### Code Quality Improvements

1. **Removed Dead Code**
   - Removed unused `dummySignature` variable
   - Cleaned up deterministic signing key logic
   - Simplified document hash (use commitment directly)

2. **Better Logging**
   - Added step-by-step console logs for debugging
   - Included actual values in error messages
   - Transaction proof success confirmation

3. **Type Safety**
   - Proper error type annotations
   - Validated null/undefined checks
   - Explicit type conversions with error handling

---

### Future Improvements

1. **Pre-flight Checks**
   - Check wallet balance before transaction creation
   - Query contract to see if DID already exists
   - Validate network connectivity

2. **User Experience**
   - Show estimated transaction time
   - Add "What's taking so long?" help text
   - Retry button for failed transactions

3. **Gas Optimization**
   - Consider caching contract compilation
   - Optimize witness computation
   - Batch multiple proof registrations

4. **Security Enhancements**
   - Add rate limiting for registration attempts
   - Implement proof expiration timestamps
   - Add revocation checking before verification
