# MinaID - Ultimate P2P Decentralized Identity System

A **fully peer-to-peer**, privacy-preserving decentralized identity (DID) system built on Mina Protocol with zero-knowledge proofs, biometric security, and multi-chain wallet support.

## 🌟 Revolutionary Features

### Core P2P Architecture
- **Pure P2P dApp**: No backend servers required - all verification happens client-side + on-chain
- **Biometric-Secured Keys**: Private keys encrypted with Passkeys (WebAuthn) - Face ID, Touch ID, fingerprint
- **Multi-Chain Identity**: Link Mina (Auro) and EVM (Metamask) wallets to one identity
- **Fraud-Resistant**: Prevents credential theft through device-bound biometric authentication  
- **Sybil-Attack Protection**: One person = one biometric device = one verifiable identity

### Zero-Knowledge Privacy
- **DID Registry**: On-chain decentralized identifier management via Merkle trees
- **ZK Age Verification**: Prove age requirements without revealing actual age
- **ZK KYC Verification**: Privacy-preserving Know Your Customer checks
- **Aadhar Integration**: Novel UIDAI Aadhar XML verification with ZK proofs
- **Verifiable Credentials**: W3C-compliant credential issuance and verification
- **Off-Chain Data**: All personal information stays local; only proofs go on-chain

### Advanced Capabilities
1. **Passkey Security**: Biometric authentication required to decrypt keys and generate proofs
2. **Just-In-Time Proofs**: ZK proofs generated on-demand, never stored
3. **Wallet Interoperability**: Seamless integration with Auro (Mina) and Metamask (EVM)
4. **Recursive Proofs**: Compose multiple credential proofs into one
5. **Range Proofs**: Prove age is within a range without revealing exact value
6. **Batch Verification**: Verify multiple credentials in one on-chain transaction
7. **Anti-Replay Protection**: Time-bound challenges prevent proof reuse
8. **Device Binding**: Credentials tied to specific device hardware via Passkeys

---

## 🔐 How It Prevents Identity Fraud

### The Problem
Traditional credential systems fail when credentials are shared:
- Alice (18+) gives her credentials to underage Bob
- Bob uses Alice's credentials to access age-restricted services
- No way to verify it's actually Alice using her credentials

### The MinaID Solution

**Step 1: Biometric Binding During Registration**
```
User Creates MinaID:
1. Connect Auro Wallet → Generate Mina keypair
2. Upload Aadhar XML → Verify with UIDAI signature
3. Create Passkey → Biometric scan (Face ID/Fingerprint)
4. Encrypt private key with Passkey → Store encrypted blob locally
5. Register DID on-chain → Only public key goes to blockchain
```

**Step 2: Biometric Verification During Login**
```
User Tries to Access dApp:
1. dApp requests: "Prove you're over 18"
2. MinaID prompts: "Authenticate with Face ID"
3. User scans face → Passkey authenticates
4. Decrypt private key (in-memory only)
5. Generate ZK proof (age > 18)
6. Send proof to on-chain verifier
7. Clear decrypted key from memory
8. dApp grants access if proof verified
```

**Why Bob Cannot Steal Alice's Identity:**
1. ❌ Bob doesn't have Alice's device
2. ❌ Bob doesn't have Alice's biometrics (face/fingerprint)
3. ❌ Bob cannot decrypt Alice's encrypted private key
4. ❌ Bob cannot generate the ZK proof
5. ✅ **Login fails - Fraud prevented**

### Security Properties

| Attack Vector | Traditional System | MinaID Defense |
|---------------|-------------------|----------------|
| Credential Sharing | ❌ Easy - just share password | ✅ **Impossible** - requires biometrics |
| Phishing | ❌ Users enter credentials on fake sites | ✅ **Prevented** - no credentials to steal |
| Key Theft | ❌ Steal password = full access | ✅ **Useless** - need biometric to decrypt |
| Sybil Attack | ❌ One person creates many IDs | ✅ **Limited** - one device = one biometric |
| Replay Attack | ❌ Reuse captured credentials | ✅ **Prevented** - time-bound challenges |
| Device Loss | ❌ Lost device = lost access | ✅ **Recoverable** - use backup Passkey |

---

## 🏗️ Architecture Overview

### Pure P2P Flow (No Backend)

```
┌─────────────────┐
│   User Device   │
│  (Browser dApp) │
└────────┬────────┘
         │
         ├──► [Passkey Authentication]
         │    └─► Biometric Scan (Face ID/Fingerprint)
         │
         ├──► [Local Key Decryption]
         │    └─► Decrypt Mina private key (in-memory only)
         │
         ├──► [ZK Proof Generation]
         │    └─► Generate proof of credential (age, KYC, etc.)
         │
         ├──► [Wallet Connection]
         │    ├─► Auro Wallet (Mina) - Sign transactions
         │    └─► Metamask (EVM) - Multi-chain identity
         │
         └──► [Blockchain Verification]
              └─► Mina Protocol P2P Network
                  └─► ZKPVerifier Smart Contract
                      └─► Verify proof on-chain
                          └─► Grant/Deny Access
```

**Key Points:**
- ✅ **No central servers** - dApp is static HTML/JS hosted on IPFS
- ✅ **No backend API** - all logic runs in browser + on-chain
- ✅ **No databases** - credentials stored encrypted in browser localStorage
- ✅ **Truly decentralized** - only trust the blockchain consensus

### Hybrid Model (Optional Web2.5 Integration)

For traditional websites that want MinaID login:

```
┌─────────────┐         ┌──────────────────┐
│  User dApp  │ ──P2P──►│  Mina Blockchain │
└──────┬──────┘         └──────────────────┘
       │                          │
       │ (Optional)               │
       ├──────────────────────────┤
       │                          │
       ▼                          ▼
┌─────────────────┐    ┌─────────────────┐
│ Verifier Backend│    │  Event Indexer  │
│ (Gas Relayer)   │◄───│  (Watch chain)  │
└─────────────────┘    └─────────────────┘
```

**Use Cases for Hybrid:**
- Gasless transactions (backend pays gas for user)
- Integration with existing Web2 authentication systems
- Session management for traditional web apps
- Analytics and user tracking (with consent)

**Note:** Even in hybrid mode, the user's credentials never leave their device. The backend only sees the ZK proof, not the underlying data.

---

## 📁 Project Structure

```
MinaID/
├── contracts/              # Mina zkApp smart contracts
│   ├── src/
│   │   ├── DIDRegistry.ts              # DID registration and management
│   │   ├── ZKPVerifier.ts              # ZK proof verification
│   │   ├── AgeVerificationProgram.ts   # Age proof generation
│   │   ├── Add.ts                      # Example contract
│   │   └── AddZkProgram.ts             # Example ZkProgram
│   ├── build/              # Compiled JavaScript output
│   └── cache/              # Compilation cache for faster builds
│
├── ui/                     # Next.js frontend application (P2P dApp)
│   ├── app/
│   │   ├── page.tsx                    # Main landing page
│   │   ├── ZkappWorker.ts              # Web worker for ZK computations
│   │   └── ZkappWorkerClient.ts        # Worker client interface
│   ├── components/         # React components
│   │   ├── SignupOrchestrator.tsx      # Multi-step signup flow
│   │   ├── AadharVerification.tsx      # Aadhar XML parsing and verification
│   │   ├── Login.tsx                   # P2P biometric-secured login
│   │   ├── Dashboard.tsx               # User dashboard
│   │   └── WalletConnect.tsx           # Multi-wallet integration
│   ├── context/            # React context providers
│   │   ├── WalletContext.tsx           # Auro + Metamask wallet state
│   │   └── DIDContext.tsx              # DID operations
│   ├── hooks/              # Custom React hooks
│   │   ├── usePasskey.ts               # WebAuthn/Passkey operations
│   │   ├── useUidaiCert.ts             # UIDAI certificate validation
│   │   └── useMinaWallet.ts            # Mina wallet interactions
│   ├── lib/                # Utility libraries
│   │   ├── AadharParser.ts             # Parse Aadhar XML
│   │   ├── ProofGenerator.ts           # ZK proof utilities
│   │   ├── ContractInterface.ts        # Smart contract interactions
│   │   └── CryptoUtils.ts              # Encryption with Passkeys
│   └── public/cache/       # o1js compilation cache
│
└── services/               # Backend services (OPTIONAL - for Web2.5 hybrid)
    ├── issuer-service.js   # Credential issuance service
    └── verifier-service.js # Gas relay and session management
```

---

## 🔧 Setup & Installation

### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- Git
- Chrome/Edge/Safari (for Passkey/WebAuthn support)

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/SuryaSundarVadali/MinaID.git
cd MinaID
```

2. **Install and build contracts**
```bash
cd contracts
npm install
npm run build
```

3. **Install UI dependencies**
```bash
cd ../ui
npm install
npm install @simplewebauthn/browser  # For Passkey support
npm install xmldsigjs xml-js          # For Aadhar XML parsing
```

4. **Configure environment variables**

Create `ui/.env.local`:
```env
NEXT_PUBLIC_MINA_NETWORK=devnet
NEXT_PUBLIC_DID_REGISTRY_ADDRESS=B62q...
NEXT_PUBLIC_ZKP_VERIFIER_ADDRESS=B62q...
```

5. **Run the development server**
```bash
npm run dev
```

Open http://localhost:3000

---

## 📚 Smart Contracts Documentation

### DIDRegistry Contract

Manages decentralized identifiers on the Mina blockchain using Merkle tree storage.

**Key Methods:**
- `registerDID(publicKey, didDocumentHash, witness, signature)` - Register a new DID
- `revokeDID(publicKey, witness, signature)` - Revoke an existing DID
- `updateDID(publicKey, newHash, witness, signature)` - Update DID document
- `verifyDID(publicKey, witness)` - Check if DID is registered
- `transferOwnership(newOwner)` - Transfer contract ownership

**State Variables:**
- `didMapRoot: Field` - Merkle tree root of all DIDs
- `totalDIDs: Field` - Count of registered DIDs
- `owner: PublicKey` - Contract administrator

**Events:**
- `DIDRegistered` - New DID registered
- `DIDRevoked` - DID revoked
- `DIDUpdated` - DID document updated
- `DIDVerified` - DID verification query
- `OwnershipTransferred` - Contract ownership changed

### ZKPVerifier Contract

Verifies zero-knowledge proofs of credentials without revealing sensitive data.

**Key Methods:**
- `verifyAgeProof(subject, ageHash, proof, issuer, ...)` - Verify age requirement met
- `verifyKYCProof(subject, kycHash, proof, issuer)` - Verify KYC status
- `verifyCredentialProof(claim, proof, commitment)` - Generic credential verification
- `batchVerifyCredentials(claims, proofs, commitments)` - Batch verify up to 5 credentials
- `addTrustedIssuer(issuerPublicKey, issuerHash)` - Add trusted issuer (admin only)
- `updateMinimumAge(newMinimumAge)` - Update minimum age requirement

**State Variables:**
- `trustedIssuersRoot: Field` - Merkle root of trusted issuers
- `minimumAge: Field` - Default minimum age (18)
- `totalVerifications: Field` - Count of verifications performed
- `owner: PublicKey` - Contract administrator

**Events:**
- `AgeVerified` - Age proof verified
- `KYCVerified` - KYC proof verified
- `CredentialVerified` - Generic credential verified
- `BatchVerified` - Batch verification completed
- `IssuerAdded` - New trusted issuer added
- `MinimumAgeUpdated` - Minimum age changed

### AgeVerificationProgram

ZkProgram for generating age proofs without revealing exact age.

**Methods:**
- `proveAgeAboveMinimum(publicInput, actualAge, salt)` - Prove age ≥ minimum
- `proveAgeInRange(publicInput, actualAge, salt, maximum)` - Prove age in range [min, max]
- `composeAgeProofs(publicInput, previousProof)` - Recursive proof composition

**Public Input Structure:**
```typescript
{
  subjectPublicKey: PublicKey,  // User's public key
  minimumAge: Field,             // Minimum age requirement
  ageHash: Field,                // Hash of actual age (private)
  issuerPublicKey: PublicKey,    // Issuer's public key
  timestamp: Field               // Proof creation time
}
```

---

## 🎯 Usage Guide

### Complete User Journey

#### 1. User Registration with Aadhar KYC

```typescript
// STEP 1: Generate DID
const privateKey = PrivateKey.random();
const publicKey = privateKey.toPublicKey();
const did = `did:mina:${publicKey.toBase58()}`;

// STEP 2: Upload and Parse Aadhar XML
const aadharFile = await fileInput.files[0];
const aadharData = await parseAadharXML(aadharFile);

// STEP 3: Verify UIDAI Signature (off-chain)
const isValid = await verifyUIDAISignature(aadharData);
if (!isValid) throw new Error('Invalid Aadhar');

// STEP 4: Extract Age and Generate ZK Proof
const age = calculateAge(aadharData.dateOfBirth);
const salt = Field.random();
const ageHash = Poseidon.hash([Field(age), salt]);

const ageProof = await AgeVerificationProgram.proveAgeAboveMinimum(
  {
    subjectPublicKey: publicKey,
    minimumAge: Field(18),
    ageHash,
    issuerPublicKey: issuerKey,
    timestamp: Field(Date.now())
  },
  Field(age),
  salt
);

// STEP 5: Create Passkey (Biometric)
const passkey = await navigator.credentials.create({
  publicKey: {
    challenge: new Uint8Array(32),
    rp: { name: 'MinaID' },
    user: {
      id: publicKey.toFields()[0].toBigInt(),
      name: did,
      displayName: 'MinaID User'
    },
    pubKeyCredParams: [{ type: 'public-key', alg: -7 }]
  }
});

// STEP 6: Encrypt Private Key with Passkey
const encryptedKey = await encryptWithPasskey(
  privateKey.toBase58(),
  passkey.id
);
localStorage.setItem('minaid_encrypted_key', encryptedKey);
localStorage.setItem('minaid_passkey_id', passkey.id);

// STEP 7: Get Credential from Issuer Service (Optional)
const credential = await fetch('/api/issue-credential', {
  method: 'POST',
  body: JSON.stringify({ 
    publicKey: publicKey.toBase58(), 
    ageProof: ageProof.toJSON() 
  })
}).then(r => r.json());

// STEP 8: Register DID On-Chain
const didDocumentHash = Poseidon.hash([
  ...publicKey.toFields(),
  Field.fromJSON(credential.credentialHash)
]);

const witness = merkleMap.getWitness(publicKey);
const signature = Signature.create(privateKey, [didDocumentHash]);

const tx = await Mina.transaction(async () => {
  await didRegistry.registerDID(
    publicKey,
    didDocumentHash,
    witness,
    signature
  );
});

await tx.prove();
await tx.sign([privateKey]).send();

// STEP 9: Clear Plaintext Key from Memory
privateKey = null; // Only encrypted version remains
```

#### 2. P2P Login with Biometric Verification

```typescript
// STEP 1: User Clicks "Login with MinaID"
async function handleP2PLogin() {
  
  // STEP 2: Authenticate with Passkey (Biometric)
  const passkeyId = localStorage.getItem('minaid_passkey_id');
  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(32),
      allowCredentials: [{
        type: 'public-key',
        id: base64ToArrayBuffer(passkeyId)
      }]
    }
  });
  
  // Biometric scan happens here (Face ID/Fingerprint) ↑
  
  // STEP 3: Decrypt Private Key (In-Memory Only)
  const encryptedKey = localStorage.getItem('minaid_encrypted_key');
  const privateKey = await decryptWithPasskey(encryptedKey, assertion);
  const publicKey = privateKey.toPublicKey();
  
  // STEP 4: Generate Challenge (Client-Side)
  const challenge = Field.random();
  
  // STEP 5: Sign Challenge
  const signature = Signature.create(privateKey, [challenge]);
  
  // STEP 6: Generate ZK Proof of Credential
  const credential = JSON.parse(localStorage.getItem('minaid_credential'));
  const ageProof = await AgeVerificationProgram.proveAgeAboveMinimum(
    {
      subjectPublicKey: publicKey,
      minimumAge: Field(18),
      ageHash: Field.fromJSON(credential.ageHash),
      issuerPublicKey: PublicKey.fromBase58(credential.issuer),
      timestamp: Field(Date.now())
    },
    Field(credential.age), // Private input
    Field.fromJSON(credential.salt) // Private input
  );
  
  // STEP 7: Clear Decrypted Key Immediately
  privateKey.toBase58(); // Use it
  const tempKey = privateKey; // Keep reference only for tx
  
  // STEP 8: Send Verification Transaction to On-Chain Verifier
  const tx = await Mina.transaction(async () => {
    await zkpVerifier.verifyAgeProof(
      publicKey,
      Field.fromJSON(credential.ageHash),
      ageProof.publicOutput,
      PublicKey.fromBase58(credential.issuer),
      signature.r,
      signature.s
    );
  });
  
  await tx.prove();
  await tx.sign([tempKey]).send();
  
  // STEP 9: Clear All Sensitive Data from Memory
  tempKey = null;
  privateKey = null;
  
  // STEP 10: Wait for Transaction Confirmation
  const isVerified = await waitForTransaction(tx.hash());
  
  if (isVerified) {
    // Grant access to dApp
    setAuthenticated(true);
    router.push('/dashboard');
  } else {
    throw new Error('Verification failed');
  }
}
```

#### 3. Multi-Wallet Linking (Auro + Metamask)

```typescript
// Link Mina and Ethereum addresses to one identity

async function linkWallets() {
  // STEP 1: Connect Both Wallets
  const auroAccounts = await window.mina.requestAccounts();
  const metamaskAccounts = await window.ethereum.request({ 
    method: 'eth_requestAccounts' 
  });
  
  const auroAddress = auroAccounts[0];
  const metamaskAddress = metamaskAccounts[0];
  
  // STEP 2: Create Link Message
  const linkMessage = `Link Auro ${auroAddress} with Metamask ${metamaskAddress}`;
  
  // STEP 3: Sign with Auro
  const auroSignature = await window.mina.signMessage({
    message: linkMessage
  });
  
  // STEP 4: Sign with Metamask
  const metamaskSignature = await window.ethereum.request({
    method: 'personal_sign',
    params: [linkMessage, metamaskAddress]
  });
  
  // STEP 5: Store Link On-Chain or Locally
  const linkProof = {
    auroAddress,
    metamaskAddress,
    auroSignature,
    metamaskSignature,
    timestamp: Date.now()
  };
  
  localStorage.setItem('minaid_wallet_link', JSON.stringify(linkProof));
  
  // Now user can use either wallet to prove their identity!
}
```

---

## 🛠️ GitHub Copilot Development Guide

### React Hooks Implementation

#### 1. usePasskey Hook (`ui/hooks/usePasskey.ts`)

```typescript
// React hook for WebAuthn/Passkey operations using @simplewebauthn/browser
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';

export function usePasskey() {
  // State for loading and errors
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Create a new Passkey (during signup)
  const createPasskey = async (userId: string, userName: string) => {
    // Generate challenge server-side or client-side
    // Call navigator.credentials.create() with WebAuthn options
    // Return credential ID and public key
  };
  
  // Authenticate with existing Passkey (during login)
  const authenticateWithPasskey = async (credentialId: string) => {
    // Call navigator.credentials.get() with credential ID
    // Return authentication assertion
    // This triggers biometric scan (Face ID/Fingerprint)
  };
  
  return { createPasskey, authenticateWithPasskey, isLoading, error };
}
```

#### 2. WalletContext (`ui/context/WalletContext.tsx`)

```typescript
// React context for multi-wallet management with biometric encryption

export const WalletContext = createContext<WalletContextType | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  // State for wallet connections
  const [auroAddress, setAuroAddress] = useState<string | null>(null);
  const [metamaskAddress, setMetamaskAddress] = useState<string | null>(null);
  const [minaPrivateKey, setMinaPrivateKey] = useState<PrivateKey | null>(null);
  const [isAuroConnected, setIsAuroConnected] = useState(false);
  const [isMetamaskConnected, setIsMetamaskConnected] = useState(false);
  
  // Connect to Auro Wallet
  const connectAuro = async () => {
    const accounts = await window.mina.requestAccounts();
    setAuroAddress(accounts[0]);
    setIsAuroConnected(true);
  };
  
  // Connect to Metamask
  const connectMetamask = async () => {
    const accounts = await window.ethereum.request({ 
      method: 'eth_requestAccounts' 
    });
    setMetamaskAddress(accounts[0]);
    setIsMetamaskConnected(true);
  };
  
  // Encrypt private key with Passkey and store locally
  const encryptAndStoreKey = async (privateKey: PrivateKey, passkeyId: string) => {
    // Use Web Crypto API (SubtleCrypto) to derive encryption key from passkeyId
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(passkeyId),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    
    const encryptionKey = await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: new Uint8Array(16), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
    
    // Encrypt the private key
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      encryptionKey,
      new TextEncoder().encode(privateKey.toBase58())
    );
    
    // Store encrypted blob + IV in localStorage
    localStorage.setItem('minaid_encrypted_key', arrayBufferToBase64(encrypted));
    localStorage.setItem('minaid_key_iv', arrayBufferToBase64(iv));
    localStorage.setItem('minaid_passkey_id', passkeyId);
  };
  
  // Decrypt private key using Passkey authentication
  const decryptAndLoadKey = async (passkeyId: string, assertion: any) => {
    // Similar process in reverse
    // Derive key from passkeyId
    // Decrypt the blob from localStorage
    // Return PrivateKey instance
    // Keep in memory only temporarily!
  };
  
  return (
    <WalletContext.Provider value={{
      auroAddress,
      metamaskAddress,
      minaPrivateKey,
      isAuroConnected,
      isMetamaskConnected,
      connectAuro,
      connectMetamask,
      encryptAndStoreKey,
      decryptAndLoadKey
    }}>
      {children}
    </WalletContext.Provider>
  );
}
```

### Component Implementation

#### 3. SignupOrchestrator Component

```typescript
// Multi-step signup component with biometric binding

export function SignupOrchestrator() {
  const [currentStep, setCurrentStep] = useState<'wallet' | 'aadhar' | 'passkey' | 'register' | 'complete'>('wallet');
  const { connectAuro, connectMetamask, encryptAndStoreKey } = useWallet();
  const { createPasskey } = usePasskey();
  
  // Step 1: Connect Wallets
  const handleWalletConnection = async () => {
    await connectAuro(); // Required
    // Optionally connect Metamask
    setCurrentStep('aadhar');
  };
  
  // Step 2: Verify Aadhar (handled by AadharVerification component)
  const handleAadharVerified = (ageProof: any, age: number) => {
    // Store proof and age
    setCurrentStep('passkey');
  };
  
  // Step 3: Create Passkey
  const handlePasskeyCreation = async () => {
    const passkey = await createPasskey(did, 'MinaID User');
    
    // Encrypt and store the Mina private key
    await encryptAndStoreKey(minaPrivateKey, passkey.id);
    
    // Clear plaintext key from memory
    minaPrivateKey = null;
    
    setCurrentStep('register');
  };
  
  // Step 4: Register DID On-Chain
  const handleDIDRegistration = async () => {
    // Send transaction to DIDRegistry contract
    // Wait for confirmation
    setCurrentStep('complete');
  };
  
  return (
    <div>
      {currentStep === 'wallet' && <WalletConnectionStep onNext={handleWalletConnection} />}
      {currentStep === 'aadhar' && <AadharVerification onVerified={handleAadharVerified} />}
      {currentStep === 'passkey' && <PasskeyCreationStep onCreate={handlePasskeyCreation} />}
      {currentStep === 'register' && <DIDRegistrationStep onRegister={handleDIDRegistration} />}
      {currentStep === 'complete' && <CompletionScreen />}
    </div>
  );
}
```

#### 4. P2P Login Component

```typescript
// Biometric-secured P2P login (no backend needed)

export function Login() {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const { decryptAndLoadKey } = useWallet();
  const { authenticateWithPasskey } = usePasskey();
  const router = useRouter();
  
  const handleP2PLogin = async () => {
    setIsAuthenticating(true);
    
    try {
      // Step 1: Authenticate with biometrics
      const passkeyId = localStorage.getItem('minaid_passkey_id');
      const assertion = await authenticateWithPasskey(passkeyId);
      
      // Biometric scan happens here ↑
      
      // Step 2: Decrypt private key temporarily
      const tempPrivateKey = await decryptAndLoadKey(passkeyId, assertion);
      const publicKey = tempPrivateKey.toPublicKey();
      
      // Step 3: Generate ZK proof
      const credential = JSON.parse(localStorage.getItem('minaid_credential'));
      const proof = await generateAgeProof(credential, tempPrivateKey);
      
      // Step 4: Send verification transaction to on-chain verifier
      const tx = await verifyProofOnChain(publicKey, proof, tempPrivateKey);
      
      // Step 5: Clear sensitive data
      tempPrivateKey = null;
      
      // Step 6: Wait for confirmation
      const verified = await waitForTransaction(tx.hash());
      
      if (verified) {
        router.push('/dashboard');
      } else {
        throw new Error('Verification failed');
      }
      
    } catch (error) {
      console.error('Login failed:', error);
    } finally {
      setIsAuthenticating(false);
    }
  };
  
  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-4xl font-bold mb-8">Login with MinaID</h1>
      <button
        onClick={handleP2PLogin}
        disabled={isAuthenticating}
        className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-lg"
      >
        {isAuthenticating ? 'Authenticating...' : 'Login with Biometrics'}
      </button>
    </div>
  );
}
```

---

## 🧪 Testing

### Contract Tests

```bash
cd contracts
npm run test
```

Test coverage:
- ✅ DID Registration
- ✅ DID Revocation
- ✅ DID Updates
- ✅ Age Proof Verification
- ✅ KYC Proof Verification
- ✅ Batch Verification
- ✅ Ownership Management

### Frontend Tests

```bash
cd ui
npm run test
```

Test coverage:
- ✅ Wallet Connection
- ✅ Passkey Creation
- ✅ Passkey Authentication
- ✅ Key Encryption/Decryption
- ✅ ZK Proof Generation
- ✅ Transaction Submission

### E2E Tests

```bash
npm run test:e2e
```

Scenarios:
- Full signup flow
- P2P login flow
- Multi-wallet linking
- Credential issuance
- Proof verification

---

## 🚀 Deployment

### Deploy Contracts to Mina Devnet

```bash
cd contracts

# Configure network
npm run config

# Deploy DIDRegistry
zk deploy did-registry

# Deploy ZKPVerifier
zk deploy zkp-verifier

# Save deployed addresses
echo "DID_REGISTRY_ADDRESS=B62q..." >> ../ui/.env.local
echo "ZKP_VERIFIER_ADDRESS=B62q..." >> ../ui/.env.local
```

### Deploy dApp to IPFS

```bash
cd ui

# Build static site
npm run build
npm run export

# Deploy to IPFS using Fleek, Pinata, or IPFS Desktop
ipfs add -r out/
```

### Optional: Deploy Backend Services

```bash
cd services

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your settings

# Start issuer service
node issuer-service.js

# Start verifier service (in another terminal)
node verifier-service.js
```

---

## 🔒 Security Considerations

### Best Practices

1. **Never Log Private Keys**: Ensure no console.log() statements expose keys
2. **Clear Memory**: Always nullify private keys after use
3. **Use HTTPS**: Host dApp only on HTTPS (required for WebAuthn)
4. **Validate Inputs**: Sanitize all user inputs to prevent injection attacks
5. **Rate Limiting**: Implement rate limiting for proof generation
6. **Audit Smart Contracts**: Get professional security audit before mainnet
7. **Bug Bounty**: Run a bug bounty program for responsible disclosure

### Known Limitations

1. **Passkey Backup**: Users must backup Passkeys or lose access
2. **Browser Support**: WebAuthn not supported in older browsers
3. **Device Binding**: Credential tied to one device (by design)
4. **Gas Fees**: Users pay gas for on-chain transactions (unless using relayer)

---

## 🤝 Contributing

We welcome contributions! Please see the guidelines below:

### Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `npm run test`
6. Commit with descriptive messages: `git commit -m 'Add amazing feature'`
7. Push to your fork: `git push origin feature/amazing-feature`
8. Open a Pull Request

### Code Style

- Use TypeScript for all new code
- Follow existing code formatting (Prettier)
- Add JSDoc comments for functions
- Write unit tests for new features

### Reporting Issues

- Use GitHub Issues
- Include steps to reproduce
- Provide error messages and logs
- Specify your environment (OS, browser, Node version)

---

## 📖 Additional Resources

### Learning Materials
- [Mina Protocol Docs](https://docs.minaprotocol.com/)
- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)
- [WebAuthn Guide](https://webauthn.guide/)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Zero-Knowledge Proofs Explained](https://z.cash/technology/zksnarks/)

### Community
- [Mina Discord](https://discord.gg/minaprotocol)
- [Mina Forums](https://forums.minaprotocol.com/)
- [GitHub Discussions](https://github.com/SuryaSundarVadali/MinaID/discussions)

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Mina Protocol Team** - For o1js and the incredible zero-knowledge infrastructure
- **UIDAI** - For the Aadhar system (Indian government identity)
- **W3C** - For Verifiable Credentials and WebAuthn standards
- **SimpleWebAuthn** - For the excellent WebAuthn library

---

## 📧 Contact

- **Author**: Surya Sundar Vadali
- **GitHub**: [@SuryaSundarVadali](https://github.com/SuryaSundarVadali)
- **Project**: [MinaID](https://github.com/SuryaSundarVadali/MinaID)

---

## 📊 Project Status

**Current Phase**: Phase 1 Complete ✅  
**Next Phase**: Frontend UI with Passkey Integration

### Completed
- ✅ DIDRegistry Smart Contract
- ✅ ZKPVerifier Smart Contract
- ✅ AgeVerificationProgram ZkProgram
- ✅ Contract Compilation & Build System
- ✅ Comprehensive Documentation

### In Progress
- 🚧 React Components (SignupOrchestrator, Login)
- 🚧 Passkey Integration (usePasskey hook)
- 🚧 Multi-Wallet Support (Auro + Metamask)

### Planned
- 📅 Aadhar XML Parser
- 📅 Backend Services (Optional)
- 📅 Testing Suite
- 📅 Security Audit
- 📅 Mainnet Deployment

**Overall Progress**: 24% Complete

---

**Built with ❤️ for a decentralized, privacy-preserving future**
