import { TransactionResult } from './TransactionMonitor';

const BLOCKBERRY_API_BASE = 'https://api.blockberry.one/mina-devnet/v1';

interface BlockberryZkAppTransaction {
  txHash: string;
  txStatus: string;
  blockHeight?: number;
  dateTime: string;
  failureReason?: Array<{ index: number; failures: string[] }>;
}

/**
 * Check zkApp transaction status using Blockberry API
 * Uses the zkApps-specific endpoint for better reliability
 */
export async function checkBlockberryTransaction(
  txHash: string,
  apiKey: string
): Promise<{ included: boolean; failed?: boolean; error?: string; data?: any }> {
  try {
    // Use the zkApps-specific endpoint
    const response = await fetch(`${BLOCKBERRY_API_BASE}/zkapps/txs/${txHash}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey
      }
    });

    if (!response.ok) {
      if (response.status === 404) {
        // Transaction not found yet
        return { included: false };
      }
      console.warn('[checkBlockberryTransaction] API error:', response.status, response.statusText);
      return { included: false };
    }

    // Check for empty response
    const text = await response.text();
    if (!text) {
      return { included: false };
    }

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      console.warn('[checkBlockberryTransaction] Failed to parse JSON:', e);
      return { included: false };
    }
    
    const tx: BlockberryZkAppTransaction = data;

    if (!tx || !tx.txHash) {
      return { included: false };
    }

    // Check transaction status
    if (tx.txStatus === 'applied' || tx.txStatus === 'canonical') {
       return { included: true, data: tx };
    }

    if (tx.txStatus === 'failed') {
      const failureMsg = tx.failureReason 
        ? tx.failureReason.map(f => f.failures.join(', ')).join('; ')
        : 'Transaction failed';
      return { included: false, failed: true, error: failureMsg };
    }

    // pending or other status
    return { included: false };

  } catch (error) {
    console.warn('[checkBlockberryTransaction] Error:', error);
    return { included: false };
  }
}

/**
 * Get zkApp transactions by account address
 */
export async function getZkAppTransactionsByAddress(
  address: string,
  apiKey: string,
  limit: number = 10
): Promise<BlockberryZkAppTransaction[]> {
  try {
    const response = await fetch(
      `${BLOCKBERRY_API_BASE}/zkapps/accounts/${address}/txs?limit=${limit}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'x-api-key': apiKey
        }
      }
    );

    if (!response.ok) {
      console.warn('[getZkAppTransactionsByAddress] API error:', response.status);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn('[getZkAppTransactionsByAddress] Error:', error);
    return [];
  }
}
