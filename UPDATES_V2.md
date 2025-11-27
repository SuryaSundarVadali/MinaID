# MinaID v2.0 - Mandatory Passkey & Testing Suite

## 🚀 Major Updates

### 1. Mandatory Passkey Authentication
**Every account MUST have a passkey. No login without passkey.**

#### Implementation:
- ✅ One-passkey-per-wallet enforcement
- ✅ Passkey validation during login
- ✅ Automatic duplicate removal
- ✅ No password-based authentication allowed

#### Files Modified:
- `/ui/lib/DataManagement.ts` (NEW) - Data management utilities
- `/ui/components/Login.tsx` - Added passkey validation
- `/ui/components/SignupOrchestrator.tsx` - Enforces one-passkey-per-wallet

#### Key Functions:

```typescript
// Check if wallet has passkey
hasPasskey(walletAddress: string): boolean

// Get passkey ID
getPasskeyId(walletAddress: string): string | null

// Count passkeys
countPasskeys(walletAddress: string): number

// Enforce one passkey per wallet
enforceOnePasskeyPerWallet(walletAddress: string): void

// Validate passkey requirement
validatePasskeyRequired(walletAddress: string): void
```

---

### 2. Data Clearing Utility

#### Clear All Data:
```typescript
clearAllData(): void
```

Removes:
- Wallet connections
- Passkeys
- Aadhar data
- Generated proofs
- Session data
- All localStorage items

#### Admin Page: `/admin`
- View data summary
- Clear all data with confirmation
- Access testing links
- View passkey policy

---

### 3. Citizenship ZK Proof (Case-Insensitive)

#### Implementation:
- **Contract**: `/contracts/src/CitizenshipProof.ts`
- **Frontend**: `/ui/lib/ProofGenerator.ts`

#### Features:
✅ Case-insensitive matching (India = india = INDIA)
✅ Poseidon hashing for ZK proofs
✅ Salted commitments
✅ Digital signatures
✅ Browser-compatible encoding

#### Usage:

```typescript
// Generate proof
const proof = generateCitizenshipZKProof(
  citizenship: 'India',  // Any case works
  privateKey,
  salt
);

// Verify proof
const isValid = verifyCitizenshipZKProof(
  expectedCitizenship: 'india',  // Case-insensitive
  proofCommitment,
  salt,
  signature,
  publicKey
);
```

#### How It Works:

1. **Proof Generation:**
   ```
   "India" → normalize → "india"
   → encode → [105, 110, 100, 105, 97]
   → Poseidon.hash(fields) → citizenshipField
   → Poseidon.hash([citizenshipField, salt]) → commitment
   ```

2. **Verification:**
   ```
   "INDIA" → normalize → "india" → same process
   → Compare commitments → Match! ✓
   ```

---

### 4. Testing Suite

#### Test Page: `/test-proofs`

**Citizenship Tests:**
- ✅ Basic proof generation
- ✅ Case insensitivity (india, INDIA, InDiA)
- ✅ Whitespace handling
- ✅ Different citizenship rejection
- ✅ Wrong salt rejection
- ✅ Multiple proofs

**Age Tests:**
- ✅ Age 18+ proof
- ✅ Age 21+ proof
- ✅ Underage user handling

**Blockchain Tests:**
- ✅ Network configuration
- ✅ Contract interface
- ✅ Deployed contract addresses

---

### 5. Updated Authentication Flow

#### Signup Flow:
```
1. Connect Wallet
   ↓
2. Upload Aadhar XML
   ↓
3. Create Passkey (MANDATORY)
   ├─ Check existing passkeys
   ├─ Enforce one-passkey-per-wallet
   └─ Remove duplicates
   ↓
4. Register DID
   ↓
5. Complete
```

#### Login Flow:
```
1. Click "Login with Passkey"
   ↓
2. Biometric Authentication
   ↓
3. Validate Passkey Exists ← NEW
   ├─ If missing → Error: "Create passkey during signup"
   └─ If exists → Continue
   ↓
4. Load Session
   ↓
5. Redirect to Dashboard
```

---

## 📋 Passkey Policy

### Enforcement Rules:

1. **Mandatory Creation**
   - Passkey MUST be created during signup
   - Cannot skip passkey step
   - Login blocked without passkey

2. **One Per Wallet**
   - Only 1 passkey allowed per wallet address
   - Duplicates automatically removed
   - Enforced during signup and login

3. **Validation**
   - Login checks for passkey existence
   - Error shown if missing
   - User redirected to signup

4. **Auto-Cleanup**
   - `enforceOnePasskeyPerWallet()` called during signup
   - Keeps newest passkey
   - Removes older duplicates

---

## 🧪 Testing Instructions

### 1. Clear Existing Data

```
1. Go to /admin
2. View current data summary
3. Click "Clear All Data"
4. Confirm deletion
5. Page redirects to home
```

### 2. Test Citizenship ZK Proofs

```
1. Go to /test-proofs
2. Click "🌍 Test Citizenship ZK Proofs"
3. View test results:
   - Basic proof generation ✅
   - "India" verification ✅
   - "india" verification ✅
   - "INDIA" verification ✅
   - "InDiA" verification ✅
   - "USA" rejection ✅
```

### 3. Test Age Proofs

```
1. Go to /test-proofs
2. Click "🎂 Test Age ZK Proofs"
3. View test results:
   - Age 18+ proof ✅
   - Age 21+ proof ✅
   - Underage rejection ✅
```

### 4. Test Blockchain

```
1. Go to /test-proofs
2. Click "⛓️ Test Blockchain Integration"
3. View results:
   - Network config ✅
   - Contract addresses ✅
   - Interface initialization ✅
```

### 5. Test Full Signup Flow

```
1. Go to /signup
2. Connect Auro Wallet
3. Upload Aadhar XML
4. Create Passkey (biometric prompt)
   → Check console for enforcement logs
5. Verify one passkey created
6. Register DID
7. Complete signup
```

### 6. Test Login

```
1. Go to /login
2. Click "Login with Passkey"
3. Biometric authentication
4. Verify passkey validation
5. Access dashboard
```

### 7. Test Citizenship Verification

```
1. Generate proof (signup flow)
2. Download proof.json
3. Go to /verifier
4. Upload proof
5. Enter citizenship (any case):
   - "india" ✅
   - "INDIA" ✅
   - "India" ✅
6. Verify all pass
```

---

## 🗂️ New Files

1. **`/ui/lib/DataManagement.ts`**
   - Data clearing utilities
   - Passkey enforcement
   - Data validation

2. **`/ui/app/admin/page.tsx`**
   - Admin interface
   - Data management
   - System status

3. **`/ui/app/test-proofs/page.tsx`**
   - Automated testing suite
   - Citizenship tests
   - Age tests
   - Blockchain tests

4. **`/contracts/src/CitizenshipProof.ts`**
   - ZkProgram for citizenship
   - Case-insensitive verification
   - Helper functions

5. **`/CITIZENSHIP_ZK_PROOF.md`**
   - Complete documentation
   - Usage examples
   - Technical details

---

## 🔒 Security Features

### Passkey Security:
- ✅ Biometric-bound authentication
- ✅ Device-bound credentials
- ✅ Phishing-resistant
- ✅ No password storage

### ZK Proof Security:
- ✅ Privacy-preserving verification
- ✅ Cryptographic commitments
- ✅ Salted hashing
- ✅ Digital signatures
- ✅ Tamper-proof

### Data Security:
- ✅ Client-side encryption
- ✅ No server storage
- ✅ Private keys never leave device
- ✅ Secure storage in localStorage

---

## 📊 Verification Examples

### Citizenship Verification:

```typescript
// User's citizenship: "India" (from Aadhar)
const proof = generateCitizenshipZKProof("India", privateKey, salt);

// Verifier checks (all succeed):
verifyCitizenshipZKProof("india", ...) → true ✅
verifyCitizenshipZKProof("INDIA", ...) → true ✅
verifyCitizenshipZKProof("India", ...) → true ✅
verifyCitizenshipZKProof("  india  ", ...) → true ✅

// Wrong citizenship (all fail):
verifyCitizenshipZKProof("USA", ...) → false ✗
verifyCitizenshipZKProof("China", ...) → false ✗
```

---

## 🎯 Key Benefits

1. **Enhanced Security**
   - Mandatory biometric authentication
   - No weak passwords
   - One-passkey-per-wallet policy

2. **Better UX**
   - Case-insensitive verification
   - Clear error messages
   - Automated testing

3. **Privacy-Preserving**
   - Zero-knowledge proofs
   - No data revealed
   - Cryptographic commitments

4. **Production-Ready**
   - Comprehensive testing
   - Error handling
   - Data management tools

---

## 🐛 Debugging

### Console Logs:

**Signup:**
```
[Signup] Wallet already has X passkey(s). Enforcing one-passkey-per-wallet...
[DataManagement] Removing duplicate passkey: minaid:passkey:...
[DataManagement] ✓ Enforced one-passkey-per-wallet: kept minaid:passkey:...
[Signup] ✓ Passkey created: abc123...
[Signup] Final passkey count: 1
[Signup] ✓ Private key encrypted and stored
[Signup] ✓ One-passkey-per-wallet policy enforced
```

**Login:**
```
[Login] Validating passkey requirement...
[Login] ✓ Passkey found for DID: B62qj...
[Login] Biometric authentication...
[Login] ✓ Login successful
```

**Citizenship Verification:**
```
[Citizenship ZK] Generating proof for: India
[Citizenship ZK] Normalized to: india
[Citizenship ZK] Commitment: 12345...
[Citizenship ZK] ✓ Proof generated successfully

[Citizenship ZK Verify] Verifying citizenship: INDIA
[Citizenship ZK Verify] Normalized to: india
[Citizenship ZK Verify] Match: true
[Citizenship ZK Verify] ✓ Verification successful - citizenship matches!
```

---

## 📝 Summary

**MinaID v2.0 implements:**
1. ✅ Mandatory passkey authentication
2. ✅ One-passkey-per-wallet enforcement
3. ✅ Case-insensitive citizenship ZK proofs
4. ✅ Comprehensive testing suite
5. ✅ Data management utilities
6. ✅ Admin interface
7. ✅ Enhanced security & UX

**All systems tested and verified!**
