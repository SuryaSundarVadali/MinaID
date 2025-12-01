/**
 * TransactionQueueService
 * 
 * Production-grade transaction queue with:
 * - Retry logic with exponential backoff
 * - Concurrent transaction limit
 * - Persistent queue storage
 * - Status tracking and callbacks
 * - Network error handling
 */

export type TransactionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface QueuedTransaction {
  id: string;
  type: 'registerDID' | 'verifyProof' | 'updateDID' | 'revokeDID';
  data: any;
  status: TransactionStatus;
  retryCount: number;
  maxRetries: number;
  createdAt: number;
  lastAttempt?: number;
  error?: string;
  transactionHash?: string;
}

export interface TransactionResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

type TransactionCallback = (txId: string, result: TransactionResult) => void;

class TransactionQueueService {
  private queue: QueuedTransaction[] = [];
  private processing = false;
  private maxConcurrent = 5;
  private currentlyProcessing = 0;
  private callbacks: Map<string, TransactionCallback> = new Map();
  private readonly STORAGE_KEY = 'minaid_transaction_queue';
  private readonly BASE_RETRY_DELAY = 2000; // 2 seconds

  constructor() {
    this.loadQueue();
    // Auto-start processing on initialization
    this.startProcessing();
  }

  /**
   * Add a transaction to the queue
   */
  addTransaction(
    type: QueuedTransaction['type'],
    data: any,
    callback?: TransactionCallback,
    maxRetries = 3
  ): string {
    const txId = this.generateTxId();
    
    const transaction: QueuedTransaction = {
      id: txId,
      type,
      data,
      status: 'pending',
      retryCount: 0,
      maxRetries,
      createdAt: Date.now()
    };

    this.queue.push(transaction);
    
    if (callback) {
      this.callbacks.set(txId, callback);
    }

    this.saveQueue();
    this.startProcessing();

    console.log(`[TxQueue] Added transaction ${txId} of type ${type}`);
    return txId;
  }

  /**
   * Get transaction status
   */
  getTransactionStatus(txId: string): TransactionStatus | null {
    const tx = this.queue.find(t => t.id === txId);
    return tx ? tx.status : null;
  }

  /**
   * Get all transactions
   */
  getAllTransactions(): QueuedTransaction[] {
    return [...this.queue];
  }

  /**
   * Get pending count
   */
  getPendingCount(): number {
    return this.queue.filter(t => t.status === 'pending' || t.status === 'processing').length;
  }

  /**
   * Clear completed and failed transactions
   */
  clearCompleted(): void {
    this.queue = this.queue.filter(t => t.status === 'pending' || t.status === 'processing');
    this.saveQueue();
  }

  /**
   * Retry a failed transaction
   */
  retryTransaction(txId: string): boolean {
    const tx = this.queue.find(t => t.id === txId);
    if (!tx || tx.status !== 'failed') return false;

    tx.status = 'pending';
    tx.retryCount = 0;
    tx.error = undefined;
    
    this.saveQueue();
    this.startProcessing();
    
    console.log(`[TxQueue] Retrying transaction ${txId}`);
    return true;
  }

  /**
   * Remove a transaction from queue
   */
  removeTransaction(txId: string): boolean {
    const index = this.queue.findIndex(t => t.id === txId);
    if (index === -1) return false;

    this.queue.splice(index, 1);
    this.callbacks.delete(txId);
    this.saveQueue();
    
    console.log(`[TxQueue] Removed transaction ${txId}`);
    return true;
  }

  /**
   * Start processing the queue
   */
  private async startProcessing(): Promise<void> {
    if (this.processing) return;
    
    this.processing = true;
    
    while (this.queue.some(t => t.status === 'pending')) {
      // Respect concurrent limit
      if (this.currentlyProcessing >= this.maxConcurrent) {
        await this.sleep(1000);
        continue;
      }

      const tx = this.queue.find(t => t.status === 'pending');
      if (!tx) break;

      // Process transaction (don't await - allow concurrent)
      this.processTransaction(tx).catch(err => {
        console.error(`[TxQueue] Unhandled error processing ${tx.id}:`, err);
      });

      await this.sleep(100); // Small delay between starting transactions
    }

    this.processing = false;
  }

  /**
   * Process a single transaction
   */
  private async processTransaction(tx: QueuedTransaction): Promise<void> {
    this.currentlyProcessing++;
    tx.status = 'processing';
    tx.lastAttempt = Date.now();
    this.saveQueue();

    try {
      console.log(`[TxQueue] Processing ${tx.id} (attempt ${tx.retryCount + 1}/${tx.maxRetries + 1})`);

      const result = await this.executeTransaction(tx);

      if (result.success) {
        tx.status = 'completed';
        tx.transactionHash = result.transactionHash;
        console.log(`[TxQueue] ✓ Transaction ${tx.id} completed`);
        
        this.notifyCallback(tx.id, result);
      } else {
        throw new Error(result.error || 'Transaction failed');
      }

    } catch (error: any) {
      const errorMessage = error.message || 'Unknown error';
      console.error(`[TxQueue] Transaction ${tx.id} failed:`, errorMessage);

      // Check if we should retry
      if (tx.retryCount < tx.maxRetries && this.isRetryableError(error)) {
        tx.retryCount++;
        tx.status = 'pending';
        
        // Exponential backoff
        const delay = this.BASE_RETRY_DELAY * Math.pow(2, tx.retryCount - 1);
        console.log(`[TxQueue] Retrying ${tx.id} after ${delay}ms (retry ${tx.retryCount}/${tx.maxRetries})`);
        
        await this.sleep(delay);
      } else {
        tx.status = 'failed';
        tx.error = errorMessage;
        
        this.notifyCallback(tx.id, {
          success: false,
          error: errorMessage
        });
      }
    } finally {
      this.currentlyProcessing--;
      this.saveQueue();
    }
  }

  /**
   * Execute the actual transaction based on type
   */
  private async executeTransaction(tx: QueuedTransaction): Promise<TransactionResult> {
    // Import ContractInterface dynamically to avoid circular dependencies
    const { ContractInterface, DEFAULT_CONFIG } = await import('./ContractInterface');
    const contractInterface = new ContractInterface(DEFAULT_CONFIG);

    switch (tx.type) {
      case 'registerDID':
        return await this.executeRegisterDID(contractInterface, tx.data);
      
      case 'verifyProof':
        return await this.executeVerifyProof(contractInterface, tx.data);
      
      case 'updateDID':
        return await this.executeUpdateDID(contractInterface, tx.data);
      
      case 'revokeDID':
        return await this.executeRevokeDID(contractInterface, tx.data);
      
      default:
        throw new Error(`Unknown transaction type: ${tx.type}`);
    }
  }

  /**
   * Execute DID registration
   */
  private async executeRegisterDID(
    contractInterface: any,
    data: any
  ): Promise<TransactionResult> {
    try {
      const result = await contractInterface.registerDID(
        data.userPublicKey,
        data.didDocument,
        data.signature
      );

      return {
        success: true,
        transactionHash: result.hash
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute proof verification
   */
  private async executeVerifyProof(
    contractInterface: any,
    data: any
  ): Promise<TransactionResult> {
    try {
      const result = await contractInterface.verifyProof(
        data.proof,
        data.publicInput,
        data.verifierPublicKey
      );

      return {
        success: true,
        transactionHash: result.hash
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute DID update
   */
  private async executeUpdateDID(
    contractInterface: any,
    data: any
  ): Promise<TransactionResult> {
    try {
      const result = await contractInterface.updateDID(
        data.userPublicKey,
        data.newDidDocument,
        data.signature
      );

      return {
        success: true,
        transactionHash: result.hash
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Execute DID revocation
   */
  private async executeRevokeDID(
    contractInterface: any,
    data: any
  ): Promise<TransactionResult> {
    try {
      const result = await contractInterface.revokeDID(
        data.userPublicKey,
        data.signature
      );

      return {
        success: true,
        transactionHash: result.hash
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const message = error.message?.toLowerCase() || '';
    
    // Network errors
    if (message.includes('network') || message.includes('timeout') || message.includes('fetch')) {
      return true;
    }
    
    // Rate limiting
    if (message.includes('rate limit') || message.includes('too many requests')) {
      return true;
    }
    
    // Temporary server errors
    if (message.includes('503') || message.includes('502') || message.includes('504')) {
      return true;
    }

    return false;
  }

  /**
   * Notify callback for transaction result
   */
  private notifyCallback(txId: string, result: TransactionResult): void {
    const callback = this.callbacks.get(txId);
    if (callback) {
      try {
        callback(txId, result);
      } catch (error) {
        console.error(`[TxQueue] Error in callback for ${txId}:`, error);
      }
      this.callbacks.delete(txId);
    }
  }

  /**
   * Generate unique transaction ID
   */
  private generateTxId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Save queue to localStorage
   */
  private saveQueue(): void {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.queue));
    } catch (error) {
      console.error('[TxQueue] Failed to save queue:', error);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadQueue(): void {
    try {
      const saved = localStorage.getItem(this.STORAGE_KEY);
      if (saved) {
        this.queue = JSON.parse(saved);
        
        // Reset processing transactions to pending on load
        this.queue.forEach(tx => {
          if (tx.status === 'processing') {
            tx.status = 'pending';
          }
        });
        
        console.log(`[TxQueue] Loaded ${this.queue.length} transactions from storage`);
      }
    } catch (error) {
      console.error('[TxQueue] Failed to load queue:', error);
      this.queue = [];
    }
  }
}

// Export singleton instance
export const transactionQueue = new TransactionQueueService();
