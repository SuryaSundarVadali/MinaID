/**
 * BlockberryAPI.ts
 * 
 * Utility for interacting with Blockberry API
 * Documentation: https://docs.blockberry.one/
 */

const BLOCKBERRY_API_KEY = 'lTArAoBso7ZH6eH4dhCRFFa5runKoS';
const BLOCKBERRY_BASE_URL = 'https://api.blockberry.one/mina-devnet/v1';
const EXPLORER_BASE_URL = 'https://devnet.blockberry.one';

export interface BlockberryTransaction {
  hash: string;
  blockHeight: number;
  blockHash: string;
  blockStateHash: string;
  dateTime: string;
  status: 'applied' | 'failed' | 'pending';
  failureReason?: string;
  nonce: number;
  from: string;
  to?: string;
  fee: number;
  amount: number;
  memo?: string;
  kind: string;
  zkappAccountUpdateIds?: string[];
}

export interface BlockberryBlock {
  blockHeight: number;
  blockHash: string;
  blockStateHash: string;
  dateTime: string;
  transactionCount: number;
  zkappCommandsCount: number;
  canonical: boolean;
  creatorAccount: string;
  winnerAccount: string;
  coinbase: number;
  globalSlotSinceGenesis: number;
}

/**
 * Fetch transaction details by hash from Blockberry API
 */
export async function getTransactionByHash(txHash: string): Promise<BlockberryTransaction | null> {
  try {
    console.log('[Blockberry] Fetching transaction:', txHash);
    
    const response = await fetch(
      `${BLOCKBERRY_BASE_URL}/zkapps/txs/${txHash}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': BLOCKBERRY_API_KEY,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[Blockberry] Transaction not found yet (might still be pending)');
        return null;
      }
      throw new Error(`Blockberry API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Blockberry] Transaction found:', data);
    
    return data;
  } catch (error) {
    console.error('[Blockberry] Error fetching transaction:', error);
    return null;
  }
}

/**
 * Fetch block details by height from Blockberry API
 */
export async function getBlockByHeight(blockHeight: number): Promise<BlockberryBlock | null> {
  try {
    console.log('[Blockberry] Fetching block:', blockHeight);
    
    const response = await fetch(
      `${BLOCKBERRY_BASE_URL}/blocks/${blockHeight}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': BLOCKBERRY_API_KEY,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Blockberry API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('[Blockberry] Error fetching block:', error);
    return null;
  }
}

/**
 * Get explorer URL for transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${EXPLORER_BASE_URL}/transaction/${txHash}`;
}

/**
 * Get explorer URL for block
 */
export function getExplorerBlockUrl(blockHeight: number): string {
  return `${EXPLORER_BASE_URL}/block/${blockHeight}`;
}

/**
 * Poll transaction status until confirmed or timeout
 */
export async function pollTransactionStatus(
  txHash: string,
  maxAttempts: number = 60,
  intervalMs: number = 5000
): Promise<BlockberryTransaction | null> {
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`[Blockberry] Polling attempt ${attempts}/${maxAttempts}`);
    
    const tx = await getTransactionByHash(txHash);
    
    if (tx && tx.status === 'applied') {
      console.log('[Blockberry] Transaction confirmed!');
      return tx;
    }
    
    if (tx && tx.status === 'failed') {
      console.log('[Blockberry] Transaction failed:', tx.failureReason);
      return tx;
    }
    
    // Wait before next attempt
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }
  
  console.log('[Blockberry] Polling timeout');
  return null;
}

/**
 * Get transaction confirmation count
 */
export async function getTransactionConfirmations(
  txHash: string,
  currentBlockHeight?: number
): Promise<number> {
  try {
    const tx = await getTransactionByHash(txHash);
    
    if (!tx || !tx.blockHeight) {
      return 0;
    }
    
    // If current block height not provided, fetch latest block
    let latestHeight = currentBlockHeight;
    if (!latestHeight) {
      // For now, assume tx is confirmed if it has a block height
      // In production, you'd fetch the latest block height from API
      return tx.status === 'applied' ? 1 : 0;
    }
    
    return Math.max(0, latestHeight - tx.blockHeight);
  } catch (error) {
    console.error('[Blockberry] Error getting confirmations:', error);
    return 0;
  }
}

/**
 * Verification key history entry
 */
export interface VerificationKeyHistoryEntry {
  hash: string;
  verificationKey: {
    data: string;
    hash: string;
  };
  txHash: string;
  blockHeight: number;
  blockStateHash: string;
  dateTime: string;
}

/**
 * Fetch verification key history for a zkApp account
 * @param address - The zkApp account address (B62q...)
 */
export async function getVerificationKeyHistory(address: string): Promise<VerificationKeyHistoryEntry[]> {
  try {
    console.log('[Blockberry] Fetching verification key history for:', address);
    
    const response = await fetch(
      `${BLOCKBERRY_BASE_URL}/zkapps/${address}/verification-key-history`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': BLOCKBERRY_API_KEY,
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[Blockberry] No verification history found for address');
        return [];
      }
      throw new Error(`Blockberry API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    console.log('[Blockberry] Verification key history:', data);
    
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[Blockberry] Error fetching verification history:', error);
    return [];
  }
}
