# MinaID Production Features - Implementation Guide

## Overview
This document describes the production-grade features implemented for MinaID, a decentralized identity system built on Mina Protocol with zero-knowledge proofs.

## Architecture

### Off-Chain Computation, On-Chain Verification
- **Proof Generation**: Heavy computations done in Web Worker (client-side)
- **Transaction Processing**: Queued and retried with exponential backoff
- **Verification**: On-chain verification via ZKPVerifier contract
- **State Management**: Merkle tree for efficient DID storage

## Implemented Features

### 1. Transaction Queue Service ✅

**File**: `/ui/lib/TransactionQueueService.ts`

**Features**:
- ✅ Retry logic with exponential backoff (2s, 4s, 8s)
- ✅ Concurrent transaction limit (max 5)
- ✅ Persistent queue storage (localStorage)
- ✅ Status tracking (pending/processing/completed/failed)
- ✅ Callback system for transaction results
- ✅ Automatic retry on retryable errors (network, timeout, rate limit)

**Usage**:
```typescript
import { transactionQueue } from '../lib/TransactionQueueService';

// Queue a DID registration
const txId = transactionQueue.addTransaction(
  'registerDID',
  {
    userPublicKey: publicKey.toBase58(),
    didDocument: documentHash,
    signature: sig
  },
  (txId, result) => {
    if (result.success) {
      console.log('Success!', result.transactionHash);
    } else {
      console.error('Failed:', result.error);
    }
  },
  3 // max retries
);

// Check status
const status = transactionQueue.getTransactionStatus(txId);

// Get pending count
const pending = transactionQueue.getPendingCount();
```

**Transaction Types**:
- `registerDID` - Register new DID
- `verifyProof` - Submit proof for verification
- `updateDID` - Update DID document
- `revokeDID` - Revoke DID (account deletion)

### 2. WebSocket Service ✅

**File**: `/ui/lib/WebSocketService.ts`

**Features**:
- ✅ Auto-reconnection with exponential backoff
- ✅ Message queuing when offline (max 100 messages)
- ✅ Event subscription system
- ✅ Connection state management (connected/connecting/disconnected/error)
- ✅ Heartbeat to keep connection alive (30s interval)

**Events**:
- `PROOF_VERIFIED` - Proof verification completed
- `PROOF_FAILED` - Proof verification failed
- `VERIFICATION_REQUEST` - New verification request
- `USER_VERIFIED` - User successfully verified
- `DID_REGISTERED` - DID registration confirmed
- `DID_UPDATED` - DID update confirmed
- `DID_REVOKED` - DID revocation confirmed
- `TRANSACTION_CONFIRMED` - Transaction confirmed on-chain
- `TRANSACTION_FAILED` - Transaction failed

**Usage**:
```typescript
import { websocketService } from '../lib/WebSocketService';

// Connect (auto-connects on initialization)
websocketService.connect();

// Subscribe to events
const unsubscribe = websocketService.on('PROOF_VERIFIED', (message) => {
  console.log('Proof verified!', message.data);
});

// Send event
websocketService.send('VERIFICATION_REQUEST', {
  proofId: 'proof_123',
  verifierPublicKey: publicKey
});

// Monitor connection state
websocketService.onStateChange((state) => {
  console.log('Connection state:', state);
});

// Cleanup
unsubscribe();
```

**Configuration**:
Set `NEXT_PUBLIC_WS_URL` in environment:
```bash
NEXT_PUBLIC_WS_URL=ws://localhost:8080/minaid
```

### 3. Progress Indicator System ✅

**Files**:
- `/ui/lib/ProgressIndicatorService.ts` - Service
- `/ui/components/ProgressIndicator.tsx` - UI Components

**Features**:
- ✅ Step-by-step progress tracking
- ✅ Real-time progress updates (0-100%)
- ✅ Time estimates based on historical data
- ✅ Progress callbacks for UI updates
- ✅ Multiple operation types (proof-generation, transaction, sync, etc.)

**Components**:
1. **ProgressIndicator** - Full progress UI with steps
2. **CompactProgressBar** - Inline progress bar
3. **ProgressBadge** - Status badge for headers

**Usage**:
```typescript
import { progressIndicator } from '../lib/ProgressIndicatorService';
import { ProgressIndicator } from '../components/ProgressIndicator';

// Start operation
const opId = progressIndicator.startOperation(
  'proof-generation',
  'Generating age proof',
  ['Loading circuit', 'Compiling', 'Computing witness', 'Generating proof'],
  10000 // 10 seconds estimated
);

// Update progress
progressIndicator.updateStep(opId, 'step_0', 50); // 50% progress
progressIndicator.completeStep(opId, 'step_0'); // Complete step

// In component
<ProgressIndicator
  operationId={opId}
  onComplete={() => console.log('Done!')}
  onFail={(error) => console.error(error)}
  showSteps={true}
  showTimeEstimate={true}
/>
```

**Helpers**:
```typescript
// Quick operations
const proofOpId = progressIndicator.createProofGenerationOperation('age');
const txOpId = progressIndicator.createTransactionOperation('DID Registration');
const compileOpId = progressIndicator.createCircuitCompilationOperation('AgeVerification');
```

### 4. Account Deletion Flow ✅

**File**: `/ui/components/AccountDeletion.tsx`

**Features**:
- ✅ Passkey authentication required
- ✅ Type-to-confirm safety ("DELETE")
- ✅ Irreversible warning with risk disclosure
- ✅ DID revocation transaction
- ✅ Complete data clearing
- ✅ Progress tracking during deletion

**Flow**:
1. **Confirm** - User confirms understanding of risks, types "DELETE"
2. **Authenticate** - Biometric authentication via passkey
3. **Deleting** - Progress shown for each step:
   - Sign revocation message
   - Submit DID revocation transaction
   - Clear all local data (10+ keys)
   - Finalize deletion
4. **Deleted** - Confirmation with redirect

**Usage**:
```typescript
import { AccountDeletion } from '../components/AccountDeletion';

<AccountDeletion
  walletAddress={userAddress}
  onDeleted={() => router.push('/')}
  onCancel={() => setShowDeletion(false)}
/>
```

**Data Cleared**:
- Encrypted private key
- Passkey ID and metadata
- DID and DID document
- Citizenship hash
- Age hash
- Aadhar data
- All proofs
- Login history

## Pending Features

### 5. Web Worker for Proof Generation ⏳

**Target**: Non-blocking proof generation (5-10s)

**Implementation Plan**:
1. Update `ZkappWorker.ts` with proof generation methods
2. Add progress updates via message passing
3. Implement circuit compilation caching
4. Cache compiled circuits to reduce from ~30s to <5s

**Expected Code**:
```typescript
// In ZkappWorker.ts
export const api = {
  async generateAgeProof(
    birthDate: string,
    minimumAge: number,
    onProgress: (percent: number) => void
  ): Promise<string> {
    onProgress(0);
    
    // Load cached circuit or compile
    onProgress(20);
    await loadOrCompileCircuit('age');
    
    // Compute witness
    onProgress(50);
    const witness = computeWitness(birthDate, minimumAge);
    
    // Generate proof
    onProgress(80);
    const proof = await generateProof(witness);
    
    onProgress(100);
    return proof;
  }
};
```

### 6. Smart Contract Optimization ⏳

**Targets**:
- Event emissions for off-chain indexing
- Merkle tree optimization
- Proof caching
- Batch verification

**DIDRegistry Enhancements**:
```typescript
@method registerDID(did: PublicKey, documentHash: Field, witness: MerkleMapWitness) {
  // Verify witness
  const [root, key] = witness.computeRootAndKey(documentHash);
  this.didRoot.assertEquals(root);
  
  // Update root
  const [newRoot, _] = witness.computeRootAndKey(documentHash);
  this.didRoot.set(newRoot);
  
  // Emit event
  this.emitEvent('DIDRegistered', {
    did,
    documentHash,
    timestamp: this.network.timestamp.get()
  });
}
```

### 7. Error Recovery & Offline Support ⏳

**Features Needed**:
- Network detection
- Offline mode indicator
- Automatic sync when reconnected
- Service worker for offline capabilities
- Clear error messages with fixes

**Example**:
```typescript
// NetworkDetector.ts
class NetworkDetector {
  isOnline(): boolean {
    return navigator.onLine;
  }
  
  onOnline(callback: () => void) {
    window.addEventListener('online', callback);
  }
  
  onOffline(callback: () => void) {
    window.addEventListener('offline', callback);
  }
}
```

### 8. Performance & Caching ⏳

**Targets**:
- Circuit compilation: <5s (from ~30s)
- Proof generation: 5-10s
- UI responsiveness: <100ms
- DID registration: 20-30s
- Proof verification: 30-60s

**Optimizations**:
1. **Circuit Caching**: Save compiled circuits to IndexedDB
2. **SharedArrayBuffer**: Enable with headers for faster compilation
3. **Lazy Loading**: Code split heavy components
4. **IndexedDB**: Store large data (proofs, circuits)
5. **Service Worker**: Cache static assets

**SharedArrayBuffer Headers** (next.config.mjs):
```javascript
async headers() {
  return [{
    source: '/(.*)',
    headers: [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' }
    ]
  }];
}
```

## Performance Metrics

### Current State
- ✅ Loading states implemented
- ✅ Progress tracking ready
- ✅ Transaction queuing operational
- ✅ WebSocket service ready
- ⏳ Circuit compilation: ~30s (needs caching)
- ⏳ Proof generation: Not optimized (needs Web Worker)

### Target State
- Circuit compilation: <5s (with cache)
- Proof generation: 5-10s (non-blocking)
- DID registration: 20-30s
- Proof verification: 30-60s
- UI responsiveness: <100ms

## Security Checklist

### Implemented ✅
- ✅ Passkey authentication (biometric)
- ✅ One-passkey-per-wallet enforcement
- ✅ Private key encryption (AES-GCM)
- ✅ Browser-compatible base64 (no atob/btoa errors)
- ✅ Input validation (base64, text)
- ✅ Rate limiting (login attempts)
- ✅ Security event logging
- ✅ Signature verification (UIDAI Aadhar)
- ✅ Zero-knowledge proofs (citizenship, age)
- ✅ Account deletion with biometric confirmation

### Pending ⏳
- ⏳ SharedArrayBuffer CSP headers
- ⏳ Service worker security
- ⏳ CORS configuration for WebSocket
- ⏳ Proof replay protection
- ⏳ Transaction nonce management
- ⏳ Smart contract access control

## Integration Guide

### 1. Transaction Queue in Signup

**File**: `/ui/components/SignupOrchestrator.tsx`

```typescript
// In handleRegisterDID
const txId = transactionQueue.addTransaction(
  'registerDID',
  {
    userPublicKey: publicKey.toBase58(),
    didDocument: documentHash,
    signature: signedMessage
  },
  (txId, result) => {
    if (result.success) {
      setStep('complete');
      setLoadingMessage('');
    } else {
      setError(result.error || 'Registration failed');
    }
  }
);
```

### 2. Progress Indicators in Proof Generation

**File**: `/ui/lib/ProofGenerator.ts`

```typescript
import { progressIndicator } from './ProgressIndicatorService';

async function generateCitizenshipProof(citizenship: string): Promise<string> {
  const opId = progressIndicator.createProofGenerationOperation('citizenship');
  
  try {
    // Step 1: Load circuit
    progressIndicator.updateStep(opId, 'step_0', 50);
    await loadCircuit();
    progressIndicator.completeStep(opId, 'step_0');
    
    // Step 2: Compile
    progressIndicator.updateStep(opId, 'step_1', 30);
    await compile();
    progressIndicator.completeStep(opId, 'step_1');
    
    // ... continue for all steps
    
    progressIndicator.completeOperation(opId);
    return proof;
    
  } catch (error) {
    progressIndicator.failOperation(opId, error.message);
    throw error;
  }
}
```

### 3. WebSocket for Real-Time Updates

**File**: `/ui/components/VerifierDashboard.tsx`

```typescript
useEffect(() => {
  // Subscribe to verification events
  const unsubscribe = websocketService.on('PROOF_VERIFIED', (message) => {
    console.log('Proof verified:', message.data);
    refreshProofsList();
  });
  
  return () => unsubscribe();
}, []);
```

### 4. Account Deletion in Settings

**File**: `/ui/app/settings/page.tsx`

```typescript
'use client';

import { AccountDeletion } from '@/components/AccountDeletion';
import { useState } from 'react';

export default function Settings() {
  const [showDeletion, setShowDeletion] = useState(false);
  const walletAddress = '...'; // Get from context
  
  if (showDeletion) {
    return (
      <AccountDeletion
        walletAddress={walletAddress}
        onDeleted={() => router.push('/')}
        onCancel={() => setShowDeletion(false)}
      />
    );
  }
  
  return (
    <div>
      {/* Settings UI */}
      <button onClick={() => setShowDeletion(true)}>
        Delete Account
      </button>
    </div>
  );
}
```

## Testing

### Transaction Queue Tests
```typescript
// Test retry logic
const txId = transactionQueue.addTransaction(
  'registerDID',
  { /* data */ },
  (txId, result) => {
    console.log('Result:', result);
  },
  3 // max retries
);

// Simulate failure
// Should retry 3 times with exponential backoff
```

### WebSocket Tests
```typescript
// Test reconnection
websocketService.disconnect();
// Should auto-reconnect with backoff

// Test offline queueing
websocketService.send('TEST', { data: 'test' });
// Should queue when offline
```

### Progress Indicator Tests
```typescript
const opId = progressIndicator.startOperation(
  'proof-generation',
  'Test operation',
  ['Step 1', 'Step 2', 'Step 3']
);

// Should complete all steps
progressIndicator.completeStep(opId, 'step_0');
progressIndicator.completeStep(opId, 'step_1');
progressIndicator.completeStep(opId, 'step_2');

// Should auto-complete operation
const op = progressIndicator.getOperation(opId);
console.assert(op.status === 'completed');
```

## Next Steps

1. **Implement Web Worker** (High Priority)
   - Non-blocking proof generation
   - Circuit compilation caching
   - Progress updates

2. **Optimize Smart Contracts** (High Priority)
   - Event emissions
   - Merkle tree optimization
   - Batch verification

3. **Add Offline Support** (Medium Priority)
   - Network detection
   - Service worker
   - Automatic sync

4. **Performance Optimization** (Medium Priority)
   - Circuit caching (<5s)
   - Lazy loading
   - IndexedDB integration

## Conclusion

MinaID now has production-grade infrastructure for:
- ✅ Reliable transaction processing
- ✅ Real-time updates
- ✅ Progress tracking
- ✅ Account management

Next phase focuses on performance optimization and offline capabilities to achieve target metrics.
