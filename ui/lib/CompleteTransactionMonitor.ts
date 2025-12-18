/**
 * CompleteTransactionMonitor.ts
 * Monitors transaction status using Blockberry API (primary) and Minascan Archive (fallback).
 */

import { notify } from './ToastNotifications';
import { checkBlockberryTransaction } from './BlockberryMonitor';

// [FIX] Use the official Minascan Archive Node for Devnet
const GRAPHQL_ENDPOINT = 'https://api.minascan.io/node/devnet/v1/graphql';

// Monitoring configuration
const POLL_INTERVAL_MS = 5000; // 5 seconds - check frequently for blockchain confirmation
const MAX_WAIT_TIME_MS = 30 * 60 * 1000; // 30 minutes
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
  showToasts?: boolean; 
}

/**
 * Query transaction status using Blockberry API with GraphQL fallback
 */
async function queryTransactionStatus(
  txHash: string
): Promise<{ status: TxStatus; blockHeight?: number; failureReason?: string }> {
  try {
    // 1. Primary: Try Blockberry API
    const NEXT_PUBLIC_BLOCKBERRY_API_KEY = 'lTArAoBso7ZH6eH4dhCRFFa5runKoS';
    
    if (NEXT_PUBLIC_BLOCKBERRY_API_KEY) {
      const bbResult = await checkBlockberryTransaction(txHash, NEXT_PUBLIC_BLOCKBERRY_API_KEY);
      if (bbResult.included) {
        return { status: 'included', blockHeight: bbResult.data?.blockHeight || 0 };
      }
      if (bbResult.failed) {
        return { status: 'failed', failureReason: bbResult.error };
      }
    }

    // 2. Fallback: Use Minascan Archive GraphQL
    // First check mempool
    const mempoolResponse = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query CheckMempool($hash: String!) {
            pooledZkappCommands(hashes: [$hash]) {
              hash
              failureReason
            }
          }
        `,
        variables: { hash: txHash },
      }),
    });
    
    const mempoolResult = await mempoolResponse.json();
    
    if (mempoolResult.data?.pooledZkappCommands?.length > 0) {
      const pooledCmd = mempoolResult.data.pooledZkappCommands[0];
      if (pooledCmd.failureReason) {
        return { status: 'failed', failureReason: JSON.stringify(pooledCmd.failureReason) };
      }
      return { status: 'in_mempool' };
    }
    
    // If not in mempool, check bestChain for included transactions
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetTransaction($hash: String!) {
            bestChain(maxLength: 290) {
              protocolState {
                consensusState {
                  blockHeight
                }
              }
              transactions {
                zkappCommands {
                  hash
                  failureReason {
                    failures
                    index
                  }
                }
              }
            }
          }
        `,
        variables: { hash: txHash },
      }),
    });
    
    const result = await response.json();
    
    if (result.errors) {
      console.warn('[TransactionMonitor] GraphQL error:', result.errors);
      return { status: 'unknown' };
    }
    
    // Parse bestChain blocks
    const blocks = result.data?.bestChain || [];
    
    // Search through recent blocks for our transaction
    for (const block of blocks) {
      const zkappCommands = block.transactions?.zkappCommands || [];
      const tx = zkappCommands.find((cmd: any) => cmd.hash === txHash);
      
      if (tx) {
        const blockHeight = parseInt(block.protocolState?.consensusState?.blockHeight || '0');
        
        // Check for failure reason safely
        if (tx.failureReason) {
          let reason = 'Unknown failure';
          try {
            if (Array.isArray(tx.failureReason.failures)) {
              reason = tx.failureReason.failures.join(', ');
            } else {
              reason = JSON.stringify(tx.failureReason);
            }
          } catch (e) {
            reason = 'Failed (parsing error)';
          }
          return { status: 'failed', failureReason: reason };
        }
        return { status: 'included', blockHeight };
      }
    }
    
    // Not found in mempool or recent blocks (likely still pending)
    return { status: 'pending' };
    
  } catch (error) {
    console.warn('[TransactionMonitor] Query error:', error);
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
            blocks(limit: 1, sortBy: BLOCKHEIGHT_DESC) {
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
  const showToasts = callbacks?.showToasts !== false; 
  
  const startTime = Date.now();
  let currentStatus: TxStatus = 'pending';
  let blockHeight: number | undefined;
  let inProgressCount = 0;
  let extraWaitAdded = false;
  let effectiveMaxWait = maxWait;
  let toastId: string | undefined;
  
  console.log(`[TransactionMonitor] Monitoring: ${txHash}`);
  callbacks?.onStatusChange?.('pending', 'Starting transaction monitoring...');
  
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
        notify.warning('Monitoring timeout - transaction may still be processing');
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
          callbacks?.onStatusChange?.('in_mempool', 'Transaction in mempool, waiting for block inclusion...');
          break;
          
        case 'in_progress':
          inProgressCount++;
          callbacks?.onStatusChange?.('in_progress', `Proof verification in progress (${inProgressCount})...`);
          
          if (!extraWaitAdded) {
            effectiveMaxWait += IN_PROGRESS_EXTRA_WAIT_MS;
            extraWaitAdded = true;
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
 * [FIX] Exported Helper: Get human-readable status message
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
  return messages[status] || status;
}

/**
 * [FIX] Exported Helper: Format time remaining
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

export function estimateConfirmationTime(): {
  minTime: number;
  maxTime: number;
  averageTime: number;
} {
  return {
    minTime: 3 * 60 * 1000, 
    maxTime: 10 * 60 * 1000, 
    averageTime: 5 * 60 * 1000, 
  };
}