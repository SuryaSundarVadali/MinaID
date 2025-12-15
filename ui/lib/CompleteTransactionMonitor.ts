/**
 * CompleteTransactionMonitor.ts
 * 
 * Monitors transaction status with GraphQL polling.
 * Handles "in progress" state properly and provides confirmation tracking.
 * Integrates with toast notifications for user feedback.
 */

import { notify } from './ToastNotifications';

// Network configuration
const GRAPHQL_ENDPOINT = 'https://api.minascan.io/archive/devnet/v1/graphql';

// Monitoring configuration
const POLL_INTERVAL_MS = 3000; // 3 seconds
const MAX_WAIT_TIME_MS = 5 * 60 * 1000; // 5 minutes
const IN_PROGRESS_EXTRA_WAIT_MS = 30 * 1000; // Extra 30s for "in progress"

export type TxStatus = 
  | 'unknown'
  | 'pending'
  | 'in_mempool'
  | 'in_progress'
  | 'included'
  | 'confirmed'
  | 'failed'
  | 'timeout';

export interface MonitoringResult {
  status: TxStatus;
  transactionHash: string;
  blockHeight?: number;
  blockHash?: string;
  confirmations: number;
  totalWaitTime: number;
  failureReason?: string;
}

export interface MonitoringCallbacks {
  onStatusChange?: (status: TxStatus, message: string) => void;
  onProgress?: (elapsed: number, maxWait: number) => void;
  onConfirmed?: (result: MonitoringResult) => void;
  onFailed?: (reason: string) => void;
  showToasts?: boolean; // Enable/disable toast notifications
}

import { checkBlockberryTransaction } from './BlockberryMonitor';

/**
 * Query transaction status using Blockberry API with GraphQL fallback
 */
async function queryTransactionStatus(
  txHash: string
): Promise<{ status: TxStatus; blockHeight?: number; failureReason?: string }> {
  try {
    // Primary: Try Blockberry API

    const NEXT_PUBLIC_BLOCKBERRY_API_KEY='lTArAoBso7ZH6eH4dhCRFFa5runKoS';
    const blockberryKey = NEXT_PUBLIC_BLOCKBERRY_API_KEY;
    if (blockberryKey) {
      const bbResult = await checkBlockberryTransaction(txHash, blockberryKey);
      if (bbResult.included) {
        return { status: 'included', blockHeight: bbResult.data?.blockHeight || 0 };
      }
      if (bbResult.failed) {
        return { status: 'failed', failureReason: bbResult.error };
      }
    }

    // Fallback: Use GraphQL to check if transaction is included in a block
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetTransaction($hash: String!) {
            transactions(query: {hash: $hash, canonical: true}, limit: 1) {
              hash
              blockHeight
              failureReason
            }
          }
        `,
        variables: { hash: txHash },
      }),
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.log('[TransactionMonitor] GraphQL error:', result.errors);
      return { status: 'unknown' };
    }
    
    const transactions = result.data?.transactions || [];
    
    // If transaction is found in a block, it's included
    if (transactions.length > 0) {
      const tx = transactions[0];
      if (tx.failureReason) {
        const reason = Array.isArray(tx.failureReason) 
          ? tx.failureReason.join(', ') 
          : String(tx.failureReason);
        return { status: 'failed', failureReason: reason };
      }
      return { status: 'included', blockHeight: tx.blockHeight || 0 };
    }
    
    // Not found in blocks yet - could be pending or in mempool
    // Since we can't easily query mempool status via Minascan GraphQL,
    // we'll return pending status
    return { status: 'pending' };
    
  } catch (error) {
    console.log('[TransactionMonitor] Query error:', error);
    return { status: 'unknown' };
  }
}

/**
 * Query latest block height for confirmation count
 */
async function queryLatestBlockHeight(): Promise<number | null> {
  try {
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            blocks(query: {canonical: true}, sortBy: BLOCKHEIGHT_DESC, limit: 1) {
              blockHeight
            }
          }
        `,
      }),
    });
    
    const result = await response.json();
    return result.data?.blocks?.[0]?.blockHeight || null;
    
  } catch (error) {
    return null;
  }
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Monitor transaction until confirmation or timeout
 */
export async function monitorTransaction(
  txHash: string,
  callbacks?: MonitoringCallbacks,
  options?: { maxWaitTime?: number; requiredConfirmations?: number }
): Promise<MonitoringResult> {
  const maxWait = options?.maxWaitTime || MAX_WAIT_TIME_MS;
  const requiredConfirmations = options?.requiredConfirmations || 1;
  const showToasts = callbacks?.showToasts !== false; // Default to true
  
  const startTime = Date.now();
  let currentStatus: TxStatus = 'pending';
  let blockHeight: number | undefined;
  let inProgressCount = 0;
  let extraWaitAdded = false;
  let effectiveMaxWait = maxWait;
  let toastId: string | undefined;
  
  console.log(`[TransactionMonitor] Monitoring transaction: ${txHash}`);
  callbacks?.onStatusChange?.('pending', 'Starting transaction monitoring...');
  
  // Show initial toast
  if (showToasts) {
    toastId = notify.tx.pending('Monitoring transaction...');
  }
  
  while (true) {
    const elapsed = Date.now() - startTime;
    
    // Check timeout
    if (elapsed >= effectiveMaxWait) {
      console.log(`[TransactionMonitor] ⏱️ Timeout after ${Math.round(elapsed / 1000)}s`);
      callbacks?.onFailed?.('Transaction monitoring timeout');
      
      if (showToasts) {
        notify.dismiss(toastId);
        notify.warning('Transaction monitoring timeout - it may still be processing');
      }
      
      return {
        status: 'timeout',
        transactionHash: txHash,
        confirmations: 0,
        totalWaitTime: elapsed,
        failureReason: 'Monitoring timeout - transaction may still be processing',
      };
    }
    
    // Report progress
    callbacks?.onProgress?.(elapsed, effectiveMaxWait);
    
    // Query status
    const statusResult = await queryTransactionStatus(txHash);
    
    // Handle status changes
    if (statusResult.status !== currentStatus) {
      currentStatus = statusResult.status;
      console.log(`[TransactionMonitor] Status changed to: ${currentStatus}`);
      
      switch (currentStatus) {
        case 'pending':
          callbacks?.onStatusChange?.('pending', 'Transaction submitted, waiting for mempool...');
          break;
          
        case 'in_mempool':
          callbacks?.onStatusChange?.('in_mempool', 'Transaction in mempool, waiting for block...');
          break;
          
        case 'in_progress':
          inProgressCount++;
          callbacks?.onStatusChange?.('in_progress', `Proof verification in progress (${inProgressCount})...`);
          
          // Add extra wait time for "in progress"
          if (!extraWaitAdded) {
            effectiveMaxWait += IN_PROGRESS_EXTRA_WAIT_MS;
            extraWaitAdded = true;
            console.log(`[TransactionMonitor] Added extra wait time for in-progress state`);
          }
          break;
          
        case 'included':
          blockHeight = statusResult.blockHeight;
          callbacks?.onStatusChange?.('included', `Included in block ${blockHeight}`);
          break;
          
        case 'failed':
          console.log(`[TransactionMonitor] ❌ Transaction failed: ${statusResult.failureReason}`);
          callbacks?.onFailed?.(statusResult.failureReason || 'Unknown failure');
          
          if (showToasts) {
            notify.dismiss(toastId);
            notify.tx.failed(statusResult.failureReason || 'Unknown failure');
          }
          
          return {
            status: 'failed',
            transactionHash: txHash,
            blockHeight,
            confirmations: 0,
            totalWaitTime: elapsed,
            failureReason: statusResult.failureReason,
          };
      }
    }
    
    // Check for confirmation if included
    if (currentStatus === 'included' && blockHeight) {
      const latestBlock = await queryLatestBlockHeight();
      if (latestBlock) {
        const confirmations = latestBlock - blockHeight;
        
        if (confirmations >= requiredConfirmations) {
          console.log(`[TransactionMonitor] ✅ Confirmed! ${confirmations} confirmations`);
          callbacks?.onStatusChange?.('confirmed', `Confirmed with ${confirmations} confirmations`);
          callbacks?.onConfirmed?.({
            status: 'confirmed',
            transactionHash: txHash,
            blockHeight,
            confirmations,
            totalWaitTime: Date.now() - startTime,
          });
          
          if (showToasts) {
            notify.dismiss(toastId);
            notify.tx.confirmed(txHash, confirmations);
          }
          
          return {
            status: 'confirmed',
            transactionHash: txHash,
            blockHeight,
            confirmations,
            totalWaitTime: Date.now() - startTime,
          };
        }
      }
    }
    
    // Wait before next poll
    await sleep(POLL_INTERVAL_MS);
  }
}

/**
 * Quick status check (single query, no waiting)
 */
export async function checkTransactionStatus(txHash: string): Promise<TxStatus> {
  const result = await queryTransactionStatus(txHash);
  return result.status;
}

/**
 * Monitor multiple transactions
 */
export async function monitorTransactions(
  txHashes: string[],
  callbacks?: {
    onTransaction?: (hash: string, result: MonitoringResult) => void;
    onAllComplete?: (results: Map<string, MonitoringResult>) => void;
  }
): Promise<Map<string, MonitoringResult>> {
  const results = new Map<string, MonitoringResult>();
  
  // Monitor all in parallel
  const promises = txHashes.map(async (hash) => {
    const result = await monitorTransaction(hash);
    results.set(hash, result);
    callbacks?.onTransaction?.(hash, result);
    return result;
  });
  
  await Promise.all(promises);
  callbacks?.onAllComplete?.(results);
  
  return results;
}

/**
 * Estimate time to confirmation based on network
 */
export function estimateConfirmationTime(): {
  minTime: number;
  maxTime: number;
  averageTime: number;
} {
  // Devnet block time is ~3 minutes
  return {
    minTime: 3 * 60 * 1000, // 3 minutes
    maxTime: 10 * 60 * 1000, // 10 minutes
    averageTime: 5 * 60 * 1000, // 5 minutes
  };
}

/**
 * Get human-readable status message
 */
export function getStatusMessage(status: TxStatus): string {
  const messages: Record<TxStatus, string> = {
    unknown: 'Checking transaction status...',
    pending: 'Transaction submitted, waiting for network...',
    in_mempool: 'Transaction in mempool, waiting for block inclusion...',
    in_progress: 'Proof verification in progress on chain...',
    included: 'Transaction included in block, waiting for confirmations...',
    confirmed: 'Transaction confirmed!',
    failed: 'Transaction failed',
    timeout: 'Transaction monitoring timeout',
  };
  return messages[status];
}

/**
 * Format time remaining
 */
export function formatTimeRemaining(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${seconds}s`;
}
