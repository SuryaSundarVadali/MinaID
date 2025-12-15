# Contract Deployment & Address Update Guide

## Fresh Deployment (When "DID Already Registered" Occurs)

The "Invalid Merkle witness or DID already registered" error happens because the contract's Merkle tree already has DIDs registered. The `registerDIDSimple()` method only works with empty contracts.

### Solution: Deploy Fresh Contracts

```bash
# 1. Deploy new contracts (this will take 5-10 minutes)
cd contracts
npm run deploy

# Wait for output showing both addresses:
#   DIDRegistry: B62q...
#   ZKPVerifier: B62q...

# 2. Update all files with new addresses
cd ..
./update-contract-addresses.sh B62q<DID_REGISTRY> B62q<ZKP_VERIFIER>

# 3. Restart dev server
cd ui
npm run dev
```

### Quick Recovery (After Deployment)

```bash
# In browser console (F12):

# Step 1: Complete cleanup
await window.DevCleanup.clearAllStorage()

# Step 2: Hard refresh
# Press Ctrl+Shift+R

# Step 3: Check if ready
await window.DevCleanup.checkRegistrationEligibility()
# Should show: "Can register: ✅ YES"

# Step 4: Generate test proof normally
# It will work now!
```

## Alternative: Use Fresh Test Keys (Faster)

Instead of deploying, generate unique keys for each test:

```javascript
// In browser console:
const key = window.DevCleanup.generateTestKey()
// Save the private key!

// Use key.publicKey when generating proofs
// Each test uses a different DID = no collisions
```

## Deployment Status

**Current Addresses (Update after deployment):**

```
DIDRegistry: B62qkWxdTXKdiEbBRvhvdNEQSFpC5AqEd2K1BD6FYZ3EpqUDo3xToPs (deploying...)
ZKPVerifier: [Waiting for deployment...]
```

**Deployed:** [DATE]  
**Network:** Devnet  
**Status:** 🔄 In Progress

## Troubleshooting

### "Deployment taking too long"

Contract compilation is slow (5-10 minutes per contract). Check:

```bash
tail -f contracts/deploy-output.log
```

### "Still get 'already registered' after deploy"

1. Check addresses updated:
   ```bash
   grep "didRegistryAddress" ui/lib/ContractInterface.ts
   ```

2. Clear browser completely:
   ```javascript
   await window.DevCleanup.clearAllStorage()
   // Then hard refresh: Ctrl+Shift+R
   ```

3. Verify contract is empty:
   ```javascript
   await window.DevCleanup.checkRegistrationEligibility()
   ```

### "Want to reuse same DID"

You need the private key to revoke first:

```javascript
await window.DevCleanup.revokeDID("EKE...privateKeyBase58")
// Then you can re-register
```

## Files Updated by Script

- `ui/.env.local` - Environment variables
- `ui/lib/ContractInterface.ts` - DEFAULT_CONFIG constants
- `contracts/config.json` - Deployment metadata

## Manual Update (if script fails)

Edit `ui/lib/ContractInterface.ts`:

```typescript
export const DEFAULT_CONFIG: NetworkConfig = {
  // ...
  didRegistryAddress: 'B62q...<NEW_ADDRESS>',
  zkpVerifierAddress: 'B62q...<NEW_ADDRESS>',
};
```

Edit `ui/.env.local`:

```bash
NEXT_PUBLIC_DID_REGISTRY_DEVNET=B62q...<NEW_ADDRESS>
NEXT_PUBLIC_ZKP_VERIFIER_DEVNET=B62q...<NEW_ADDRESS>
```

## DevCleanup API Reference

Available in browser console as `window.DevCleanup`:

| Command | Description |
|---------|-------------|
| `clearAllStorage()` | Nuclear option: clear all storage |
| `generateTestKey()` | Create fresh random keypair |
| `revokeDID(privateKey)` | Revoke on-chain DID |
| `checkRegistrationEligibility()` | Check if contract is empty |
| `completeReset()` | Clear all + generate new key |
| `help()` | Show all commands |

## Best Practices for Testing

1. **Use fresh keys per test** - Fastest, no cleanup needed
2. **Deploy fresh contract weekly** - When testing registration flows
3. **Clear storage between sessions** - Prevents cache issues
4. **Save private keys** - If you need to revoke/update DIDs

## Expected Logs After Fix

```
[ContractInterface] 🔍 Pre-check: Verifying contract state...
[ContractInterface] Contract eligibility check:
[ContractInterface]   Can register: true
[ContractInterface]   Is empty root: true
[MerkleStateManager] ✅ Generated witness from empty map
[ContractInterface] ✅ Transaction proved successfully
[ContractInterface] ✅ Registration successful!
```

No more "Invalid Merkle witness" errors! 🎉
