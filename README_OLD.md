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

## � How It Prevents Identity Fraud

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

## 🏗️ Architecture Overview

### Pure P2P Flow (No Backend)

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
│   ├── cache/              # Compilation cache for faster builds
│   └── package.json
│
├── ui/                     # Next.js frontend application
│   ├── app/
│   │   ├── page.tsx                    # Main landing page
│   │   ├── ZkappWorker.ts              # Web worker for ZK computations
│   │   ├── ZkappWorkerClient.ts        # Worker client interface
│   │   └── layout.tsx                  # App layout
│   ├── components/         # React components (to be created)
│   │   ├── Signup.tsx                  # User registration with Aadhar
│   │   ├── Login.tsx                   # Authentication with ZK proofs
│   │   ├── Dashboard.tsx               # User dashboard
│   │   └── WalletConnect.tsx           # Auro wallet integration
│   ├── context/            # React context (to be created)
│   │   └── WalletContext.tsx           # Wallet and DID state management
│   ├── public/
│   │   └── cache/          # o1js compilation cache
│   └── styles/
│
└── services/               # Backend services (to be created)
    ├── issuer-service.js   # Credential issuance service
    └── verifier-service.js # Authentication and verification service
```

## 🔧 Setup

### Prerequisites
- Node.js 20.x or higher
- npm or yarn
- Git

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/SuryaSundarVadali/MinaID.git
cd MinaID
```

2. **Install contract dependencies**
```bash
cd contracts
npm install
npm run build
```

3. **Install UI dependencies**
```bash
cd ../ui
npm install
```

4. **Run the development server**
```bash
npm run dev
```

Open http://localhost:3000 to see the application.

## 📝 Smart Contracts

### DIDRegistry Contract

Manages decentralized identifiers on the Mina blockchain.

**Key Methods:**
- `registerDID(publicKey, didDocumentHash, witness, signature)` - Register a new DID
- `revokeDID(publicKey, witness, signature)` - Revoke an existing DID
- `updateDID(publicKey, newHash, witness, signature)` - Update DID document
- `verifyDID(publicKey, witness)` - Check if DID is registered

**State:**
- `didMapRoot`: Merkle tree root of all DIDs
- `totalDIDs`: Count of registered DIDs
- `owner`: Contract administrator

### ZKPVerifier Contract

Verifies zero-knowledge proofs of credentials without revealing sensitive data.

**Key Methods:**
- `verifyAgeProof(subject, ageHash, proof, issuer, ...)` - Verify age requirement
- `verifyKYCProof(subject, kycHash, proof, issuer)` - Verify KYC status
- `verifyCredentialProof(claim, proof, commitment)` - Generic credential verification
- `batchVerifyCredentials(claims, proofs, commitments)` - Batch verify up to 5 credentials
- `addTrustedIssuer(issuerPublicKey, issuerHash)` - Add trusted issuer (admin only)

**State:**
- `trustedIssuersRoot`: Merkle root of trusted issuers
- `minimumAge`: Default minimum age requirement (18)
- `totalVerifications`: Count of verifications performed

### AgeVerificationProgram

ZkProgram for generating age proofs.

**Methods:**
- `proveAgeAboveMinimum(publicInput, actualAge, salt)` - Prove age ≥ minimum
- `proveAgeInRange(publicInput, actualAge, salt, maximum)` - Prove age in range
- `composeAgeProofs(publicInput, previousProof)` - Recursive proof composition

## 🎯 Usage Flow

### 1. User Registration with Aadhar KYC

```typescript
// User generates DID
const privateKey = PrivateKey.random();
const publicKey = privateKey.toPublicKey();

// Upload Aadhar XML file
const aadharData = await parseAadharXML(xmlFile);

// Verify UIDAI signature (off-chain)
const isValid = await verifyUIDAISignature(aadharData);

// Extract age and generate ZK proof
const age = calculateAge(aadharData.dateOfBirth);
const salt = Field.random();
const ageHash = Poseidon.hash([Field(age), salt]);

// Create age proof
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

// Send proof to issuer service
const credential = await fetch('/api/issue-credential', {
  method: 'POST',
  body: JSON.stringify({ publicKey, ageProof: ageProof.toJSON() })
});

// Register DID on-chain
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
```

### 2. User Login with ZK Proof

```typescript
// Get challenge from verifier service
const { nonce } = await fetch('/api/get-challenge').then(r => r.json());

// Sign the challenge
const signature = Signature.create(privateKey, [Field(nonce)]);

// Generate proof of credential possession
const credentialProof = await AgeVerificationProgram.proveAgeAboveMinimum(...);

// Submit for verification
const { token } = await fetch('/api/login', {
  method: 'POST',
  body: JSON.stringify({
    publicKey,
    signature,
    nonce,
    credentialProof: credentialProof.toJSON()
  })
});

// Use JWT token for authenticated requests
localStorage.setItem('auth_token', token);
```

## 🔐 Security Features

1. **Zero-Knowledge Proofs**: Personal data never leaves the client
2. **On-Chain Verification**: All proofs verified by smart contracts
3. **Merkle Trees**: Efficient storage and verification of DIDs
4. **Signature Verification**: UIDAI Aadhar signatures verified off-chain
5. **Trusted Issuers**: Only approved issuers can issue credentials
6. **Expiration Handling**: Credentials have expiry timestamps
7. **Revocation Support**: DIDs and credentials can be revoked

## 🚀 Deployment

### Deploy Contracts to Mina Devnet

```bash
cd contracts

# Configure network
npm run config

# Deploy DIDRegistry
npm run deploy:did-registry

# Deploy ZKPVerifier
npm run deploy:zkp-verifier

# Note: Save the deployed contract addresses!
```

### Deploy UI to Vercel

```bash
cd ui

# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

## 📚 API Documentation

### Backend Services (To be implemented)

#### Issuer Service

**POST /api/issue-credential**
- Request: `{ publicKey, ageProof }`
- Response: `{ credential (W3C VC format), signature }`
- Purpose: Issues verifiable credentials after ZK proof verification

#### Verifier Service

**GET /api/get-challenge**
- Response: `{ nonce }`
- Purpose: Generate challenge for authentication

**POST /api/login**
- Request: `{ publicKey, signature, nonce, credentialProof }`
- Response: `{ token (JWT), expiresIn }`
- Purpose: Authenticate user with ZK credential proof

## 🧪 Testing

```bash
# Test contracts
cd contracts
npm run test

# Test UI components
cd ui
npm run test

# End-to-end tests
npm run test:e2e
```

## 📖 Learning Resources

- [Mina Protocol Docs](https://docs.minaprotocol.com/)
- [o1js Documentation](https://docs.minaprotocol.com/zkapps/o1js)
- [W3C Verifiable Credentials](https://www.w3.org/TR/vc-data-model/)
- [Zero-Knowledge Proofs](https://z.cash/technology/zksnarks/)

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Mina Protocol team for o1js
- UIDAI for Aadhar system
- W3C for Verifiable Credentials standard

## 📧 Contact

- GitHub: [@SuryaSundarVadali](https://github.com/SuryaSundarVadali)
- Project: [MinaID](https://github.com/SuryaSundarVadali/MinaID)

---

**Status**: 🚧 In Development | Phase 1 (Smart Contracts) Complete ✅

**Next Steps:**
1. Implement React UI components (Signup, Login, Dashboard)
2. Create backend services (Issuer, Verifier)
3. Integrate Aadhar XML parsing
4. Add W3C Verifiable Credentials support
5. Deploy to testnet
6. Security audit
7. Mainnet launch
