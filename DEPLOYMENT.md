# MinaID Deployment Guide

Complete guide for deploying smart contracts and running the MinaID application.

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Smart Contract Deployment](#smart-contract-deployment)
3. [Frontend Deployment](#frontend-deployment)
4. [WebSocket Server Setup](#websocket-server-setup)
5. [Local Development](#local-development)
6. [Production Deployment](#production-deployment)
7. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software
```bash
# Node.js (v18 or higher)
node --version  # Should be >= 18.0.0

# npm or yarn
npm --version

# Git
git --version
```

### Install Dependencies

**Contracts**:
```bash
cd contracts
npm install
```

**UI**:
```bash
cd ui
npm install
```

---

## Smart Contract Deployment

### 1. Generate Cache (First Time Only)

The cache contains compiled circuit artifacts and significantly speeds up subsequent compilations.

```bash
cd contracts

# Generate cache for all contracts (takes ~5-10 minutes first time)
npm run generate-cache
```

This creates files in `contracts/cache/`:
- `step-pk-add-settlestate` - Proving key
- `step-vk-add-settlestate` - Verification key
- `wrap-pk-add` - Wrapper proving key
- `wrap-vk-add` - Wrapper verification key

### 2. Copy Cache to UI

```bash
# Still in contracts directory
npm run copy-cache

# This copies cache/ to ui/public/cache/ for browser access
```

### 3. Configure Network

Edit `contracts/config.json`:

```json
{
  "version": 1,
  "deployAliases": {
    "devnet": {
      "url": "https://api.minascan.io/node/devnet/v1/graphql",
      "keyPath": "keys/devnet.json",
      "fee": "0.1",
      "feepayerKeyPath": "keys/devnet-feepayer.json",
      "feepayerAlias": "devnet-feepayer"
    },
    "berkeley": {
      "url": "https://api.minascan.io/node/berkeley/v1/graphql",
      "keyPath": "keys/berkeley.json",
      "fee": "0.1",
      "feepayerKeyPath": "keys/berkeley-feepayer.json",
      "feepayerAlias": "berkeley-feepayer"
    }
  }
}
```

### 4. Generate Deployment Keys

```bash
# Create keys directory
mkdir -p contracts/keys

# Generate keys for devnet
cd contracts
npx tsx scripts/generate-keys.ts devnet

# This creates:
# - keys/devnet.json (deployer private key)
# - keys/devnet-feepayer.json (fee payer private key)
```

**Create `scripts/generate-keys.ts`** (if not exists):
```typescript
import { PrivateKey } from 'o1js';
import fs from 'fs';

const network = process.argv[2] || 'devnet';

const deployerKey = PrivateKey.random();
const feepayerKey = PrivateKey.random();

const deployerData = {
  privateKey: deployerKey.toBase58(),
  publicKey: deployerKey.toPublicKey().toBase58()
};

const feepayerData = {
  privateKey: feepayerKey.toBase58(),
  publicKey: feepayerKey.toPublicKey().toBase58()
};

fs.writeFileSync(
  `keys/${network}.json`,
  JSON.stringify(deployerData, null, 2)
);

fs.writeFileSync(
  `keys/${network}-feepayer.json`,
  JSON.stringify(feepayerData, null, 2)
);

console.log(`✓ Generated keys for ${network}`);
console.log(`Deployer address: ${deployerData.publicKey}`);
console.log(`Fee payer address: ${feepayerData.publicKey}`);
console.log('\n⚠️  Fund these addresses from faucet:');
console.log('https://faucet.minaprotocol.com/');
```

### 5. Fund Accounts

Before deploying, fund both addresses with test MINA:

1. Go to [Mina Faucet](https://faucet.minaprotocol.com/)
2. Select network (Devnet/Berkeley)
3. Paste deployer address → Request funds
4. Paste fee payer address → Request funds
5. Wait ~3-5 minutes for confirmation

**Check balance**:
```bash
# Using Minascan API
curl "https://api.minascan.io/node/devnet/v1/graphql" \
  -H "Content-Type: application/json" \
  -d '{"query":"{ account(publicKey: \"YOUR_ADDRESS_HERE\") { balance { total } } }"}'
```

### 6. Deploy Contracts

```bash
cd contracts

# Build contracts
npm run build

# Deploy to devnet
npm run deploy devnet

# Or deploy to berkeley
npm run deploy berkeley
```

**What happens during deployment**:
1. Compiles `DIDRegistry` contract (~30s)
2. Compiles `ZKPVerifier` contract (~30s)
3. Creates deployment transaction
4. Signs with deployer key
5. Submits to network
6. Waits for confirmation (~3-5 minutes)

**Expected output**:
```
✓ Compiled DIDRegistry
✓ Compiled ZKPVerifier
✓ Created deployment transaction
✓ Transaction sent: 5Ju...abc
✓ Waiting for confirmation...
✓ Contract deployed!

DIDRegistry: B62qjuEhj9YjZyKTD75ywH7vY73DgUTC5bVxSCo3meirg8nGnV3CYjk
ZKPVerifier: B62qrfTGCDP1KEx1PQa6mWGjV2b8wckbdcQRhi2Mu3AGfRYrjjnnfxW

View on Minascan:
https://minascan.io/devnet/account/B62qjuEhj9YjZyKTD75ywH7vY73DgUTC5bVxSCo3meirg8nGnV3CYjk
```

### 7. Update UI Configuration

Copy the deployed contract addresses to UI config:

Edit `ui/lib/ContractInterface.ts`:
```typescript
export const DEFAULT_CONFIG: NetworkConfig = {
  networkId: 'devnet',
  minaEndpoint: 'https://api.minascan.io/node/devnet/v1/graphql',
  archiveEndpoint: 'https://api.minascan.io/archive/devnet/v1/graphql',
  didRegistryAddress: 'B62q...YOUR_DID_REGISTRY_ADDRESS',
  zkpVerifierAddress: 'B62q...YOUR_ZKP_VERIFIER_ADDRESS',
};
```

---

## Frontend Deployment

### 1. Configure Environment

Create `ui/.env.local`:
```bash
# Network Configuration
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_MINA_ENDPOINT=https://api.minascan.io/node/devnet/v1/graphql
NEXT_PUBLIC_ARCHIVE_ENDPOINT=https://api.minascan.io/archive/devnet/v1/graphql

# WebSocket Server (if deployed)
NEXT_PUBLIC_WS_URL=wss://your-websocket-server.com/minaid

# Contract Addresses (from deployment)
NEXT_PUBLIC_DID_REGISTRY=B62q...YOUR_ADDRESS
NEXT_PUBLIC_ZKP_VERIFIER=B62q...YOUR_ADDRESS

# Optional: Analytics, error tracking
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id
```

### 2. Enable SharedArrayBuffer (Required for o1js)

Edit `ui/next.config.mjs`:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  
  // Required for o1js Web Workers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp',
          },
        ],
      },
    ];
  },
  
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
    };
    return config;
  },
};

export default nextConfig;
```

### 3. Build for Production

```bash
cd ui

# Install dependencies
npm install

# Build
npm run build

# Test production build locally
npm run start
```

### 4. Deploy to Vercel

**Option A: Using Vercel CLI**
```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Deploy
cd ui
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_NETWORK
vercel env add NEXT_PUBLIC_MINA_ENDPOINT
vercel env add NEXT_PUBLIC_WS_URL
# ... add all variables from .env.local
```

**Option B: Using Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Import Git repository
3. Select `ui` directory as root
4. Add environment variables
5. Deploy

**Important Vercel Settings**:
- **Framework**: Next.js
- **Root Directory**: `ui`
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Install Command**: `npm install`

### 5. Deploy to Netlify

```bash
cd ui

# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Initialize
netlify init

# Deploy
netlify deploy --prod --dir=.next
```

**netlify.toml**:
```toml
[build]
  command = "npm run build"
  publish = ".next"

[[headers]]
  for = "/*"
  [headers.values]
    Cross-Origin-Opener-Policy = "same-origin"
    Cross-Origin-Embedder-Policy = "require-corp"
```

---

## WebSocket Server Setup

### 1. Create WebSocket Server

Create `server/websocket-server.js`:
```javascript
const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 8080;

const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store connected clients
const clients = new Map();

wss.on('connection', (ws, req) => {
  const clientId = generateClientId();
  clients.set(clientId, ws);
  
  console.log(`Client connected: ${clientId} (${clients.size} total)`);
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Handle ping
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
        return;
      }
      
      // Broadcast to all clients
      broadcast(data, clientId);
      
    } catch (error) {
      console.error('Message error:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
    console.log(`Client disconnected: ${clientId} (${clients.size} remaining)`);
  });
  
  ws.on('error', (error) => {
    console.error(`Client error ${clientId}:`, error);
  });
});

function broadcast(data, senderId) {
  const message = JSON.stringify(data);
  
  clients.forEach((client, id) => {
    if (client.readyState === WebSocket.OPEN && id !== senderId) {
      client.send(message);
    }
  });
}

function generateClientId() {
  return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

server.listen(PORT, () => {
  console.log(`✓ WebSocket server running on port ${PORT}`);
});
```

### 2. Deploy WebSocket Server

**Option A: Deploy to Heroku**
```bash
# Create Procfile
echo "web: node websocket-server.js" > Procfile

# Create package.json
cat > package.json << EOF
{
  "name": "minaid-websocket",
  "version": "1.0.0",
  "dependencies": {
    "ws": "^8.14.2"
  },
  "scripts": {
    "start": "node websocket-server.js"
  }
}
EOF

# Deploy
heroku create minaid-websocket
git push heroku main
```

**Option B: Deploy to Railway**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

**Option C: Deploy to your own VPS**
```bash
# SSH to server
ssh user@your-server.com

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone and setup
git clone your-repo
cd server
npm install

# Run with PM2
npm install -g pm2
pm2 start websocket-server.js --name minaid-ws
pm2 save
pm2 startup
```

---

## Local Development

### 1. Start Contracts Development

```bash
cd contracts

# Watch mode (auto-recompile on changes)
npm run build -- --watch

# Run tests
npm test

# Run specific test
npm test -- DIDRegistry.test.ts
```

### 2. Start UI Development

```bash
cd ui

# Development server
npm run dev

# Opens on http://localhost:3000
```

### 3. Start WebSocket Server (Local)

```bash
# In a new terminal
cd server
node websocket-server.js

# Or use nodemon for auto-restart
npm install -g nodemon
nodemon websocket-server.js
```

### 4. Full Local Setup

**Terminal 1 - Contracts**:
```bash
cd contracts
npm run build -- --watch
```

**Terminal 2 - WebSocket**:
```bash
cd server
nodemon websocket-server.js
```

**Terminal 3 - UI**:
```bash
cd ui
npm run dev
```

**Terminal 4 - Tests**:
```bash
cd contracts
npm test -- --watch
```

---

## Production Deployment

### Complete Production Checklist

#### 1. Smart Contracts
- [ ] Generate and cache circuit artifacts
- [ ] Deploy DIDRegistry to mainnet
- [ ] Deploy ZKPVerifier to mainnet
- [ ] Verify contracts on Minascan
- [ ] Test all contract methods
- [ ] Fund contract accounts

#### 2. Frontend
- [ ] Update contract addresses in config
- [ ] Set production environment variables
- [ ] Enable SharedArrayBuffer headers
- [ ] Build and test production bundle
- [ ] Deploy to Vercel/Netlify
- [ ] Configure custom domain
- [ ] Enable HTTPS
- [ ] Test on production URL

#### 3. WebSocket Server
- [ ] Deploy to production server
- [ ] Configure SSL/TLS (wss://)
- [ ] Set up monitoring
- [ ] Configure auto-restart (PM2)
- [ ] Set up logging
- [ ] Test reconnection logic

#### 4. Security
- [ ] Enable Content Security Policy
- [ ] Configure CORS properly
- [ ] Set up rate limiting
- [ ] Enable DDoS protection
- [ ] Review environment variables
- [ ] Test passkey authentication
- [ ] Audit smart contracts

#### 5. Monitoring
- [ ] Set up error tracking (Sentry)
- [ ] Configure analytics
- [ ] Monitor transaction queue
- [ ] Track WebSocket connections
- [ ] Set up uptime monitoring
- [ ] Configure alerts

### Environment Variables (Production)

```bash
# Frontend (.env.production)
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_MINA_ENDPOINT=https://api.minascan.io/node/mainnet/v1/graphql
NEXT_PUBLIC_ARCHIVE_ENDPOINT=https://api.minascan.io/archive/mainnet/v1/graphql
NEXT_PUBLIC_WS_URL=wss://ws.minaid.app/minaid
NEXT_PUBLIC_DID_REGISTRY=B62q...MAINNET_ADDRESS
NEXT_PUBLIC_ZKP_VERIFIER=B62q...MAINNET_ADDRESS
NEXT_PUBLIC_SENTRY_DSN=your-sentry-dsn
NEXT_PUBLIC_ANALYTICS_ID=your-analytics-id

# WebSocket Server
PORT=8080
NODE_ENV=production
MAX_CONNECTIONS=1000
HEARTBEAT_INTERVAL=30000
```

---

## Troubleshooting

### Contract Deployment Issues

**Problem**: "Account not found"
```bash
# Solution: Fund account from faucet
# Wait 3-5 minutes after requesting funds
```

**Problem**: "Compilation timeout"
```bash
# Solution: Increase Node.js memory
export NODE_OPTIONS="--max-old-space-size=8192"
npm run build
```

**Problem**: "Fee too low"
```bash
# Solution: Increase fee in config.json
{
  "fee": "0.2"  // Increase from 0.1
}
```

### Frontend Issues

**Problem**: "SharedArrayBuffer is not defined"
```bash
# Solution: Check next.config.mjs headers
# Ensure Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy are set
```

**Problem**: "Cannot find module 'o1js'"
```bash
# Solution: Reinstall dependencies
cd ui
rm -rf node_modules package-lock.json
npm install
```

**Problem**: "Passkey not working in production"
```bash
# Solution: Ensure HTTPS is enabled
# Passkeys only work on localhost or HTTPS
```

### WebSocket Issues

**Problem**: "Connection refused"
```bash
# Solution: Check WebSocket URL
# Use wss:// for HTTPS, ws:// for HTTP
# Ensure server is running and accessible
```

**Problem**: "Auto-reconnect failing"
```bash
# Solution: Check CORS configuration
# Allow origin in WebSocket server:
const wss = new WebSocket.Server({
  server,
  verifyClient: (info) => {
    const origin = info.origin;
    return origin === 'https://your-app.com';
  }
});
```

### Performance Issues

**Problem**: "Slow proof generation"
```bash
# Solution: Implement Web Worker (TODO #5)
# Use circuit caching
# Enable SharedArrayBuffer
```

**Problem**: "High memory usage"
```bash
# Solution: Clear completed transactions
transactionQueue.clearCompleted();
progressIndicator.clearCompleted();

# Limit queue size
# Implement LRU cache for proofs
```

---

## Useful Commands

### Contracts
```bash
# Clean build
npm run build:clean

# Generate fresh cache
npm run generate-cache

# Deploy specific contract
npx tsx scripts/deploy.ts devnet DIDRegistry

# Check contract state
npx tsx scripts/check-state.ts devnet B62q...ADDRESS
```

### UI
```bash
# Development
npm run dev

# Production build
npm run build
npm run start

# Type checking
npm run type-check

# Linting
npm run lint

# Tests
npm run test
```

### WebSocket
```bash
# Check connections
curl http://localhost:8080/health

# Monitor logs
pm2 logs minaid-ws

# Restart
pm2 restart minaid-ws
```

---

## Quick Start (Summary)

```bash
# 1. Deploy Contracts
cd contracts
npm install
npm run generate-cache
npm run copy-cache
npx tsx scripts/generate-keys.ts devnet
# Fund accounts from https://faucet.minaprotocol.com/
npm run deploy devnet

# 2. Start WebSocket Server
cd ../server
npm install
node websocket-server.js &

# 3. Start Frontend
cd ../ui
npm install
# Update contract addresses in lib/ContractInterface.ts
npm run dev

# 4. Open browser
open http://localhost:3000
```

---

## Additional Resources

- **Mina Docs**: https://docs.minaprotocol.com/
- **o1js Docs**: https://docs.minaprotocol.com/zkapps/o1js
- **Minascan Explorer**: https://minascan.io/
- **Mina Faucet**: https://faucet.minaprotocol.com/
- **Auro Wallet**: https://www.aurowallet.com/
- **Next.js Docs**: https://nextjs.org/docs

---

## Support

For issues or questions:
1. Check [Troubleshooting](#troubleshooting) section
2. Review error logs
3. Check Mina Discord: https://discord.gg/minaprotocol
4. Open GitHub issue

---

**Last Updated**: November 27, 2025
