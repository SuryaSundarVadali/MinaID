# Quick Reference: Frontend Improvements

## 🚀 Quick Start

### 1. Add Progress Tracking to Your Component

```typescript
import { useProofProgress } from '../hooks/useProofProgress';
import { SteppedProgressIndicator } from '../components/SteppedProgressIndicator';

const { progress, updateStep, setError, reset } = useProofProgress();

// Use in JSX
<SteppedProgressIndicator progress={progress} />

// Update progress
updateStep('COMPILING_CIRCUIT', 'Compiling DIDRegistry...');
updateStep('PROVING', 'Generating proof...', 75); // Custom percentage
```

### 2. Show Toast Notifications

```typescript
import { notify } from '../lib/ToastNotifications';

notify.success('Operation successful!');
notify.error('Something went wrong');
notify.warning('Please check your input');
notify.info('Transaction submitted');

// Transaction-specific
notify.tx.submitted(hash);
notify.tx.pending();
notify.tx.confirmed(hash, confirmations);
notify.tx.failed(reason);

// Proof-specific
notify.proof.compiling();
notify.proof.generating();
notify.proof.complete('Citizenship');
```

### 3. Add Network Guard

```typescript
import { NetworkGuard } from '../components/NetworkGuard';

<NetworkGuard 
  expectedNetwork="devnet"
  onNetworkMismatch={(current, expected) => {
    notify.warning(`Switch to ${expected} network`);
  }}
/>
```

### 4. Use Web Worker for Heavy Operations

```typescript
import { wrap } from 'comlink';
import type { api as WorkerAPI } from '../app/ZkappWorker';

const worker = new Worker(new URL('../app/ZkappWorker.ts', import.meta.url));
const api = wrap<typeof WorkerAPI>(worker);

// Set progress callback
api.setProgressCallback((step, percentage, message) => {
  updateStep(step as any, message, percentage);
});

// Use worker methods (non-blocking!)
await api.setActiveInstanceToDevnet();
await api.compileDIDRegistry();
await api.compileZKPVerifier();
```

### 5. Monitor Transactions with UI Feedback

```typescript
import { monitorTransaction } from '../lib/CompleteTransactionMonitor';

await monitorTransaction(
  txHash,
  {
    showToasts: true, // Enable toast notifications
    onStatusChange: (status, message) => {
      updateStep('MONITORING', message);
    },
    onConfirmed: (result) => {
      updateStep('COMPLETE', 'Transaction confirmed!');
    },
    onFailed: (reason) => {
      setError(reason);
    },
  }
);
```

## 📋 Progress Steps Reference

```typescript
type ProofStep = 
  | 'IDLE'              // Ready to start
  | 'INITIALIZING'      // Setting up
  | 'FETCHING_KEYS'     // Downloading keys
  | 'LOADING_CACHE'     // Loading cached data
  | 'COMPILING_CIRCUIT' // Compiling ZK circuits (slow!)
  | 'GENERATING_WITNESS'// Computing private inputs
  | 'PROVING'           // Generating ZK proof (slow!)
  | 'SIGNING_TRANSACTION'// Waiting for wallet
  | 'BROADCASTING'      // Sending to network
  | 'MONITORING'        // Watching for confirmation
  | 'COMPLETE'          // Success!
  | 'ERROR';            // Failed
```

## 🎨 Toast Notification Types

```typescript
notify.success(message, options?)
notify.error(message, options?)
notify.warning(message, options?)
notify.info(message, options?)
notify.loading(message)
notify.dismiss(toastId?)

// Promise-based
notify.promise(promise, {
  loading: 'Processing...',
  success: 'Done!',
  error: 'Failed'
});
```

## 🔧 Common Patterns

### Full Proof Generation Flow

```typescript
const handleGenerate = async () => {
  setIsGenerating(true);
  reset();
  
  try {
    // Step 1: Initialize
    updateStep('INITIALIZING', 'Starting...');
    await worker.setActiveInstanceToDevnet();
    
    // Step 2: Load contracts
    updateStep('INITIALIZING', 'Loading contracts...');
    await worker.loadContracts();
    
    // Step 3: Compile (slow)
    updateStep('COMPILING_CIRCUIT', 'Compiling circuits...');
    await worker.compileDIDRegistry();
    
    // Step 4: Generate witness
    updateStep('GENERATING_WITNESS', 'Computing private inputs...');
    const witness = await computeWitness(data);
    
    // Step 5: Prove (slow)
    updateStep('PROVING', 'Generating proof...');
    const proof = await worker.generateProof(witness);
    
    // Step 6: Sign
    updateStep('SIGNING_TRANSACTION', 'Waiting for wallet...');
    const tx = await buildTransaction(proof);
    
    // Step 7: Broadcast
    updateStep('BROADCASTING', 'Broadcasting transaction...');
    const hash = await sendTransaction(tx);
    
    // Step 8: Monitor
    updateStep('MONITORING', 'Monitoring transaction...');
    await monitorTransaction(hash, { showToasts: true });
    
    // Done!
    updateStep('COMPLETE', 'Success!');
    notify.success('Proof generated and verified!');
    
  } catch (error) {
    setError(error.message);
    notify.error(error.message);
  } finally {
    setIsGenerating(false);
  }
};
```

### Transaction Submission with Retry

```typescript
import { submitTransaction } from '../lib/RobustTransactionSubmitter';

const result = await submitTransaction(
  proof,
  async () => {
    updateStep('SIGNING_TRANSACTION', 'Building transaction...');
    const tx = await buildTransaction();
    await tx.prove();
    return tx.toJSON();
  },
  {
    onAttempt: (attempt, max) => {
      updateStep('BROADCASTING', `Attempt ${attempt}/${max}...`);
    },
    onRetry: (delay, reason) => {
      notify.warning(`Retrying in ${delay/1000}s: ${reason}`);
    },
    onSuccess: (hash) => {
      notify.tx.submitted(hash);
    },
  }
);
```

## 🛠️ Utility Functions

### Check Network

```typescript
import { useNetworkCheck } from '../components/NetworkGuard';

const { isCorrectNetwork, currentNetwork } = useNetworkCheck('devnet');

if (!isCorrectNetwork) {
  notify.warning('Wrong network detected!');
}
```

### Wallet Context Helpers

```typescript
import { useWallet } from '../context/WalletContext';

const { isConnected, session, logout, refreshSession } = useWallet();

// Auto-logout after inactivity is handled automatically
// Account changes are detected automatically
// Just use the context as usual!
```

## ⚡ Performance Tips

1. **Always use Web Worker for:**
   - Circuit compilation
   - Proof generation
   - Any o1js operation

2. **Update progress frequently:**
   - Every major step
   - Every 10-20% completion
   - On status changes

3. **Use toast notifications:**
   - Success states
   - Error states
   - Important info
   - NOT for every progress update

4. **Network guard:**
   - Add to all transaction pages
   - Add to proof generation pages

## 🐛 Debug Checklist

- [ ] Toaster component in layout?
- [ ] react-hot-toast installed?
- [ ] Worker initialized before use?
- [ ] Progress callback set on worker?
- [ ] Network guard added?
- [ ] Error handling in place?

## 📦 Required Imports

```typescript
// Progress
import { useProofProgress } from '../hooks/useProofProgress';
import { SteppedProgressIndicator } from '../components/SteppedProgressIndicator';

// Toasts
import { notify } from '../lib/ToastNotifications';

// Network
import { NetworkGuard } from '../components/NetworkGuard';

// Worker
import { wrap } from 'comlink';
import type { api as WorkerAPI } from '../app/ZkappWorker';

// Transaction
import { monitorTransaction } from '../lib/CompleteTransactionMonitor';
import { submitTransaction } from '../lib/RobustTransactionSubmitter';

// Wallet
import { useWallet } from '../context/WalletContext';
```

## 🎯 Component Template

```typescript
'use client';

import React, { useEffect, useState } from 'react';
import { useProofProgress } from '../hooks/useProofProgress';
import { SteppedProgressIndicator } from '../components/SteppedProgressIndicator';
import { NetworkGuard } from '../components/NetworkGuard';
import { notify } from '../lib/ToastNotifications';
import { wrap } from 'comlink';

export function MyComponent() {
  const { progress, updateStep, setError, reset } = useProofProgress();
  const [worker, setWorker] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const w = new Worker(new URL('../app/ZkappWorker.ts', import.meta.url));
    const api = wrap(w);
    api.setProgressCallback((step, pct, msg) => {
      updateStep(step as any, msg, pct);
    });
    setWorker(api);
    return () => w.terminate();
  }, [updateStep]);

  const handleAction = async () => {
    setIsProcessing(true);
    reset();
    
    try {
      updateStep('INITIALIZING', 'Starting...');
      // Your logic here
      updateStep('COMPLETE', 'Success!');
      notify.success('Operation completed!');
    } catch (err: any) {
      setError(err.message);
      notify.error(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <NetworkGuard expectedNetwork="devnet" />
      
      {progress.step !== 'IDLE' && (
        <SteppedProgressIndicator progress={progress} />
      )}
      
      <button 
        onClick={handleAction} 
        disabled={isProcessing}
      >
        {isProcessing ? 'Processing...' : 'Start'}
      </button>
    </>
  );
}
```

---

**For complete documentation, see:**
- [FRONTEND_IMPROVEMENTS.md](FRONTEND_IMPROVEMENTS.md) - Full guide
- [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) - Implementation details
- [EnhancedProofExample.tsx](ui/components/EnhancedProofExample.tsx) - Working example
