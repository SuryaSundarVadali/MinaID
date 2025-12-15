# Frontend Performance & UX Improvements

This document outlines the comprehensive frontend improvements made to MinaID to achieve a smooth, responsive user experience.

## Overview

The MinaID application has been enhanced with:
- **Web Worker Integration** - Off-main-thread computation
- **Granular Progress Tracking** - Stepped progress indicators
- **Session Management** - Auto-logout after 10 minutes inactivity
- **Wallet Event Listeners** - Handle account/network changes
- **Toast Notifications** - User-friendly feedback system
- **Network Guards** - Prevent cross-network errors

## Key Improvements

### 1. Web Worker Architecture (`ZkappWorker.ts`)

All heavy `o1js` operations now run in a dedicated Web Worker using Comlink.

**Benefits:**
- UI thread remains responsive during proof generation
- No "frozen" UI states
- Smooth animations and user interactions

**Implementation:**
```typescript
// Worker exposes progress callbacks
setProgressCallback: Comlink.proxy((callback: ProgressCallback) => {
  state.progressCallback = callback;
})

// Each operation reports progress
state.progressCallback?.('COMPILING_CIRCUIT', 30, 'Compiling DIDRegistry');
```

**Usage in Components:**
```typescript
const worker = new Worker(new URL('../app/ZkappWorker.ts', import.meta.url));
const api = wrap<ZkappWorkerAPI>(worker);

// Set progress callback
api.setProgressCallback((step, percentage, message) => {
  updateStep(step, message, percentage);
});

// Compile contracts (non-blocking)
await api.compileDIDRegistry();
```

### 2. Progress Tracking Hook (`useProofProgress.ts`)

Provides a state machine for tracking proof generation progress.

**Progress Steps:**
1. `INITIALIZING` - Setting up network and contracts
2. `FETCHING_KEYS` - Downloading verification keys
3. `LOADING_CACHE` - Loading cached computations
4. `COMPILING_CIRCUIT` - Compiling zero-knowledge circuits
5. `GENERATING_WITNESS` - Computing private inputs
6. `PROVING` - Generating the ZK proof
7. `SIGNING_TRANSACTION` - Waiting for wallet signature
8. `BROADCASTING` - Broadcasting transaction
9. `MONITORING` - Monitoring transaction status
10. `COMPLETE` - Success!

**Usage:**
```typescript
const { progress, updateStep, setError, reset } = useProofProgress();

// Update progress
updateStep('COMPILING_CIRCUIT', 'Compiling DIDRegistry...');

// Display progress
<SteppedProgressIndicator progress={progress} />
```

### 3. Session Timeout (`WalletContext.tsx`)

Automatic logout after 10 minutes of user inactivity.

**Features:**
- Tracks mouse, keyboard, scroll, touch events
- Checks inactivity every 30 seconds
- Clears all session data on timeout
- Configurable timeout duration

**Configuration:**
```typescript
const INACTIVITY_TIMEOUT = 10 * 60 * 1000; // 10 minutes
```

### 4. Wallet Event Listeners (`WalletContext.tsx`)

Listens for wallet account and network changes.

**Events Handled:**
- `accountsChanged` - User switches wallet account
- `chainChanged` - User switches network

**Behavior:**
- Logs out user if account mismatch detected (security)
- Logs network changes (can be extended for auto-switch)

**Implementation:**
```typescript
// Auro Wallet
mina.on('accountsChanged', (accounts) => {
  if (currentAccount !== accounts[0]) {
    logout(); // Security measure
  }
});

// Metamask
ethereum.on('chainChanged', (chainId) => {
  console.log('Chain changed:', chainId);
});
```

### 5. Toast Notifications (`ToastNotifications.ts`)

Centralized notification system using `react-hot-toast`.

**Notification Types:**
- `notify.success()` - Success messages
- `notify.error()` - Error messages
- `notify.warning()` - Warning messages
- `notify.info()` - Informational messages
- `notify.loading()` - Loading states

**Specialized Notifications:**
```typescript
// Transaction notifications
notify.tx.submitted(hash);
notify.tx.pending();
notify.tx.confirmed(hash, confirmations);
notify.tx.failed(reason);

// Proof generation notifications
notify.proof.compiling();
notify.proof.generating();
notify.proof.complete(proofType);
```

### 6. Transaction Monitoring (`CompleteTransactionMonitor.ts`)

Enhanced with toast notification integration.

**Fixed Issues:**
- ✅ GraphQL schema errors resolved
- ✅ Proper field names for Minascan API
- ✅ Toast notifications for all transaction states

**Usage:**
```typescript
await monitorTransaction(
  txHash,
  {
    showToasts: true, // Enable toast notifications
    onStatusChange: (status, message) => {
      console.log(status, message);
    },
    onConfirmed: (result) => {
      // Transaction confirmed!
    },
  }
);
```

### 7. Network Guard (`NetworkGuard.tsx`)

Visual warning when user is on wrong network.

**Features:**
- Fixed top banner
- Auto-detects network from wallet
- Shows current and expected networks
- Dismisses when correct network selected

**Usage:**
```typescript
<NetworkGuard 
  expectedNetwork="devnet"
  onNetworkMismatch={(current, expected) => {
    notify.warning(`Please switch to ${expected}`);
  }}
/>
```

### 8. Stepped Progress Indicator (`SteppedProgressIndicator.tsx`)

Visual progress component with animations.

**Features:**
- Progress bar with percentage
- Step counter (e.g., "Step 3 of 10")
- Emoji indicators for each step
- Loading animation
- Sub-messages for detailed status
- Error state visualization

**Variants:**
- `SteppedProgressIndicator` - Full featured
- `MinimalProgressIndicator` - Compact version

## Integration Guide

### Adding to a Proof Generation Component

```typescript
import { useProofProgress } from '../hooks/useProofProgress';
import { SteppedProgressIndicator } from '../components/SteppedProgressIndicator';
import { NetworkGuard } from '../components/NetworkGuard';
import { notify } from '../lib/ToastNotifications';

export function ProofComponent() {
  const { progress, updateStep, setError, reset } = useProofProgress();
  
  const handleGenerate = async () => {
    try {
      reset();
      updateStep('INITIALIZING', 'Starting...');
      
      // Initialize worker
      const api = await getWorkerAPI();
      
      // Compile
      updateStep('COMPILING_CIRCUIT', 'Compiling...');
      await api.compileDIDRegistry();
      
      // Generate proof
      updateStep('PROVING', 'Generating proof...');
      const proof = await api.generateProof(...);
      
      updateStep('COMPLETE', 'Success!');
      notify.success('Proof generated!');
    } catch (error) {
      setError(error.message);
      notify.error(error.message);
    }
  };
  
  return (
    <>
      <NetworkGuard expectedNetwork="devnet" />
      <SteppedProgressIndicator progress={progress} />
      <button onClick={handleGenerate}>Generate</button>
    </>
  );
}
```

### Adding to Transaction Submission

```typescript
import { submitTransaction } from '../lib/RobustTransactionSubmitter';
import { monitorTransaction } from '../lib/CompleteTransactionMonitor';

const result = await submitTransaction(
  proof,
  buildTransactionFn,
  {
    onAttempt: (attempt, max) => {
      updateStep('BROADCASTING', `Attempt ${attempt}/${max}`);
    },
    onSuccess: (hash) => {
      notify.tx.submitted(hash);
    },
  }
);

// Monitor with toasts
await monitorTransaction(result.transactionHash, {
  showToasts: true,
  onConfirmed: (result) => {
    updateStep('COMPLETE', 'Transaction confirmed!');
  },
});
```

## Performance Metrics

### Before Improvements
- ❌ UI freezes for 30-60s during compilation
- ❌ No progress feedback
- ❌ Generic "Loading..." message
- ❌ GraphQL errors breaking monitoring
- ❌ No session timeout
- ❌ No wallet event handling

### After Improvements
- ✅ UI remains responsive (Web Worker)
- ✅ 10 granular progress steps
- ✅ Real-time status updates
- ✅ Fixed GraphQL queries
- ✅ 10-minute inactivity timeout
- ✅ Account/network change detection
- ✅ Toast notifications for all actions

## Best Practices

### 1. Always Use Web Workers for Heavy Computation
```typescript
// ❌ Bad - blocks UI thread
await AgeVerificationProgram.compile();

// ✅ Good - runs in worker
await workerAPI.compileAgeVerificationProgram();
```

### 2. Provide Granular Progress Updates
```typescript
// ❌ Bad - single loading state
setLoading(true);

// ✅ Good - stepped progress
updateStep('COMPILING_CIRCUIT', 'Compiling...');
updateStep('PROVING', 'Generating proof...');
```

### 3. Use Toast Notifications Consistently
```typescript
// ❌ Bad - console only
console.log('Success!');

// ✅ Good - user-visible toast
notify.success('Proof generated successfully!');
```

### 4. Guard Against Network Mismatches
```typescript
// ✅ Always include network guard
<NetworkGuard expectedNetwork="devnet" />
```

## Troubleshooting

### Worker Not Initializing
- Ensure `ZkappWorker.ts` is in `app/` directory
- Check webpack configuration allows worker imports
- Verify `import.meta.url` is supported

### Progress Not Updating
- Verify `setProgressCallback` is called before operations
- Check progress callback receives updates
- Ensure `updateStep` is called with correct step names

### Toasts Not Showing
- Add `<Toaster />` component to root layout
- Verify `react-hot-toast` is installed
- Check `notify` functions are imported correctly

## Files Modified/Created

### New Files
- `ui/hooks/useProofProgress.ts` - Progress state management
- `ui/lib/ToastNotifications.ts` - Centralized notifications
- `ui/components/NetworkGuard.tsx` - Network mismatch warning
- `ui/components/SteppedProgressIndicator.tsx` - Visual progress component
- `ui/components/EnhancedProofExample.tsx` - Integration example
- `FRONTEND_IMPROVEMENTS.md` - This documentation

### Modified Files
- `ui/app/ZkappWorker.ts` - Added progress callbacks
- `ui/context/WalletContext.tsx` - Added session timeout & event listeners
- `ui/lib/CompleteTransactionMonitor.ts` - Fixed GraphQL & added toasts

## Next Steps

1. **Update All Proof Components** - Apply new progress tracking to all proof generation flows
2. **Add Service Worker** - Cache large verification keys for instant second visits
3. **Implement Lazy Loading** - Only compile circuits when needed
4. **Add Telemetry** - Track performance metrics in production
5. **Create Storybook** - Document all new components visually

## Support

For questions or issues:
- Check the example in `EnhancedProofExample.tsx`
- Review the integration guide above
- Test with `npm run dev` and inspect console logs
