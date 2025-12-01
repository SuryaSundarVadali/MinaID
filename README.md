# MinaID - Decentralized Identity on Mina Protocol

> Privacy-preserving digital identity with zero-knowledge proofs

MinaID is a production-grade decentralized identity (DID) system built on Mina Protocol that enables users to verify their identity and credentials without revealing sensitive information using zero-knowledge proofs.

## ✨ Features

### Core Features
- 🔐 **Decentralized Identity (DID)** - Self-sovereign identity on Mina blockchain
- 🔑 **Passkey Authentication** - Biometric login with FIDO2/WebAuthn
- 🛡️ **Zero-Knowledge Proofs** - Prove credentials without revealing data
- 📄 **Aadhar Integration** - Parse and verify Indian Aadhar XML documents
- ✅ **Selective Disclosure** - Share only what's necessary

### Proof Types
- **Citizenship Proof** - Prove nationality without revealing full identity (case-insensitive)
- **Age Proof** - Prove age > 18 or 21 without revealing exact date of birth
- **Custom Proofs** - Extensible framework for additional credential types

### Production Features
- ⚡ **Transaction Queue** - Retry logic with exponential backoff
- 🔄 **Real-Time Updates** - WebSocket for instant verification status
- 📊 **Progress Tracking** - Step-by-step progress indicators
- 🗑️ **Account Deletion** - Complete data removal with DID revocation
- 💾 **Offline Support** - Queue transactions when offline (planned)
- 🚀 **Performance** - Circuit caching for fast proof generation (planned)

## 🏗️ Architecture

```
┌─────────────────┐
│   Frontend UI   │  Next.js 14 + React 18
│  (ui/)          │  - Passkey authentication
│                 │  - Transaction queue
│                 │  - Progress indicators
└────────┬────────┘
         │
         ├─── WebSocket ───┐
         │                 │
         ▼                 ▼
┌─────────────────┐  ┌─────────────────┐
│  Smart Contracts│  │  WebSocket      │
│  (contracts/)   │  │  Server         │
│                 │  │                 │
│  - DIDRegistry  │  │  - Real-time    │
│  - ZKPVerifier  │  │    events       │
│  - ZkPrograms   │  │  - Auto-reconnect│
└────────┬────────┘  └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Mina Protocol  │  Off-chain computation
│  Blockchain     │  On-chain verification
└─────────────────┘
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/SuryaSundarVadali/MinaID.git
cd MinaID

# Install contracts dependencies
cd contracts
npm install

# Generate circuit cache (takes ~5-10 minutes first time)
npm run generate-cache
npm run copy-cache

# Install UI dependencies
cd ../ui
npm install

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Fund Test Account

Before using MinaID, fund your account from the [Mina Faucet](https://faucet.minaprotocol.com/):
1. Connect Auro Wallet
2. Request devnet tokens
3. Wait 3-5 minutes for confirmation

## 📖 Documentation

- **[Deployment Guide](./DEPLOYMENT.md)** - Complete deployment instructions
- **[Production Features](./PRODUCTION_FEATURES.md)** - Production implementation details
- **[API Reference](./API_REFERENCE.md)** - Service and component API documentation
- **[Citizenship ZK Proof](./CITIZENSHIP_ZK_PROOF.md)** - Zero-knowledge proof implementation

## 🛠️ Project Structure

```
MinaID/
├── contracts/              # Smart contracts & ZK programs
│   ├── src/
│   │   ├── DIDRegistry.ts       # DID registration contract
│   │   ├── ZKPVerifier.ts       # Proof verification contract
│   │   ├── AgeVerificationProgram.ts  # Age ZK program
│   │   └── CitizenshipProof.ts        # Citizenship ZK program
│   ├── cache/             # Compiled circuit artifacts
│   └── scripts/           # Deployment scripts
│
├── ui/                    # Next.js frontend
│   ├── app/              # App router pages
│   │   ├── page.tsx           # Homepage
│   │   ├── signup/            # Signup flow
│   │   ├── login/             # Login flow
│   │   ├── dashboard/         # User dashboard
│   │   ├── verifier/          # Verifier dashboard
│   │   └── settings/          # Settings & account deletion
│   │
│   ├── components/       # React components
│   │   ├── SignupOrchestrator.tsx      # Multi-step signup
│   │   ├── Login.tsx                   # Passkey authentication
│   │   ├── ProgressIndicator.tsx       # Progress tracking UI
│   │   ├── AccountDeletion.tsx         # Account deletion flow
│   │   └── ...
│   │
│   └── lib/              # Core services
│       ├── TransactionQueueService.ts  # Transaction queue
│       ├── WebSocketService.ts         # Real-time updates
│       ├── ProgressIndicatorService.ts # Progress tracking
│       ├── ProofGenerator.ts           # ZK proof generation
│       ├── CryptoUtils.ts             # Encryption utilities
│       ├── AadharParser.ts            # Aadhar XML parser
│       └── ContractInterface.ts       # Smart contract interface
│
└── server/               # WebSocket server (optional)
    └── websocket-server.js
```

## 🔧 Development

### Contracts

```bash
cd contracts

# Build contracts
npm run build

# Run tests
npm test

# Watch mode
npm run build -- --watch

# Generate cache
npm run generate-cache
```

### UI

```bash
cd ui

# Development server
npm run dev

# Production build
npm run build
npm run start

# Type checking
npm run type-check

# Linting
npm run lint
```

### WebSocket Server

```bash
cd server

# Start server
node websocket-server.js

# With auto-restart
nodemon websocket-server.js
```

## 📝 Usage Examples

### Register New Account

1. **Connect Wallet** - Connect Auro Wallet
2. **Upload Aadhar** - Upload Aadhar XML (signed by UIDAI)
3. **Create Passkey** - Biometric authentication setup
4. **Register DID** - Submit to blockchain

### Generate Proof

```typescript
import { generateCitizenshipProof } from '@/lib/ProofGenerator';

// Generate citizenship proof
const proof = await generateCitizenshipProof(
  'Indian',        // Your citizenship
  'Indian',        // Expected citizenship
  'unique-salt'    // Random salt
);

// Share proof with verifier
```

### Verify Proof

```typescript
import { verifyCitizenshipProof } from '@/lib/ProofGenerator';

// Verify proof
const isValid = await verifyCitizenshipProof(
  proof,
  'Indian',      // Expected citizenship
  'unique-salt'  // Same salt used in generation
);

console.log(isValid ? '✓ Valid' : '✗ Invalid');
```

## 🔐 Security Features

- ✅ **Passkey Authentication** - FIDO2/WebAuthn biometric login
- ✅ **Private Key Encryption** - AES-GCM with passkey-derived keys
- ✅ **One-Passkey-Per-Wallet** - Enforced at signup
- ✅ **UIDAI Signature Verification** - Validates Aadhar authenticity
- ✅ **Zero-Knowledge Proofs** - Privacy-preserving verification
- ✅ **Input Validation** - Sanitize all user inputs
- ✅ **Rate Limiting** - Prevent brute force attacks
- ✅ **Security Event Logging** - Audit trail
- ✅ **Browser-Compatible Crypto** - No Node.js dependencies in frontend

## 🚢 Deployment

### Quick Deploy

**Contracts to Devnet**:
```bash
cd contracts
npm run deploy devnet
```

**Frontend to Vercel**:
```bash
cd ui
vercel --prod
```

**WebSocket to Heroku**:
```bash
cd server
git push heroku main
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete instructions.

## 📊 Performance Targets

| Operation | Current | Target | Status |
|-----------|---------|--------|--------|
| Circuit Compilation | ~30s | <5s | ⏳ Pending (caching) |
| Proof Generation | Variable | 5-10s | ⏳ Pending (Web Worker) |
| DID Registration | 20-30s | 20-30s | ✅ Achieved |
| Proof Verification | 30-60s | 30-60s | ✅ Achieved |
| UI Responsiveness | Good | <100ms | ✅ Achieved |

## 🗺️ Roadmap

### Completed ✅
- [x] Core DID functionality
- [x] Passkey authentication
- [x] Citizenship & age proofs
- [x] Transaction queue with retry
- [x] Real-time WebSocket service
- [x] Progress indicators
- [x] Account deletion flow

### In Progress 🚧
- [ ] Web Worker for non-blocking proof generation
- [ ] Circuit compilation caching (<5s)
- [ ] Smart contract optimization
- [ ] Offline support with automatic sync

### Planned 📋
- [ ] Mobile app (React Native)
- [ ] Additional proof types (education, employment)
- [ ] Multi-chain support
- [ ] Verifiable credentials marketplace
- [ ] Social recovery for account access

## 🤝 Contributing

Contributions welcome! Please read [CONTRIBUTING.md](./CONTRIBUTING.md) first.

### Development Workflow

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **Mina Protocol** - Succinct blockchain with ZK proofs
- **o1js** - TypeScript framework for ZK circuits
- **UIDAI** - Aadhar authentication infrastructure
- **FIDO Alliance** - Passkey/WebAuthn standards

## 📞 Support

- **Documentation**: [Full docs](./DEPLOYMENT.md)
- **Issues**: [GitHub Issues](https://github.com/SuryaSundarVadali/MinaID/issues)
- **Discord**: [Mina Protocol Discord](https://discord.gg/minaprotocol)
- **Email**: support@minaid.app (if applicable)

## 🌟 Star History

If you find MinaID useful, please star the repository!

---

**Built with ❤️ using Mina Protocol**

[Website](https://minaid.app) • [Docs](./DEPLOYMENT.md) • [GitHub](https://github.com/SuryaSundarVadali/MinaID)
