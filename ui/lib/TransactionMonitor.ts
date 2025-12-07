/**
 * TransactionMonitor - Handles transaction lifecycle and retry logic
 * 
 * This module monitors transaction status and handles "in progress" states
 * with intelligent retry logic to improve reliability.
 */

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
  maxAttempts: 10,
  initialDelay: 2000,      // 2 seconds
  maxDelay: 30000,         // 30 seconds
  backoffMultiplier: 1.5,
  timeout: 300000          // 5 minutes total timeout
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
 * Helper to check Mina transaction status using GraphQL
 */
export async function checkMinaTransaction(
  txHash: string,
  graphqlEndpoint: string = 'https://api.minascan.io/node/devnet/v1/graphql'
): Promise<{ included: boolean; failed?: boolean; error?: string }> {
  try {
    const query = `
      query GetTransaction($hash: String!) {
        transaction(hash: $hash) {
          hash
          status
          failureReason
        }
      }
    `;

    const response = await fetch(graphqlEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { hash: txHash }
      })
    });

    const data = await response.json();
    const tx = data?.data?.transaction;

    if (!tx) {
      return { included: false };
    }

    if (tx.status === 'INCLUDED' || tx.status === 'applied') {
      return { included: true };
    }

    if (tx.status === 'FAILED' || tx.failureReason) {
      return { included: false, failed: true, error: tx.failureReason };
    }

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
