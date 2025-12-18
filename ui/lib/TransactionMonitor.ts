/**
 * TransactionMonitor - Handles transaction lifecycle and retry logic
 * 
 * This module monitors transaction status and handles "in progress" states
 * with intelligent retry logic to improve reliability.
 */

import { checkBlockberryTransaction } from './BlockberryMonitor';

export type TransactionStatus = 
  | 'pending'
  | 'in-progress'
  | 'success'
  | 'failed'
  | 'expired'
  | 'unknown';

export interface TransactionResult {
  status: TransactionStatus;
  hash?: string;
  message?: string;
  timestamp: number;
  attempts: number;
  lastError?: string;
}

export interface MonitorConfig {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  backoffMultiplier?: number;
  timeout?: number;
  onStatusChange?: (status: TransactionStatus, result: TransactionResult) => void;
}

const DEFAULT_CONFIG: Required<Omit<MonitorConfig, 'onStatusChange'>> = {
  maxAttempts: 360,          // 360 attempts
  initialDelay: 5000,        // 5 seconds
  maxDelay: 10000,           // 10 seconds max
  backoffMultiplier: 1.1,
  timeout: 1800000           // 30 minutes total timeout
};

export class TransactionMonitor {
  private config: Required<Omit<MonitorConfig, 'onStatusChange'>> & { onStatusChange?: (status: TransactionStatus, result: TransactionResult) => void };
  private abortController: AbortController | null = null;

  constructor(config: MonitorConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Monitor a transaction until completion or timeout
   */
  async monitor(
    txHash: string,
    checkFn: (hash: string) => Promise<{ included: boolean; failed?: boolean; error?: string }>
  ): Promise<TransactionResult> {
    this.abortController = new AbortController();
    const startTime = Date.now();
    let attempts = 0;
    let delay = this.config.initialDelay;
    let lastStatus: TransactionStatus = 'pending';

    const result: TransactionResult = {
      status: 'pending',
      hash: txHash,
      timestamp: startTime,
      attempts: 0
    };

    while (attempts < this.config.maxAttempts) {
      // Check timeout
      if (Date.now() - startTime > this.config.timeout) {
        result.status = 'expired';
        result.message = `Transaction monitoring timed out after ${Math.round(this.config.timeout / 1000)}s`;
        this.notifyStatusChange(result.status, result);
        return result;
      }

      // Check if aborted
      if (this.abortController.signal.aborted) {
        result.status = 'unknown';
        result.message = 'Monitoring was cancelled';
        return result;
      }

      attempts++;
      result.attempts = attempts;

      try {
        console.log(`[TxMonitor] Checking transaction status (attempt ${attempts}/${this.config.maxAttempts})...`);
        
        const status = await checkFn(txHash);

        if (status.failed) {
          result.status = 'failed';
          result.lastError = status.error;
          result.message = `Transaction failed: ${status.error || 'Unknown error'}`;
          this.notifyStatusChange(result.status, result);
          return result;
        }

        if (status.included) {
          result.status = 'success';
          result.message = 'Transaction successfully included in a block';
          this.notifyStatusChange(result.status, result);
          return result;
        }

        // Still pending/in-progress
        const newStatus: TransactionStatus = 'in-progress';
        if (newStatus !== lastStatus) {
          lastStatus = newStatus;
          result.status = newStatus;
          this.notifyStatusChange(result.status, result);
        }

      } catch (error) {
        console.warn(`[TxMonitor] Check failed:`, error);
        result.lastError = error instanceof Error ? error.message : String(error);
      }

      // Wait with exponential backoff
      await this.sleep(delay);
      delay = Math.min(delay * this.config.backoffMultiplier, this.config.maxDelay);
    }

    // Max attempts reached
    result.status = 'in-progress';
    result.message = `Transaction still pending after ${attempts} checks. It may complete later.`;
    return result;
  }

  /**
   * Cancel ongoing monitoring
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Wait for multiple transactions
   */
  async monitorMultiple(
    transactions: { hash: string; checkFn: (hash: string) => Promise<{ included: boolean; failed?: boolean; error?: string }> }[]
  ): Promise<TransactionResult[]> {
    return Promise.all(
      transactions.map(tx => this.monitor(tx.hash, tx.checkFn))
    );
  }

  private notifyStatusChange(status: TransactionStatus, result: TransactionResult): void {
    if (this.config.onStatusChange) {
      this.config.onStatusChange(status, result);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Helper to check Mina transaction status using Blockberry API with GraphQL fallback
 */
export async function checkMinaTransaction(
  txHash: string,
  graphqlEndpoint: string = 'https://api.minascan.io/node/devnet/v1/graphql'
): Promise<{ included: boolean; failed?: boolean; error?: string }> {
  try {
    // Primary: Try Blockberry API
    const blockberryKey = process.env.NEXT_PUBLIC_BLOCKBERRY_API_KEY;
    if (blockberryKey) {
      const bbResult = await checkBlockberryTransaction(txHash, blockberryKey);
      // Only return immediately if we get a definitive result
      if (bbResult.included || bbResult.failed) {
        return bbResult;
      }
    }

    // Fallback: Use GraphQL Archive Node
    // First check if transaction is in mempool
    const mempoolQuery = `
      query CheckMempool($hash: String!) {
        pooledZkappCommands(hashes: [$hash]) {
          hash
          failureReason
        }
      }
    `;

    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: mempoolQuery,
        variables: { hash: txHash }
      })
    });

    const mempoolData = await response.json();
    
    if (mempoolData.data?.pooledZkappCommands?.length > 0) {
      const pooledCmd = mempoolData.data.pooledZkappCommands[0];
      if (pooledCmd.failureReason) {
        return { included: false, failed: true, error: JSON.stringify(pooledCmd.failureReason) };
      }
      // In mempool, still pending
      return { included: false };
    }

    // If not in mempool, check if included in a block using bestChain
    const query = `
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
    `;

    const chainResponse = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { hash: txHash }
      })
    });

    const data = await chainResponse.json();
    
    if (data.errors) {
      console.warn('[checkMinaTransaction] GraphQL errors:', data.errors);
      return { included: false };
    }
    
    const blocks = data?.data?.bestChain || [];
    
    // Search through recent blocks for our transaction
    for (const block of blocks) {
      const zkappCommands = block.transactions?.zkappCommands || [];
      const tx = zkappCommands.find((cmd: any) => cmd.hash === txHash);
      
      if (tx) {
        const blockHeight = parseInt(block.protocolState?.consensusState?.blockHeight || '0');
    
        // Check for failure reason
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
          return { included: false, failed: true, error: reason };
        }
        
        // Transaction found and no failure - it's included!
        return { included: true };
      }
    }
    
    // Not found in recent blocks - still pending
    return { included: false };
  } catch (error) {
    console.warn('[checkMinaTransaction] Error:', error);
    return { included: false };
  }
}

/**
 * Create a simple status display message
 */
export function formatTransactionStatus(result: TransactionResult): string {
  switch (result.status) {
    case 'pending':
      return 'Transaction submitted, waiting for confirmation...';
    case 'in-progress':
      return `Transaction in progress (${result.attempts} checks)...`;
    case 'success':
      return '✅ Transaction confirmed!';
    case 'failed':
      return `❌ Transaction failed: ${result.lastError || 'Unknown error'}`;
    case 'expired':
      return '⏱️ Transaction monitoring timed out';
    default:
      return 'Transaction status unknown';
  }
}

// Export a default instance
export const txMonitor = new TransactionMonitor();
