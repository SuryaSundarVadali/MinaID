
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
): Promise<{ included: boolean; failed?: boolean; error?: string; data?: any; pending?: boolean }> {
  try {
    console.log('[checkBlockberryTransaction] Fetching tx:', txHash);
    
    // Use the correct zkApps endpoint (without /raw/)
    const response = await fetch(`${BLOCKBERRY_API_BASE}/zkapps/txs/${txHash}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-api-key': apiKey
      }
    });

    console.log('[checkBlockberryTransaction] Response status:', response.status);

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[checkBlockberryTransaction] Transaction not found yet (404) - still pending');
        return { included: false, pending: true };
      }
      console.warn('[checkBlockberryTransaction] API error:', response.status, response.statusText);
      return { included: false };
    }

    // Check for empty response
    const text = await response.text();
    console.log('[checkBlockberryTransaction] Response text length:', text.length);
    
    if (!text) {
      console.log('[checkBlockberryTransaction] Empty response - transaction pending');
      return { included: false, pending: true };
    }

    let data;
    try {
      data = JSON.parse(text);
      console.log('[checkBlockberryTransaction] Parsed data:', JSON.stringify(data, null, 2));
    } catch (e) {
      console.warn('[checkBlockberryTransaction] Failed to parse JSON:', e);
      console.warn('[checkBlockberryTransaction] Raw text:', text);
      return { included: false };
    }
    
    const tx: BlockberryZkAppTransaction = data;

    if (!tx || !tx.txHash) {
      console.warn('[checkBlockberryTransaction] Invalid response structure:', data);
      return { included: false };
    }

    console.log('[checkBlockberryTransaction] Transaction status:', tx.txStatus);

    // Check transaction status
    if (tx.txStatus === 'applied' || tx.txStatus === 'canonical') {
       console.log('[checkBlockberryTransaction] ✅ Transaction included! Block:', tx.blockHeight);
       return { included: true, data: tx };
    }

    if (tx.txStatus === 'failed') {
      const failureMsg = tx.failureReason 
        ? tx.failureReason.map(f => f.failures.join(', ')).join('; ')
        : 'Transaction failed';
      console.log('[checkBlockberryTransaction] ❌ Transaction failed:', failureMsg);
      return { included: false, failed: true, error: failureMsg };
    }

    // pending or other status
    console.log('[checkBlockberryTransaction] Transaction pending with status:', tx.txStatus);
    return { included: false, pending: true };

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
