# MinaID API Reference

Quick reference for production services and components.

## Transaction Queue Service

### Import
```typescript
import { transactionQueue } from '../lib/TransactionQueueService';
```

### Methods

#### `addTransaction(type, data, callback?, maxRetries?)`
Queue a transaction for processing.

**Parameters**:
- `type`: `'registerDID' | 'verifyProof' | 'updateDID' | 'revokeDID'`
- `data`: Transaction-specific data
- `callback`: `(txId, result) => void` (optional)
- `maxRetries`: number (default: 3)

**Returns**: `string` - Transaction ID

**Example**:
```typescript
const txId = transactionQueue.addTransaction(
  'registerDID',
  { userPublicKey, didDocument, signature },
  (txId, result) => {
    console.log(result.success ? 'Success!' : 'Failed');
  }
);
```

#### `getTransactionStatus(txId)`
Get status of a transaction.

**Returns**: `'pending' | 'processing' | 'completed' | 'failed' | null`

#### `getPendingCount()`
Get number of pending transactions.

**Returns**: `number`

#### `retryTransaction(txId)`
Manually retry a failed transaction.

**Returns**: `boolean` - Success

#### `removeTransaction(txId)`
Remove transaction from queue.

**Returns**: `boolean` - Success

#### `clearCompleted()`
Remove all completed/failed transactions.

---

## WebSocket Service

### Import
```typescript
import { websocketService } from '../lib/WebSocketService';
```

### Methods

#### `connect()`
Connect to WebSocket server (auto-connects on initialization).

#### `disconnect()`
Disconnect from server.

#### `send(event, data)`
Send event to server.

**Parameters**:
- `event`: WebSocketEvent type
- `data`: any

**Example**:
```typescript
websocketService.send('VERIFICATION_REQUEST', {
  proofId: 'proof_123',
  verifierPublicKey: publicKey
});
```

#### `on(event, handler)`
Subscribe to event.

**Returns**: `() => void` - Unsubscribe function

**Example**:
```typescript
const unsubscribe = websocketService.on('PROOF_VERIFIED', (message) => {
  console.log('Proof verified!', message.data);
});

// Later...
unsubscribe();
```

#### `onStateChange(callback)`
Subscribe to connection state changes.

**Example**:
```typescript
websocketService.onStateChange((state) => {
  console.log('Connection:', state);
});
```

#### `getConnectionState()`
Get current connection state.

**Returns**: `'connected' | 'connecting' | 'disconnected' | 'error'`

### Events

- `PROOF_VERIFIED` - Proof verification completed
- `PROOF_FAILED` - Proof verification failed
- `VERIFICATION_REQUEST` - New verification request
- `USER_VERIFIED` - User successfully verified
- `DID_REGISTERED` - DID registration confirmed
- `DID_UPDATED` - DID update confirmed
- `DID_REVOKED` - DID revocation confirmed
- `TRANSACTION_CONFIRMED` - Transaction confirmed
- `TRANSACTION_FAILED` - Transaction failed

---

## Progress Indicator Service

### Import
```typescript
import { progressIndicator } from '../lib/ProgressIndicatorService';
```

### Methods

#### `startOperation(type, title, steps, estimatedDuration?)`
Start a new progress operation.

**Parameters**:
- `type`: `'proof-generation' | 'circuit-compilation' | 'transaction' | 'sync' | 'verification'`
- `title`: string
- `steps`: string[] - Step names
- `estimatedDuration`: number (milliseconds, optional)

**Returns**: `string` - Operation ID

**Example**:
```typescript
const opId = progressIndicator.startOperation(
  'proof-generation',
  'Generating age proof',
  ['Load circuit', 'Compile', 'Generate', 'Verify'],
  10000
);
```

#### `updateStep(operationId, stepId, progress, status?)`
Update step progress.

**Parameters**:
- `operationId`: string
- `stepId`: string (e.g., 'step_0', 'step_1')
- `progress`: number (0-100)
- `status`: `'pending' | 'in-progress' | 'completed' | 'failed'` (optional)

**Example**:
```typescript
progressIndicator.updateStep(opId, 'step_0', 50); // 50%
progressIndicator.updateStep(opId, 'step_0', 100, 'completed');
```

#### `completeStep(operationId, stepId)`
Mark step as completed (100% progress).

#### `failStep(operationId, stepId, error)`
Mark step as failed with error message.

#### `completeOperation(operationId)`
Complete entire operation.

#### `failOperation(operationId, error)`
Fail entire operation.

#### `subscribe(operationId, callback)`
Subscribe to operation updates.

**Returns**: `() => void` - Unsubscribe function

**Example**:
```typescript
const unsubscribe = progressIndicator.subscribe(opId, (operation) => {
  console.log('Progress:', operation.overallProgress);
});
```

#### `getOperation(operationId)`
Get operation details.

**Returns**: `ProgressOperation | undefined`

#### `getActiveOperations()`
Get all in-progress operations.

**Returns**: `ProgressOperation[]`

### Helper Methods

#### `createProofGenerationOperation(proofType)`
Quick setup for proof generation.

**Example**:
```typescript
const opId = progressIndicator.createProofGenerationOperation('age');
```

#### `createTransactionOperation(txType)`
Quick setup for transaction.

**Example**:
```typescript
const opId = progressIndicator.createTransactionOperation('DID Registration');
```

#### `createCircuitCompilationOperation(circuitName)`
Quick setup for circuit compilation.

**Example**:
```typescript
const opId = progressIndicator.createCircuitCompilationOperation('AgeVerification');
```

---

## Progress Indicator Component

### Import
```typescript
import { ProgressIndicator } from '../components/ProgressIndicator';
```

### Props

#### `ProgressIndicator`
Full progress UI with steps.

```typescript
<ProgressIndicator
  operationId={opId}
  onComplete={() => console.log('Done!')}
  onFail={(error) => console.error(error)}
  showSteps={true}
  showTimeEstimate={true}
/>
```

**Props**:
- `operationId`: string (required)
- `onComplete`: `() => void` (optional)
- `onFail`: `(error: string) => void` (optional)
- `showSteps`: boolean (default: true)
- `showTimeEstimate`: boolean (default: true)

#### `CompactProgressBar`
Inline progress bar.

```typescript
<CompactProgressBar operationId={opId} />
```

#### `ProgressBadge`
Status badge.

```typescript
<ProgressBadge operationId={opId} />
```

---

## Account Deletion Component

### Import
```typescript
import { AccountDeletion } from '../components/AccountDeletion';
```

### Props

```typescript
<AccountDeletion
  walletAddress={address}
  onDeleted={() => router.push('/')}
  onCancel={() => setShowDeletion(false)}
/>
```

**Props**:
- `walletAddress`: string (required)
- `onDeleted`: `() => void` (optional)
- `onCancel`: `() => void` (optional)

### Flow

1. **Confirm** - User types "DELETE" to confirm
2. **Authenticate** - Passkey biometric authentication
3. **Deleting** - Progress shown for each step
4. **Deleted** - Success confirmation

---

## Complete Example: DID Registration with Progress

```typescript
'use client';

import { useState } from 'react';
import { progressIndicator } from '../lib/ProgressIndicatorService';
import { transactionQueue } from '../lib/TransactionQueueService';
import { ProgressIndicator } from '../components/ProgressIndicator';

export default function RegisterDID() {
  const [operationId, setOperationId] = useState<string>('');
  const [txId, setTxId] = useState<string>('');
  
  const handleRegister = async () => {
    // 1. Start progress tracking
    const opId = progressIndicator.createTransactionOperation('DID Registration');
    setOperationId(opId);
    
    try {
      // 2. Build transaction
      progressIndicator.updateStep(opId, 'step_0', 50);
      const txData = {
        userPublicKey: publicKey.toBase58(),
        didDocument: documentHash,
        signature: signature
      };
      progressIndicator.completeStep(opId, 'step_0');
      
      // 3. Queue transaction
      progressIndicator.updateStep(opId, 'step_3', 0);
      const txId = transactionQueue.addTransaction(
        'registerDID',
        txData,
        (txId, result) => {
          if (result.success) {
            progressIndicator.completeOperation(opId);
            console.log('Success!', result.transactionHash);
          } else {
            progressIndicator.failOperation(opId, result.error || 'Failed');
          }
        }
      );
      setTxId(txId);
      progressIndicator.updateStep(opId, 'step_3', 100);
      
    } catch (error: any) {
      progressIndicator.failOperation(opId, error.message);
    }
  };
  
  return (
    <div>
      <button onClick={handleRegister}>Register DID</button>
      
      {operationId && (
        <ProgressIndicator
          operationId={operationId}
          onComplete={() => alert('DID registered!')}
          onFail={(error) => alert(error)}
        />
      )}
    </div>
  );
}
```

---

## Complete Example: Real-Time Proof Verification

```typescript
'use client';

import { useEffect, useState } from 'react';
import { websocketService } from '../lib/WebSocketService';

export default function VerifierDashboard() {
  const [proofs, setProofs] = useState<any[]>([]);
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  
  useEffect(() => {
    // Monitor connection
    const unsubscribeState = websocketService.onStateChange(setConnectionState);
    
    // Subscribe to verification events
    const unsubscribeVerified = websocketService.on('PROOF_VERIFIED', (message) => {
      console.log('Proof verified:', message.data);
      setProofs(prev => [...prev, { ...message.data, status: 'verified' }]);
    });
    
    const unsubscribeFailed = websocketService.on('PROOF_FAILED', (message) => {
      console.log('Proof failed:', message.data);
      setProofs(prev => [...prev, { ...message.data, status: 'failed' }]);
    });
    
    return () => {
      unsubscribeState();
      unsubscribeVerified();
      unsubscribeFailed();
    };
  }, []);
  
  return (
    <div>
      <div>Connection: {connectionState}</div>
      
      <h2>Verified Proofs</h2>
      {proofs.map((proof, i) => (
        <div key={i}>
          {proof.proofId} - {proof.status}
        </div>
      ))}
    </div>
  );
}
```

---

## Environment Variables

```bash
# WebSocket URL
NEXT_PUBLIC_WS_URL=ws://localhost:8080/minaid

# Network configuration
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_MINA_ENDPOINT=https://api.minascan.io/node/devnet/v1/graphql
```

---

## Error Handling

### Transaction Queue Errors
```typescript
transactionQueue.addTransaction('registerDID', data, (txId, result) => {
  if (!result.success) {
    // Handle specific errors
    if (result.error?.includes('Account not funded')) {
      alert('Please fund your account from faucet');
    } else if (result.error?.includes('network')) {
      alert('Network error - will retry automatically');
    } else {
      alert('Transaction failed: ' + result.error);
    }
  }
});
```

### WebSocket Errors
```typescript
websocketService.onStateChange((state) => {
  if (state === 'error') {
    console.error('WebSocket error - will auto-reconnect');
    // Show offline indicator
  } else if (state === 'connected') {
    console.log('WebSocket connected');
    // Hide offline indicator
  }
});
```

### Progress Errors
```typescript
progressIndicator.subscribe(opId, (operation) => {
  if (operation.status === 'failed') {
    const failedStep = operation.steps.find(s => s.status === 'failed');
    console.error('Step failed:', failedStep?.name, failedStep?.error);
  }
});
```
