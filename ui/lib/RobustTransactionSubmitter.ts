/**
 * RobustTransactionSubmitter.ts
 * 
 * Handles transaction submission with exponential backoff, retry logic,
 * and proper error categorization to handle "Invalid_proof In progress" errors.
 */

import { GeneratedProof } from './SmartProofGenerator';
import { markProofSubmitted, validateProofForSubmission } from './PreSubmissionValidator';

// Network configuration
const GRAPHQL_ENDPOINT = 'https://api.minascan.io/archive/devnet/v1/graphql';

// Retry configuration
const MAX_RETRIES = 4;
const INITIAL_DELAY_MS = 1000;
const MAX_DELAY_MS = 16000;
const TRANSACTION_TIMEOUT_MS = 45000;

export type TransactionStatus = 
  | 'pending'
  | 'submitted'
  | 'confirmed'
  | 'failed'
  | 'timeout'
  | 'retry';

export interface SubmissionResult {
  success: boolean;
  transactionHash?: string;
  status: TransactionStatus;
  error?: string;
  errorType?: 'transient' | 'permanent' | 'unknown';
  attempts: number;
  totalTime: number;
}

export interface SubmissionCallbacks {
  onAttempt?: (attempt: number, maxAttempts: number) => void;
  onRetry?: (delay: number, reason: string) => void;
  onSuccess?: (txHash: string) => void;
  onError?: (error: string, errorType: string) => void;
}

// Error patterns for categorization
const TRANSIENT_ERRORS = [
  'in progress',
  'in_progress',
  'rate limit',
  'timeout',
  'network error',
  'connection refused',
  'econnrefused',
  'etimedout',
  'temporary',
  'retry',
  'busy',
];

const PERMANENT_ERRORS = [
  'invalid proof',
  'invalid_proof',
  'verification failed',
  'insufficient funds',
  'invalid signature',
  'invalid nonce',
  'account not found',
  'unauthorized',
];

/**
 * Categorize error type for retry logic
 */
function categorizeError(error: string): 'transient' | 'permanent' | 'unknown' {
  const lowerError = error.toLowerCase();
  
  // Special case: "Invalid_proof In progress" is transient!
  if (lowerError.includes('invalid_proof') && lowerError.includes('in progress')) {
    return 'transient';
  }
  
  if (TRANSIENT_ERRORS.some(pattern => lowerError.includes(pattern))) {
    return 'transient';
  }
  
  if (PERMANENT_ERRORS.some(pattern => lowerError.includes(pattern))) {
    return 'permanent';
  }
  
  return 'unknown';
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(attempt: number): number {
  const delay = INITIAL_DELAY_MS * Math.pow(2, attempt - 1);
  // Add jitter (0-500ms)
  const jitter = Math.random() * 500;
  return Math.min(delay + jitter, MAX_DELAY_MS);
}

/**
 * Sleep helper
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Create transaction with timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutHandle);
  });
}

/**
 * Check if Auro wallet is available
 */
function getAuroWallet(): any | null {
  if (typeof window === 'undefined') return null;
  return (window as any).mina;
}

/**
 * Submit transaction using Auro wallet
 */
async function submitWithWallet(
  transactionJSON: string
): Promise<{ hash: string }> {
  const wallet = getAuroWallet();
  if (!wallet) {
    throw new Error('Auro wallet not available');
  }
  
  // Send transaction
  const result = await wallet.sendTransaction({
    transaction: transactionJSON,
    feePayer: {
      fee: '0.1', // 0.1 MINA
      memo: 'MinaID verification',
    },
  });
  
  if (result.hash) {
    return { hash: result.hash };
  }
  
  throw new Error(result.message || 'Transaction failed');
}

/**
 * Submit to GraphQL directly (fallback)
 */
async function submitToGraphQL(
  signedTransaction: string
): Promise<{ hash: string }> {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: `
        mutation SendZkApp($input: SendZkappInput!) {
          sendZkapp(input: $input) {
            zkapp {
              hash
            }
          }
        }
      `,
      variables: {
        input: {
          zkappCommand: signedTransaction,
        },
      },
    }),
  });
  
  const result = await response.json();
  
  if (result.errors) {
    throw new Error(result.errors[0]?.message || 'GraphQL error');
  }
  
  return { hash: result.data?.sendZkapp?.zkapp?.hash || '' };
}

/**
 * Main transaction submission function with retry logic
 */
export async function submitTransaction(
  proof: GeneratedProof,
  transactionBuilder: () => Promise<string>,
  callbacks?: SubmissionCallbacks
): Promise<SubmissionResult> {
  const startTime = performance.now();
  let attempts = 0;
  let lastError = '';
  let lastErrorType: 'transient' | 'permanent' | 'unknown' = 'unknown';
  
  console.log('[RobustTransactionSubmitter] Starting submission...');
  
  // Pre-validation
  const validation = await validateProofForSubmission(proof);
  if (!validation.isValid) {
    return {
      success: false,
      status: 'failed',
      error: validation.errors.join('; '),
      errorType: 'permanent',
      attempts: 0,
      totalTime: performance.now() - startTime,
    };
  }
  
  // Retry loop
  while (attempts < MAX_RETRIES) {
    attempts++;
    callbacks?.onAttempt?.(attempts, MAX_RETRIES);
    
    console.log(`[RobustTransactionSubmitter] Attempt ${attempts}/${MAX_RETRIES}`);
    
    try {
      // Build transaction
      const transactionJSON = await withTimeout(
        transactionBuilder(),
        TRANSACTION_TIMEOUT_MS,
        'Transaction build timeout'
      );
      
      // Submit using wallet
      const wallet = getAuroWallet();
      let result: { hash: string };
      
      if (wallet) {
        result = await withTimeout(
          submitWithWallet(transactionJSON),
          TRANSACTION_TIMEOUT_MS,
          'Wallet transaction timeout'
        );
      } else {
        result = await withTimeout(
          submitToGraphQL(transactionJSON),
          TRANSACTION_TIMEOUT_MS,
          'GraphQL submission timeout'
        );
      }
      
      // Success!
      console.log(`[RobustTransactionSubmitter] ✅ Transaction submitted: ${result.hash}`);
      callbacks?.onSuccess?.(result.hash);
      
      // Mark proof as submitted
      markProofSubmitted(validation.proofHash);
      
      return {
        success: true,
        transactionHash: result.hash,
        status: 'submitted',
        attempts,
        totalTime: performance.now() - startTime,
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      lastError = errorMessage;
      lastErrorType = categorizeError(errorMessage);
      
      console.log(`[RobustTransactionSubmitter] ❌ Attempt ${attempts} failed:`, errorMessage);
      console.log(`[RobustTransactionSubmitter] Error type: ${lastErrorType}`);
      
      callbacks?.onError?.(errorMessage, lastErrorType);
      
      // Don't retry permanent errors
      if (lastErrorType === 'permanent') {
        console.log('[RobustTransactionSubmitter] Permanent error, not retrying');
        break;
      }
      
      // Calculate retry delay
      if (attempts < MAX_RETRIES) {
        const delay = calculateDelay(attempts);
        console.log(`[RobustTransactionSubmitter] Retrying in ${delay}ms...`);
        callbacks?.onRetry?.(delay, errorMessage);
        await sleep(delay);
      }
    }
  }
  
  // All attempts failed
  console.log(`[RobustTransactionSubmitter] ❌ All ${attempts} attempts failed`);
  
  return {
    success: false,
    status: lastErrorType === 'permanent' ? 'failed' : 'timeout',
    error: lastError,
    errorType: lastErrorType,
    attempts,
    totalTime: performance.now() - startTime,
  };
}

/**
 * Submit verification proof to ZKPVerifier contract
 */
export async function submitVerificationProof(
  proof: GeneratedProof,
  contractInterface: any, // ContractInterface instance
  callbacks?: SubmissionCallbacks
): Promise<SubmissionResult> {
  return submitTransaction(
    proof,
    async () => {
      // Build the verification transaction
      const result = await contractInterface.verifyProofOnChain(proof, null);
      return result.transactionJSON;
    },
    callbacks
  );
}

/**
 * Quick check if submission is possible
 */
export function canSubmit(): { ready: boolean; reason?: string } {
  const wallet = getAuroWallet();
  if (!wallet) {
    return { ready: false, reason: 'Auro wallet not connected' };
  }
  
  return { ready: true };
}

/**
 * Get estimated wait time based on network conditions
 */
export function getEstimatedWaitTime(): number {
  // Base estimate: 3-5 minutes for devnet
  return 4 * 60 * 1000; // 4 minutes
}
