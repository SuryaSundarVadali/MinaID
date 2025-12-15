# MinaID

**Self-Sovereign Digital Identity with Zero-Knowledge Proofs**

MinaID is a decentralized identity system built on Mina Protocol that enables privacy-preserving credential verification. Users can prove attributes about themselves—such as age, citizenship, or other credentials—without revealing underlying personal data. The system combines zero-knowledge proofs with FIDO2 passkey authentication to deliver a secure, user-friendly identity solution.

## Overview

Traditional digital identity systems require users to share sensitive personal information with every service they interact with. MinaID takes a different approach: by leveraging zero-knowledge cryptography, users generate mathematical proofs of their credentials that verifiers can validate without accessing the actual data.

The platform integrates with India's Aadhar system as an initial identity source, though the architecture supports any government-issued or institutional credential. All heavy cryptographic computations happen client-side, with only compact proofs submitted on-chain for verification.

### Key Capabilities

**Zero-Knowledge Proof Generation**  
Generate cryptographic proofs for:
- Age verification (prove you're over 18/21 without revealing your birthdate)
- Citizenship confirmation (prove nationality without exposing identity documents)
- KYC compliance (prove identity verification without sharing personal details)
- Custom attributes (extensible framework for additional credential types)

**Blockchain-Backed Verification**  
- Proof commitments registered on Mina blockchain via DIDRegistry smart contract
- On-chain verification for age and KYC proofs through ZKPVerifier contract
- Immutable audit trail without storing sensitive data
- Merkle tree-based DID storage for efficient state management

**Passkey Authentication**  
- Biometric login using FIDO2/WebAuthn standards
- Encrypted private key storage tied to device-specific passkeys
- One passkey per wallet address for enhanced security
- No password requirements or centralized authentication

**Production-Grade Infrastructure**  
- Transaction queue with exponential backoff retry logic
- Real-time WebSocket updates for verification status
- Comprehensive error handling and user feedback
- Progressive proof generation with status indicators

## Architecture

The system follows a three-tier architecture optimized for Mina Protocol's succinct blockchain design:

### Client Layer (Browser)
The frontend handles all privacy-sensitive operations locally:
- **Proof Generation**: ZK circuits compile and execute entirely in the browser using o1js. Heavy cryptographic work happens client-side to ensure no private data leaves the user's device.
- **Credential Parsing**: Aadhar XML documents are parsed and validated locally, including UIDAI signature verification.
- **Key Management**: Private keys are encrypted with AES-GCM using passkey-derived secrets and stored in browser local storage.
- **Transaction Queue**: Failed transactions automatically retry with exponential backoff (2s, 4s, 8s intervals).

### Smart Contract Layer (Mina Blockchain)
Two primary contracts handle on-chain operations:

**DIDRegistry Contract**
- Manages decentralized identifier registration and lifecycle
- Stores DID document hashes in a Merkle tree structure for efficient verification
- Supports DID updates, ownership transfers, and revocations
- Uses `registerDIDSimple()` method for streamlined registration without separate signatures

**ZKPVerifier Contract**  
- Verifies age and KYC zero-knowledge proofs on-chain
- Validates proof commitments against expected values
- Maintains trusted issuer registry
- Configurable minimum age thresholds

All contracts are deployed on **Zeko Testnet** (L2 zkRollup on Mina Protocol):
- DIDRegistry: `B62qjbYMtue63MZjDxptNQbS1DceNUNCoSwuuadg1NNcdn1YTg9Fnrj`
- ZKPVerifier: `B62qmc9mvmg29EwS3wXw3UvSvoBGp9b4WaeHgv3c3ZJXWZaYSZTpRj6`

### Communication Layer
**WebSocket Service** (Optional)
- Real-time verification status updates
- Auto-reconnection with exponential backoff
- Message queuing for offline scenarios
- Event-driven architecture for proof verification lifecycle

The architecture deliberately keeps sensitive data off-chain while leveraging blockchain for verification integrity and immutability.

## Getting Started

### Prerequisites

Ensure you have the following installed:
- **Node.js** 18.0 or higher
- **npm** or **yarn** package manager  
- **Git** for version control
- **Auro Wallet** browser extension for Mina blockchain interaction

### Installation

Clone the repository and install dependencies for both contracts and UI:

```bash
git clone https://github.com/SuryaSundarVadali/MinaID.git
cd MinaID

# Install and build smart contracts
cd contracts
npm install
npm run build

# Generate proving/verification keys (first-time setup, ~5-10 minutes)
npm run generate-cache
npm run copy-cache  # Copies to ui/public/cache/

# Install and run UI
cd ../ui
npm install
npm run dev
```

The development server will start at `http://localhost:3000`.

### Initial Setup

Before using MinaID, you'll need test tokens:

1. Install [Auro Wallet](https://www.aurowallet.com/) browser extension
2. Create or import a wallet
3. Switch network to **Devnet** in Auro Wallet settings
4. Visit [Mina Faucet](https://faucet.minaprotocol.com/)
5. Request devnet tokens (1-2 MINA recommended)
6. Wait 3-5 minutes for transaction confirmation

### First Proof

Once set up, you can generate your first zero-knowledge proof:

1. **Upload Credential**: Click "Upload Aadhar" and select your Aadhar XML file (signed by UIDAI)
2. **Create Passkey**: Set up biometric authentication when prompted
3. **Register DID**: Confirm the transaction in Auro Wallet to register your decentralized identifier
4. **Generate Proof**: Navigate to Dashboard → "Generate Proof" and select proof type (Age/Citizenship/KYC)
5. **Submit On-Chain**: Sign the registration transaction, then (for Age/KYC) sign the verification transaction

Your proof is now registered on the blockchain and can be verified by anyone without revealing your personal data.

## Technical Deep Dive

### Zero-Knowledge Proof System

MinaID implements ZK proofs using o1js (formerly SnarkyJS), Mina's TypeScript framework for zk-SNARKs. The proof system supports three primary verification modes:

**1. Age Verification**

Proves the user is above a threshold age without revealing their exact birthdate:

```typescript
// Generate age proof (client-side)
import { AgeVerificationProgram } from '@/lib/ProofGenerator';

const proof = await AgeVerificationProgram.proveAgeAboveMinimum(
  Field(birthdate),      // User's birthdate as Field
  Field(minimumAge),     // Required minimum age (18 or 21)
  Field(currentDate)     // Current date for calculation
);

// Submit for on-chain verification
await zkpVerifier.verifyAgeProof(proof, minimumAge);
```

The circuit validates: `(currentDate - birthdate) / 365 >= minimumAge` without exposing the birthdate itself.

**2. Citizenship Verification**

Proves citizenship with case-insensitive matching:

```typescript
import { generateCitizenshipZKProof } from '@/lib/ProofGenerator';

// Generate proof
const proof = generateCitizenshipZKProof(
  'Indian',           // User's citizenship (any capitalization)
  privateKey,         // User's private key for signing
  randomSalt          // Random salt for commitment
);

// Verify proof
const isValid = verifyCitizenshipZKProof(
  'indian',           // Expected citizenship (case-insensitive)
  proof.commitment,   // Poseidon commitment
  randomSalt,         // Same salt used in generation
  proof.signature,    // Signature for authenticity
  publicKey           // User's public key
);
```

The system normalizes both input and expected values to lowercase, then creates a Poseidon hash commitment. This enables privacy-preserving verification while supporting various capitalization formats.

**3. KYC Proof**

Combines identity verification with selective disclosure:

```typescript
// Generate KYC proof with specific revealed fields
const kycProof = await generateKYCProof({
  fullName: Field(hash(name)),
  dateOfBirth: Field(birthdate),
  nationalID: Field(hash(aadharNumber)),
  // Only reveal what's necessary
  revealAge: true,
  revealCitizenship: true,
  revealName: false
});
```

### Smart Contract Implementation

**DIDRegistry Contract**

The registry maintains a Merkle tree mapping public keys to DID document hashes:

```typescript
@method registerDIDSimple(
  didDocumentHash: Field
) {
  // Verify sender signature automatically
  this.sender.getAndRequireSignature();
  
  // Get or create witness for sender's public key
  const senderKey = this.sender.getAndRequireSignature();
  const keyHash = Poseidon.hash(senderKey.toFields());
  
  // Update Merkle tree with new DID
  const currentRoot = this.didTreeRoot.get();
  this.didTreeRoot.assertEquals(currentRoot);
  
  const witness = this.didTree.getWitness(keyHash);
  const [newRoot, _] = witness.computeRootAndKey(didDocumentHash);
  
  this.didTreeRoot.set(newRoot);
}
```

This method simplifies registration by removing the separate signature parameter, relying instead on Mina's built-in transaction signature verification.

**ZKPVerifier Contract**

Handles on-chain proof verification:

```typescript
@method verifyAgeProof(
  proof: AgeProof,
  minimumAge: Field
) {
  // Verify the proof is valid
  proof.verify();
  
  // Check minimum age requirement
  proof.publicOutput.age.assertGreaterThanOrEqual(minimumAge);
  
  // Record verification
  this.verifiedProofs.set(
    Poseidon.hash(proof.publicInput),
    Bool(true)
  );
}
```

### Transaction Processing

The transaction queue implements robust error handling and retry logic:

```typescript
// From TransactionQueueService.ts
private async processTransaction(tx: QueuedTransaction): Promise<void> {
  const maxRetries = tx.maxRetries || 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      // Build and prove transaction
      const minaTx = await Mina.transaction(sender, async () => {
        await contract[tx.type](tx.data);
      });
      await minaTx.prove();
      
      // Send via Auro Wallet
      const result = await window.mina.sendTransaction({
        transaction: minaTx.toJSON(),
        feePayer: { fee: 0.1 }
      });
      
      // Monitor until confirmed
      await this.monitorTransaction(result.hash);
      
      tx.status = 'completed';
      this.onTransactionComplete(tx.id, { success: true, hash: result.hash });
      return;
      
    } catch (error) {
      attempt++;
      
      if (this.isRetryableError(error) && attempt < maxRetries) {
        // Exponential backoff: 2s, 4s, 8s
        await this.delay(Math.pow(2, attempt) * 1000);
        continue;
      }
      
      tx.status = 'failed';
      this.onTransactionComplete(tx.id, { success: false, error });
      throw error;
    }
  }
}
```

Retryable errors include network timeouts, rate limits, and temporary RPC failures. User rejections and invalid proof errors fail immediately without retry.

## Project Structure

The repository is organized into three main directories:

```
MinaID/
├── contracts/              # Smart contracts and ZK programs
│   ├── src/
│   │   ├── DIDRegistry.ts           # DID management contract
│   │   ├── ZKPVerifier.ts           # Proof verification contract  
│   │   ├── AgeVerificationProgram.ts # Age ZK circuit
│   │   └── index.ts                 # Contract exports
│   ├── scripts/
│   │   ├── deploy.ts               # Deployment script
│   │   ├── generate-cache.ts       # Cache generation
│   │   └── copy-cache-to-ui.ts    # Cache distribution
│   ├── cache/                      # Compiled circuit artifacts
│   │   ├── step-pk-*.header        # Proving keys
│   │   ├── step-vk-*.header        # Verification keys
│   │   └── README.md
│   └── package.json
│
├── ui/                     # Next.js frontend application
│   ├── app/                # Application pages (App Router)
│   │   ├── page.tsx             # Landing page
│   │   ├── layout.tsx           # Root layout
│   │   ├── signup/              # Multi-step signup flow
│   │   │   └── page.tsx
│   │   ├── login/               # Passkey authentication
│   │   │   └── page.tsx
│   │   ├── dashboard/           # User dashboard
│   │   │   └── page.tsx
│   │   ├── verifier/            # Proof verification interface
│   │   │   └── page.tsx
│   │   └── settings/            # Account management
│   │       └── page.tsx
│   │
│   ├── components/         # React components
│   │   ├── auth/
│   │   │   ├── PasskeyAuth.tsx          # Passkey creation/authentication
│   │   │   └── WalletConnect.tsx        # Auro Wallet integration
│   │   ├── dashboard/
│   │   │   ├── CredentialsCard.tsx      # Proof generation UI
│   │   │   ├── ProofHistory.tsx         # Historical proofs
│   │   │   └── VerificationStatus.tsx   # Real-time status
│   │   ├── proofs/
│   │   │   ├── DIDProofGenerator.tsx    # Proof generation logic
│   │   │   └── ProofVerifier.tsx        # Verification logic
│   │   ├── SignupOrchestrator.tsx       # Multi-step signup
│   │   ├── ProgressIndicator.tsx        # Progress tracking UI
│   │   └── ErrorBoundary.tsx            # Error handling
│   │
│   ├── lib/                # Core services and utilities
│   │   ├── ContractInterface.ts         # Smart contract interaction
│   │   ├── ProofGenerator.ts            # ZK proof generation
│   │   ├── TransactionQueueService.ts   # Transaction management
│   │   ├── WebSocketService.ts          # Real-time communication
│   │   ├── ProgressIndicatorService.ts  # Progress tracking
│   │   ├── AadharParser.ts              # Aadhar XML parsing
│   │   ├── CryptoUtils.ts               # Encryption/signing
│   │   ├── SecurityUtils.ts             # Security validations
│   │   ├── RateLimiter.ts               # Rate limiting
│   │   └── InputValidator.ts            # Input sanitization
│   │
│   ├── context/
│   │   └── WalletContext.tsx      # Wallet state management
│   │
│   ├── public/
│   │   ├── cache/                 # ZK circuit cache (copied from contracts)
│   │   └── certificates/          # UIDAI public key for verification
│   │
│   └── package.json
│
└── server/                 # WebSocket server (optional)
    ├── websocket-server.js        # Real-time event server
    └── package.json
```

### Key Files Explained

**Contract Layer**
- `DIDRegistry.ts`: Manages DID lifecycle with Merkle tree storage. Uses `registerDIDSimple()` for streamlined registration.
- `ZKPVerifier.ts`: On-chain proof verification for age and KYC proofs. Maintains trusted issuer registry.
- `AgeVerificationProgram.ts`: ZK circuit for age verification without revealing birthdate.

**Frontend Layer**
- `ContractInterface.ts`: Abstracts smart contract interaction, handles Auro Wallet communication, manages transaction creation and submission.
- `ProofGenerator.ts`: Client-side proof generation using o1js. Handles citizenship, age, and KYC proofs.
- `TransactionQueueService.ts`: Queues transactions with automatic retry logic and exponential backoff.
- `AadharParser.ts`: Parses Aadhar XML, validates UIDAI signatures, extracts demographic data.

**Services**
- `WebSocketService.ts`: Real-time updates for proof verification status. Auto-reconnection and message queuing.
- `ProgressIndicatorService.ts`: Tracks multi-step operations with progress callbacks and time estimation.
- `CryptoUtils.ts`: AES-GCM encryption for private keys using passkey-derived secrets.

## Development Workflow

### Smart Contracts

Navigate to the `contracts` directory for all contract-related operations:

```bash
cd contracts

# Build contracts
npm run build

# Run tests
npm test

# Watch mode for development
npm run build -- --watch

# Generate circuit cache (required before first deployment)
npm run generate-cache

# Copy cache to UI for browser access
npm run copy-cache

# Deploy to Zeko Testnet
npm run deploy

# Deploy to Berkeley testnet
npm run deploy berkeley
```

**Contract Development Tips:**
- Always run `generate-cache` after modifying ZK circuits
- The cache generation takes 5-10 minutes but only needs to run once unless circuits change
- Use `--watch` mode during active development to auto-rebuild on file changes
- Test locally before deploying to reduce on-chain deployment iterations

### Frontend Application

Navigate to the `ui` directory for frontend development:

```bash
cd ui

# Development server with hot reload
npm run dev

# Production build
npm run build

# Start production server
npm run start

# Type checking
npm run type-check

# Linting
npm run lint

# Run tests
npm test

# Run tests in watch mode
npm test -- --watch
```

**Frontend Development Tips:**
- The dev server runs at `http://localhost:3000` with hot module replacement
- Changes to components and pages reload automatically
- Contract interface changes require rebuilding the contracts first
- Use browser DevTools to inspect ZK proof generation in console

### WebSocket Server (Optional)

For real-time verification updates:

```bash
cd server

# Install dependencies
npm install

# Start server
node websocket-server.js

# Development mode with auto-restart
nodemon websocket-server.js

# Set custom port
PORT=8080 node websocket-server.js
```

### Environment Configuration

Create `.env.local` in the `ui` directory:

```bash
# Network Configuration
NEXT_PUBLIC_NETWORK=zeko-testnet

# Smart Contract Addresses (Zeko Testnet)
NEXT_PUBLIC_DID_REGISTRY_ZEKO_TESTNET=B62qjbYMtue63MZjDxptNQbS1DceNUNCoSwuuadg1NNcdn1YTg9Fnrj
NEXT_PUBLIC_ZKP_VERIFIER_ZEKO_TESTNET=B62qmc9mvmg29EwS3wXw3UvSvoBGp9b4WaeHgv3c3ZJXWZaYSZTpRj6

# WebSocket Server (optional)
NEXT_PUBLIC_WS_URL=ws://localhost:8080/minaid

# Application Settings
NEXT_PUBLIC_APP_NAME=MinaID
NEXT_PUBLIC_DEBUG=false
NEXT_PUBLIC_MAX_PROOF_VALIDITY=365
NEXT_PUBLIC_SESSION_DURATION=3600000
NEXT_PUBLIC_PASSKEY_TIMEOUT=60000
```

### Testing

The project includes comprehensive test suites:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- AadharParser.test.ts

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode during development
npm test -- --watch
```

Test files are located in:
- `ui/__tests__/` - Frontend unit tests
- `contracts/src/*.test.ts` - Contract and circuit tests

## API Reference

### Transaction Queue Service

Manages blockchain transaction submission with automatic retry logic:

```typescript
import { transactionQueue } from '@/lib/TransactionQueueService';

// Queue a transaction
const txId = transactionQueue.addTransaction(
  'registerDID',                    // Transaction type
  {                                 // Transaction data
    userPublicKey: publicKey.toBase58(),
    didDocument: documentHash,
  },
  (txId, result) => {              // Callback
    if (result.success) {
      console.log('Transaction confirmed:', result.transactionHash);
    } else {
      console.error('Transaction failed:', result.error);
    }
  },
  3                                 // Max retries
);

// Check transaction status
const status = transactionQueue.getTransactionStatus(txId);
// Returns: 'pending' | 'processing' | 'completed' | 'failed'

// Get pending transaction count
const pendingCount = transactionQueue.getPendingCount();

// Manually retry a failed transaction
transactionQueue.retryTransaction(txId);

// Remove transaction from queue
transactionQueue.removeTransaction(txId);

// Clear all completed transactions
transactionQueue.clearCompleted();
```

**Supported Transaction Types:**
- `registerDID` - Register new decentralized identifier
- `verifyProof` - Submit proof for on-chain verification
- `updateDID` - Update DID document
- `revokeDID` - Revoke DID (account deletion)

### WebSocket Service

Real-time communication for verification status updates:

```typescript
import { websocketService } from '@/lib/WebSocketService';

// Connect (auto-connects on initialization)
websocketService.connect();

// Subscribe to events
const unsubscribe = websocketService.on('PROOF_VERIFIED', (message) => {
  console.log('Proof verified:', message.data);
  // Handle verification completion
});

// Send event to server
websocketService.send('VERIFICATION_REQUEST', {
  proofId: 'proof_abc123',
  verifierPublicKey: publicKey.toBase58()
});

// Monitor connection state
websocketService.onStateChange((state) => {
  console.log('WebSocket state:', state);
  // States: 'connected' | 'connecting' | 'disconnected' | 'error'
});

// Disconnect when done
websocketService.disconnect();

// Cleanup subscription
unsubscribe();
```

**Available Events:**
- `PROOF_VERIFIED` - Proof verification completed
- `PROOF_FAILED` - Proof verification failed
- `VERIFICATION_REQUEST` - New verification request received
- `DID_REGISTERED` - DID registration confirmed on-chain
- `DID_UPDATED` - DID update confirmed
- `DID_REVOKED` - DID revocation confirmed
- `TRANSACTION_CONFIRMED` - Generic transaction confirmation
- `TRANSACTION_FAILED` - Generic transaction failure

### Progress Indicator Service

Track multi-step operations with progress updates:

```typescript
import { progressIndicator } from '@/lib/ProgressIndicatorService';

// Start an operation
const opId = progressIndicator.startOperation(
  'proof-generation',                          // Operation type
  'Generating citizenship proof',              // Description
  [                                            // Steps
    'Loading circuit cache',
    'Compiling ZK circuit',
    'Computing witness',
    'Generating proof'
  ],
  12000                                        // Estimated duration (ms)
);

// Update step progress
progressIndicator.updateStep(opId, 'step_0', 100);  // Complete step 0
progressIndicator.updateStep(opId, 'step_1', 50);   // Step 1 at 50%

// Complete operation
progressIndicator.completeOperation(opId, 'Proof generated successfully');

// Fail operation
progressIndicator.failOperation(opId, 'Circuit compilation failed');

// Get operation status
const operation = progressIndicator.getOperation(opId);
console.log(operation.overallProgress);  // 0-100
console.log(operation.currentStep);      // Current step index
console.log(operation.estimatedTimeRemaining);  // Milliseconds
```

### Proof Generation

Generate zero-knowledge proofs for various credentials:

```typescript
import {
  generateCitizenshipZKProof,
  verifyCitizenshipZKProof,
  generateAgeProof,
  generateKYCProof
} from '@/lib/ProofGenerator';

// Citizenship Proof (case-insensitive)
const citizenshipProof = generateCitizenshipZKProof(
  'Indian',              // User's citizenship (any case)
  privateKey,            // User's private key
  randomSalt             // Random salt for commitment
);

// Verify citizenship proof
const isValidCitizenship = verifyCitizenshipZKProof(
  'indian',              // Expected citizenship (case-insensitive)
  citizenshipProof.commitment,
  randomSalt,
  citizenshipProof.signature,
  publicKey
);

// Age Proof
const ageProof = await generateAgeProof({
  birthdate: '1990-01-15',
  minimumAge: 18,
  privateKey: privateKey
});

// KYC Proof with selective disclosure
const kycProof = await generateKYCProof({
  fullName: userData.name,
  dateOfBirth: userData.dob,
  nationalID: userData.aadharNumber,
  address: userData.address,
  revealName: false,      // Don't reveal name
  revealAge: true,        // Reveal age verification
  revealCitizenship: true // Reveal citizenship
});
```

### Contract Interface

Interact with deployed smart contracts:

```typescript
import { ContractInterface } from '@/lib/ContractInterface';

// Initialize
const contractInterface = new ContractInterface(networkConfig);

// Register DID
const txHash = await contractInterface.registerDIDSimple(
  didDocumentHash,
  userPublicKey
);

// Verify age proof on-chain
await contractInterface.verifyAgeProof(
  ageProof,
  minimumAge
);

// Verify KYC proof on-chain
await contractInterface.verifyKYCProof(
  kycProof,
  requiredFields
);

// Check if DID is registered
const isRegistered = await contractInterface.isDIDRegistered(
  publicKey
);

// Get DID document hash
const didHash = await contractInterface.getDIDDocument(
  publicKey
);

// Revoke DID
await contractInterface.revokeDID(
  publicKey,
  signature
);
```

## Security

MinaID implements multiple layers of security to protect user data and ensure system integrity:

### Authentication Security

**Passkey-Based Authentication**
- Implements FIDO2/WebAuthn standard for biometric authentication
- Private keys never leave the user's device
- One passkey enforced per wallet address to prevent credential stuffing
- Passkey challenges use cryptographically secure random generation
- 60-second timeout on passkey operations to prevent UI hijacking

**Private Key Protection**
```typescript
// Keys encrypted with AES-GCM using passkey-derived secrets
const encryptedKey = await encryptPrivateKey(
  privateKey,
  passkeyCredentialId  // Unique per device
);

// Decryption requires biometric verification
const decryptedKey = await decryptPrivateKey(
  encryptedKey,
  passkeyCredentialId  // Must match encryption credential
);
```

### Data Validation

**Aadhar Document Verification**
- UIDAI signature validation using RSA-2048 public key
- XML schema validation against official UIDAI specifications
- Demographic data extraction with type checking
- Timestamp validation to prevent replay attacks

**Input Sanitization**
```typescript
import { InputValidator } from '@/lib/InputValidator';

// All user inputs validated before processing
const validated = InputValidator.sanitize(userInput, {
  maxLength: 100,
  allowedChars: /^[a-zA-Z0-9\s-]+$/,
  trim: true
});

// XSS prevention in displayed data
const safe = InputValidator.escapeHTML(userContent);
```

**Rate Limiting**
```typescript
import { RateLimiter } from '@/lib/RateLimiter';

// Proof generation: 5 requests per 15 minutes
RateLimiter.checkLimit('proof-generation', userAddress, {
  maxRequests: 5,
  windowMs: 15 * 60 * 1000
});

// Transaction submission: 10 requests per hour
RateLimiter.checkLimit('transaction', userAddress, {
  maxRequests: 10,
  windowMs: 60 * 60 * 1000
});
```

### Zero-Knowledge Privacy

**No Data Exposure**
- Proofs reveal only the minimum information needed for verification
- Actual credentials (birthdates, names, addresses) never leave the client
- Even contract operators cannot access private data
- Poseidon hash commitments ensure data integrity without exposure

**Selective Disclosure**
```typescript
// User controls exactly what is revealed
const proof = generateKYCProof({
  name: userData.name,
  dob: userData.dob,
  citizenship: userData.citizenship,
  // Selective revelation flags
  revealName: false,        // Name stays private
  revealAgeOnly: true,      // Only reveal age verification
  revealCitizenship: true   // Reveal citizenship
});
```

### Smart Contract Security

**Access Control**
- DID updates require signature from registered owner
- Ownership transfers validated on-chain
- Contract upgrades protected by multi-sig (planned)

**Merkle Tree Integrity**
- DID registry uses Merkle tree for efficient verification
- Root hash stored on-chain prevents tampering
- Witnesses validated cryptographically

**Reentrancy Protection**
- No external contract calls in state-changing methods
- All state updates atomic within single transaction
- No delegatecalls to untrusted code

### Operational Security

**Security Event Logging**
```typescript
import { SecurityLogger } from '@/lib/SecurityUtils';

// All security-relevant events logged
SecurityLogger.log('FAILED_AUTH_ATTEMPT', {
  address: userAddress,
  timestamp: Date.now(),
  reason: 'Invalid signature'
});

SecurityLogger.log('PROOF_GENERATED', {
  proofType: 'age',
  address: userAddress,
  timestamp: Date.now()
});
```

**Browser Security**
- Content Security Policy (CSP) headers configured
- Cross-Origin Resource Sharing (CORS) restricted
- HTTPS enforced in production
- No eval() or unsafe inline scripts

### Known Limitations

- **Local Storage**: Private keys stored in browser localStorage encrypted with passkey-derived keys. Users should not clear browser data without backing up keys.
- **Client-Side Trust**: Proof generation happens client-side, trusting the user's browser environment. Compromised browsers could expose private keys.
- **Zeko Testnet Deployment**: Current contracts deployed on Zeko Testnet (L2 on Mina) for testing. Mainnet deployment requires security audit.
- **Single Device**: Passkeys are device-specific. Account recovery across devices requires additional implementation.

## Deployment

### Smart Contract Deployment

Deploy contracts to Zeko Testnet or other Mina-compatible networks:

```bash
cd contracts

# Generate cache if not already done
npm run generate-cache
npm run copy-cache

# Deploy to Zeko Testnet
npm run deploy

# Deploy to Berkeley testnet
npm run deploy berkeley
```

The deployment script will:
1. Compile all smart contracts
2. Generate deployment keys (if not exist)
3. Fund feepayer account (requires manual faucet request)
4. Deploy DIDRegistry contract
5. Deploy ZKPVerifier contract
6. Output contract addresses
7. Update environment configuration

**Current Devnet Deployment:**
- DIDRegistry: `B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD`
- ZKPVerifier: `B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw`
- Network: Mina Devnet
- Deployed: December 8, 2025

### Frontend Deployment

**Vercel (Recommended)**

1. Install Vercel CLI:
```bash
npm install -g vercel
```

2. Deploy from UI directory:
```bash
cd ui
vercel --prod
```

3. Configure environment variables in Vercel dashboard:
```
NEXT_PUBLIC_NETWORK=zeko-testnet
NEXT_PUBLIC_DID_REGISTRY_ZEKO_TESTNET=B62qjbYMtue63MZjDxptNQbS1DceNUNCoSwuuadg1NNcdn1YTg9Fnrj
NEXT_PUBLIC_ZKP_VERIFIER_ZEKO_TESTNET=B62qmc9mvmg29EwS3wXw3UvSvoBGp9b4WaeHgv3c3ZJXWZaYSZTpRj6
```

**Alternative: Self-Hosted**

```bash
cd ui

# Build production bundle
npm run build

# Start production server
npm run start

# Or use PM2 for process management
pm2 start npm --name "minaid-ui" -- start
```

### WebSocket Server Deployment

**Heroku**

1. Create Heroku app:
```bash
heroku create minaid-websocket
```

2. Deploy:
```bash
cd server
git push heroku main
```

3. Set environment variables:
```bash
heroku config:set PORT=8080
heroku config:set NODE_ENV=production
```

**Alternative: Docker**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --only=production
COPY server/ ./
EXPOSE 8080
CMD ["node", "websocket-server.js"]
```

Deploy to any container platform (AWS ECS, Google Cloud Run, Azure Container Instances).

### Environment Variables

Create environment-specific configurations:

**Production (.env.production)**
```bash
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_DID_REGISTRY_MAINNET=<mainnet-address>
NEXT_PUBLIC_ZKP_VERIFIER_MAINNET=<mainnet-address>
NEXT_PUBLIC_WS_URL=wss://ws.minaid.app/minaid
NEXT_PUBLIC_DEBUG=false
```

**Development (.env.local)**
```bash
NEXT_PUBLIC_NETWORK=zeko-testnet
NEXT_PUBLIC_DID_REGISTRY_ZEKO_TESTNET=B62qjbYMtue63MZjDxptNQbS1DceNUNCoSwuuadg1NNcdn1YTg9Fnrj
NEXT_PUBLIC_ZKP_VERIFIER_ZEKO_TESTNET=B62qmc9mvmg29EwS3wXw3UvSvoBGp9b4WaeHgv3c3ZJXWZaYSZTpRj6
NEXT_PUBLIC_WS_URL=ws://localhost:8080/minaid
NEXT_PUBLIC_DEBUG=true
```

### Post-Deployment Verification

Run verification script after deployment:

```bash
node verify-deployment.js
```

This checks:
- ✓ Contract addresses match deployment
- ✓ Contracts are accessible on-chain
- ✓ Environment variables correctly set
- ✓ WebSocket server reachable
- ✓ Circuit cache files present

### Updating Contract Addresses

If contracts are redeployed, update addresses in:

1. **Codebase:**
   - `ui/lib/ContractInterface.ts` - DEFAULT_CONFIG
   - `ui/lib/BlockchainHelpers.ts` - NETWORK_CONFIG
   - `verify-deployment.js` - CORRECT_ADDRESSES

2. **Vercel:**
   - Go to project settings → Environment Variables
   - Update `NEXT_PUBLIC_DID_REGISTRY_DEVNET`
   - Update `NEXT_PUBLIC_ZKP_VERIFIER_DEVNET`
   - Redeploy: `vercel --prod`

3. **GitHub Secrets (if using CI/CD):**
   - Repository Settings → Secrets → Actions
   - Update contract address secrets
   - Workflow will use updated values on next run

## Performance Optimization

### Current Performance Metrics

| Operation | Duration | Target | Status |
|-----------|----------|--------|--------|
| Circuit Compilation (cached) | ~2-5s | <5s | ✓ Achieved |
| Circuit Compilation (first run) | ~30s | <10s | In Progress |
| Citizenship Proof Generation | <1s | <2s | ✓ Achieved |
| Age Proof Generation | 5-8s | 5-10s | ✓ Achieved |
| KYC Proof Generation | 8-12s | 10-15s | ✓ Achieved |
| DID Registration (on-chain) | 20-30s | 20-30s | ✓ Achieved |
| Proof Verification (on-chain) | 30-60s | 30-60s | ✓ Achieved |
| UI Responsiveness | <100ms | <100ms | ✓ Achieved |

### Optimization Strategies

**1. Circuit Caching**

Pre-compiled circuit artifacts are cached to avoid recompilation:

```typescript
// Cache is stored in ui/public/cache/
const cache = await fetch('/cache/step-pk-age-verification.header');
await AgeVerificationProgram.compile({ cache });
```

**Benefits:**
- First compilation: ~30 seconds
- Subsequent compilations: ~2-5 seconds
- 85% reduction in compilation time

**2. Progressive Loading**

Heavy operations broken into smaller steps with progress feedback:

```typescript
progressIndicator.startOperation('proof-generation', 'Generating proof', [
  'Loading circuit cache',      // 10% - Quick fetch
  'Compiling circuit',           // 40% - Heaviest operation
  'Computing witness',           // 30% - Moderate
  'Generating proof'             // 20% - Quick finalization
]);
```

**3. Web Worker Implementation** (Planned)

Move proof generation to background thread:

```typescript
// Planned implementation
const worker = new Worker('/workers/proof-generator.js');
worker.postMessage({ type: 'generateAgeProof', data: proofData });
worker.onmessage = (e) => {
  const proof = e.data.proof;
  // UI remains responsive during generation
};
```

**Expected improvements:**
- Zero UI blocking during proof generation
- Parallel proof generation for multiple credentials
- Better mobile device performance

**4. Transaction Batching** (Planned)

Combine multiple operations into single transaction:

```typescript
// Future implementation
const batchTx = await Mina.transaction(sender, async () => {
  await didRegistry.registerDID(did1);
  await didRegistry.registerDID(did2);
  await zkpVerifier.verifyProof(proof1);
});
```

**Expected benefits:**
- Reduced total transaction time by 40%
- Lower total transaction fees
- Atomic multi-operation commits

### Network Optimization

**GraphQL Query Optimization**
- Batch queries when possible to reduce round trips
- Use specific field selection to minimize payload size
- Implement query result caching with 30-second TTL

**WebSocket Efficiency**
- Heartbeat every 30 seconds (vs. typical 10s) to reduce overhead
- Message batching for burst scenarios
- Automatic reconnection with exponential backoff (max 32s)

### Database Optimization (When Applicable)

For applications that add a backend database:

- Index on `publicKey`, `didHash`, `timestamp` fields
- Partition proof history tables by month
- Archive proofs older than 1 year to cold storage
- Use connection pooling (max 20 connections)

## Troubleshooting

### Common Issues and Solutions

**Issue: "Failed to compile circuit"**

```
Error: Cannot find module '/cache/step-pk-age-verification'
```

**Solution:**
```bash
cd contracts
npm run generate-cache
npm run copy-cache
cd ../ui
npm run build
```

The cache files must be generated before proof generation can work.

---

**Issue: "Invalid signature" during DID registration**

```
Error: Bool.assertTrue(): false != true
```

**Solution:**
This was resolved in the December 8, 2025 update. Ensure you're using the latest contract deployment:
- DIDRegistry: `B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD`

If still seeing this error:
1. Clear browser localStorage
2. Reconnect Auro Wallet
3. Ensure you're on Devnet network
4. Check contract address in browser console

---

**Issue: "Transaction timeout" or "Transaction pending too long"**

**Solution:**
This is normal on Devnet during high load. The transaction queue will automatically retry:
- Retry 1: after 2 seconds
- Retry 2: after 4 seconds  
- Retry 3: after 8 seconds

Monitor transaction on [Minascan](https://minascan.io/devnet/tx/<hash>) to see actual status.

---

**Issue: "Auro Wallet not found"**

**Solution:**
1. Install [Auro Wallet extension](https://www.aurowallet.com/)
2. Refresh the page
3. Click "Connect Wallet" again

For mobile users, Auro Wallet is not yet available. Use desktop browser.

---

**Issue: "Proof generation stuck at 'Compiling circuit'"**

**Solution:**
First-time compilation takes 20-30 seconds. If stuck longer than 60 seconds:

1. Check browser console for errors
2. Verify cache files loaded: Check Network tab for `/cache/*.header` requests
3. Try clearing browser cache and reload
4. Ensure sufficient device resources (4GB+ RAM recommended)

---

**Issue: "Network error" or "GraphQL error"**

**Solution:**
```bash
# Check network configuration
echo $NEXT_PUBLIC_NETWORK  # Should be 'devnet'

# Verify GraphQL endpoint is accessible
curl https://api.minascan.io/node/devnet/v1/graphql
```

If endpoint is down, wait a few minutes and retry. Devnet occasionally undergoes maintenance.

---

**Issue: "Passkey creation failed"**

**Solution:**
Passkeys require:
- HTTPS (or localhost for development)
- Browser support (Chrome 67+, Safari 16+, Firefox 60+)
- Hardware support (Touch ID, Windows Hello, or external security key)

If still failing:
1. Check browser compatibility
2. Ensure no browser extensions blocking WebAuthn
3. Try incognito/private mode
4. Use different device if hardware doesn't support biometrics

---

**Issue: "WebSocket connection failed"**

**Solution:**
The WebSocket server is optional. If you're not running it:

1. Set `NEXT_PUBLIC_WS_URL=""` to disable
2. Or start the server:
```bash
cd server
npm install
node websocket-server.js
```

For production, ensure WebSocket URL uses `wss://` (secure WebSocket).

---

**Issue: "Insufficient balance" error**

**Solution:**
Request tokens from [Mina Faucet](https://faucet.minaprotocol.com/):

1. Copy your wallet address from Auro Wallet
2. Paste in faucet form
3. Wait 3-5 minutes for tokens to arrive
4. Verify balance in Auro Wallet shows 1+ MINA

Typical transaction costs ~0.1 MINA.

---

**Issue: Build errors after pulling latest code**

**Solution:**
```bash
# Clean and reinstall dependencies
cd contracts
rm -rf node_modules build
npm install
npm run build

cd ../ui
rm -rf node_modules .next
npm install
npm run build
```

---

### Getting Help

If your issue isn't listed above:

1. **Check Browser Console**: Press F12 and look for error messages
2. **Check Contract Status**: Visit [Minascan](https://minascan.io/devnet/home) to verify contracts are accessible
3. **Check GitHub Issues**: Search [existing issues](https://github.com/SuryaSundarVadali/MinaID/issues)
4. **Create New Issue**: Include:
   - Operating system and browser version
   - Steps to reproduce the error
   - Full error message from console
   - Screenshots if applicable

### Debug Mode

Enable debug logging:

```bash
# In ui/.env.local
NEXT_PUBLIC_DEBUG=true
```

This will log:
- Transaction details to console
- Proof generation steps
- Contract interaction details
- WebSocket messages

Remember to disable debug mode in production.

## Roadmap

### Completed

**Phase 1: Core Infrastructure** ✓
- Decentralized identifier (DID) registration and management
- Smart contract deployment (DIDRegistry, ZKPVerifier)
- Merkle tree-based DID storage
- Basic proof generation (citizenship, age, KYC)

**Phase 2: User Experience** ✓
- Passkey authentication with FIDO2/WebAuthn
- Multi-step signup and onboarding flow
- Aadhar XML parsing and UIDAI signature verification
- Browser-based key management with AES-GCM encryption

**Phase 3: Production Features** ✓
- Transaction queue with exponential backoff retry
- Real-time WebSocket service for verification updates
- Progress indicators for long-running operations
- Comprehensive error handling and user feedback
- Account deletion with DID revocation

**Phase 4: Reliability** ✓ (December 2025)
- Fixed "Invalid signature" error with registerDIDSimple method
- Resolved MerkleMapWitness length errors
- Added pre-submission validation
- Enhanced transaction monitoring
- Rate limiting and security logging

### In Progress

**Phase 5: Performance Optimization** (Q1 2026)
- Web Workers for non-blocking proof generation
- Advanced circuit caching strategies (<5s compilation)
- Transaction batching for reduced fees
- GraphQL query optimization
- Mobile device performance improvements

**Phase 6: Enhanced Privacy** (Q1 2026)
- Credential revocation without revealing identity
- Encrypted proof storage with user-controlled keys
- Anonymous credential issuance
- Proof delegation mechanism

### Planned

**Phase 7: Expanded Credentials** (Q2 2026)
- Educational credentials (degree verification)
- Professional credentials (employment history)
- Financial credentials (credit score, income verification)
- Health credentials (vaccination status, blood type)
- Custom credential templates for issuers

**Phase 8: Cross-Chain Support** (Q2-Q3 2026)
- Ethereum/Polygon bridge for wider adoption
- Cross-chain proof verification
- Multi-chain DID synchronization
- Universal resolver for DID documents

**Phase 9: Mobile Applications** (Q3 2026)
- React Native mobile app (iOS/Android)
- Biometric authentication on mobile devices
- QR code-based proof sharing
- Push notifications for verification requests
- Offline proof generation with sync

**Phase 10: Ecosystem Development** (Q4 2026)
- Verifiable credentials marketplace
- Issuer dashboard for organizations
- Verifier SDK for easy integration
- Developer API with comprehensive documentation
- OAuth-style proof request flow

**Phase 11: Advanced Features** (2027)
- Social recovery for account access
- Multi-signature DID management
- Proof expiration and renewal
- Compliance reporting tools
- Analytics dashboard for issuers

**Phase 12: Enterprise Solutions** (2027)
- Enterprise SSO integration
- Bulk credential issuance
- Audit trail and compliance reporting
- SLA guarantees for verifiers
- White-label solutions

### Research Areas

Ongoing research into:
- **Recursive proof composition**: Combine multiple proofs into one
- **Quantum-resistant cryptography**: Future-proof against quantum computers
- **Improved ZK circuits**: More efficient proving times
- **Layer 2 scaling**: Faster transaction finality
- **Interoperability standards**: W3C DID compliance

### Community Requests

We track feature requests from the community. Top requests include:
- Email/SMS credential verification
- Social media account linking
- Professional networking integration
- Decentralized reputation scores
- Proof templates library

Submit feature requests via [GitHub Issues](https://github.com/SuryaSundarVadali/MinaID/issues) with the `enhancement` label.

## Contributing

We welcome contributions from the community. Whether you're fixing bugs, adding features, improving documentation, or suggesting enhancements, your input helps make MinaID better for everyone.

### Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/MinaID.git
   cd MinaID
   ```
3. **Create a feature branch**:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Install dependencies** and set up the development environment (see Getting Started section)

### Development Guidelines

**Code Style**
- Follow existing TypeScript conventions
- Use meaningful variable and function names
- Add JSDoc comments for public APIs
- Keep functions focused and under 50 lines when possible
- Run linter before committing: `npm run lint`

**Testing**
- Write tests for new features
- Ensure existing tests pass: `npm test`
- Add integration tests for contract interactions
- Test on both Devnet and local blockchain

**Commit Messages**
Follow conventional commits format:
```
type(scope): brief description

Detailed explanation of what changed and why.

Fixes #123
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
```
feat(proofs): add education credential verification
fix(auth): resolve passkey timeout on Safari
docs(api): update proof generation examples
```

**Pull Request Process**

1. **Update documentation** if you're changing behavior
2. **Add tests** for new functionality
3. **Update CHANGELOG.md** with your changes
4. **Ensure CI passes** all checks
5. **Request review** from maintainers
6. **Address feedback** promptly

**Pull Request Template:**
```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tested locally on Devnet
- [ ] Added unit tests
- [ ] Added integration tests
- [ ] Tested on multiple browsers

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-reviewed code
- [ ] Commented complex logic
- [ ] Updated documentation
- [ ] No new warnings
```

### Areas for Contribution

**High Priority**
- Web Worker implementation for proof generation
- Mobile responsiveness improvements
- Additional proof types (education, employment)
- Performance optimization for circuit compilation
- Improved error messages and user guidance

**Good First Issues**
- Documentation improvements
- UI/UX enhancements
- Test coverage expansion
- Example code and tutorials
- Bug fixes (check issues labeled `good-first-issue`)

**Advanced Contributions**
- Smart contract optimizations
- New ZK circuits for custom proofs
- Cross-chain integration
- Privacy enhancements
- Security auditing

### Bug Reports

Create detailed bug reports including:

```markdown
**Describe the bug**
Clear description of what's wrong

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What should happen

**Screenshots**
If applicable, add screenshots

**Environment:**
- OS: [e.g. macOS 13.0]
- Browser: [e.g. Chrome 120]
- Version: [e.g. commit hash or release]

**Additional context**
Error messages, console logs, etc.
```

### Feature Requests

Suggest new features with:

```markdown
**Is your feature request related to a problem?**
Description of the problem

**Describe the solution you'd like**
What you want to happen

**Describe alternatives you've considered**
Other approaches you thought about

**Additional context**
Mockups, examples, use cases
```

### Code Review Process

All submissions require review:
1. Automated checks must pass (linting, tests, build)
2. At least one maintainer approval required
3. All conversations must be resolved
4. Squash and merge into main branch

Maintainers aim to review within 48 hours.

### Community Guidelines

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow
- Assume good intentions
- Follow the [Code of Conduct](./CODE_OF_CONDUCT.md)

### Recognition

Contributors are recognized in:
- README acknowledgments section
- Release notes for their contributions
- Contributor badge on GitHub profile

Significant contributors may be invited to join the core team.

### License

By contributing, you agree that your contributions will be licensed under the MIT License.

## License

This project is licensed under the MIT License. You are free to use, modify, and distribute this software, subject to the terms and conditions outlined in the [LICENSE](./LICENSE) file.

### Key Points

- **Commercial use** permitted
- **Modification** permitted
- **Distribution** permitted
- **Private use** permitted
- **No warranty** provided
- **No liability** assumed by authors

See the full license text for complete terms.

---

## Acknowledgments

MinaID builds upon the work of many contributors and projects:

**Core Technologies**
- **[Mina Protocol](https://minaprotocol.com/)** - Succinct blockchain enabling efficient zero-knowledge proofs
- **[o1js](https://docs.minaprotocol.com/zkapps/o1js)** - TypeScript framework for building zk-SNARKs
- **[Next.js](https://nextjs.org/)** - React framework for production-grade web applications
- **[React](https://react.dev/)** - JavaScript library for building user interfaces

**Cryptography & Identity Standards**
- **[FIDO Alliance](https://fidoalliance.org/)** - WebAuthn/FIDO2 passkey authentication standards
- **[W3C DID](https://www.w3.org/TR/did-core/)** - Decentralized identifier specification
- **[UIDAI](https://uidai.gov.in/)** - Aadhar infrastructure and authentication framework

**Development Tools**
- **[TypeScript](https://www.typescriptlang.org/)** - Type-safe JavaScript superset
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Vercel](https://vercel.com/)** - Deployment and hosting platform
- **[Auro Wallet](https://www.aurowallet.com/)** - Mina Protocol wallet for browser

**Community Support**
- Mina Protocol Discord community for technical guidance
- Early testers and bug reporters
- Documentation reviewers and contributors
- Feature request participants

Special thanks to all contributors who have helped shape this project through code, documentation, testing, and feedback.

---

## Contact & Support

### Documentation
- **Getting Started**: See installation section above
- **API Documentation**: Review API Reference section
- **Deployment Guide**: Check Deployment section
- **Troubleshooting**: See Troubleshooting section

### Community Channels
- **GitHub Issues**: [Report bugs or request features](https://github.com/SuryaSundarVadali/MinaID/issues)
- **GitHub Discussions**: [Ask questions and share ideas](https://github.com/SuryaSundarVadali/MinaID/discussions)
- **Mina Discord**: [Join #zkapps channel](https://discord.gg/minaprotocol)

### Project Links
- **Live Demo**: [mina-id-suryasundarvadalis-projects.vercel.app](https://mina-id-suryasundarvadalis-projects.vercel.app)
- **GitHub Repository**: [github.com/SuryaSundarVadali/MinaID](https://github.com/SuryaSundarVadali/MinaID)
- **Contract Explorer**: [Devnet on Minascan](https://minascan.io/devnet/home)

### Security Issues

If you discover a security vulnerability, please **do not** open a public issue. Instead:

1. Email security concerns to: [Your security email]
2. Include detailed description and steps to reproduce
3. Allow 48 hours for initial response
4. Coordinate disclosure timing with maintainers

We take security seriously and will respond promptly to valid reports.

### Professional Services

For enterprise deployments, custom integrations, or consulting:
- Contact via GitHub Discussions for preliminary inquiry
- Professional support packages available for production deployments
- White-label solutions for organizations

---

## Project Status

**Current Version**: 1.0.0 (December 2025)  
**Status**: Active Development  
**Network**: Mina Devnet  
**Production Ready**: Beta

**Latest Updates:**
- ✅ December 8, 2025: Fixed signature validation errors
- ✅ December 7, 2025: Deployed updated contracts to Devnet
- ✅ December 2025: Added transaction queue and WebSocket support
- ✅ November 2025: Implemented passkey authentication
- ✅ October 2025: Initial DID and proof system launch

**Next Milestone**: Web Worker integration for non-blocking proofs (Q1 2026)

Follow the repository for updates and announcements.

---

**Built with privacy and security in mind**  
**Powered by Mina Protocol**

[⬆ Back to Top](#minaid)
