# MinaExplorer Integration

## Overview
Added MinaExplorer integration to verify and display transaction details after successful on-chain proof verification.

## Changes Made

### 1. **CompleteTransactionMonitor.ts** (Updated)
- Uses correct Mina Archive Node GraphQL schema
- Two-stage query approach:
  1. Check `pooledZkappCommands` for mempool transactions
  2. Search `bestChain` for included transactions
- Properly handles `in_mempool` status

### 2. **TransactionMonitor.ts** (Updated)
- Same two-stage GraphQL query approach
- Correctly searches through recent blocks for transactions
- Handles failure reasons from both mempool and chain

### 3. **VerifierDashboard.tsx** (Enhanced)

#### New Function: `getTransactionFromExplorer()`
```typescript
async function getTransactionFromExplorer(txHash: string): Promise<{
  blockHeight?: number;
  confirmed: boolean;
  explorerUrl: string;
} | null>
```
- Queries MinaExplorer Archive Node after transaction confirmation
- Searches `bestChain` for the transaction
- Returns block height, confirmation status, and explorer URL

#### Enhanced VerificationResult Type
```typescript
export type VerificationResult = {
  // ... existing fields ...
  blockHeight?: number;
  confirmations?: number;
  explorerUrl?: string;
};
```

#### Updated On-Chain Verification Flow
1. Submit transaction
2. Monitor until confirmed
3. **[NEW]** Fetch transaction details from MinaExplorer
4. Store block height, confirmations, and explorer URL
5. Display results with MinaExplorer link

#### New UI Components
- **On-Chain Verification Card**: Displays when `verificationMethod === 'on-chain'`
  - Block Height
  - Confirmation count
  - Clickable link to MinaExplorer
  - Styled with blue theme for blockchain verification

## MinaExplorer Links

### Devnet URLs
- Explorer: `https://devnet.minaexplorer.com/`
- API: `https://devnet.api.minaexplorer.com`
- GraphQL: `https://api.minascan.io/node/devnet/v1/graphql`

### Transaction URL Format
```
https://devnet.minaexplorer.com/transaction/{TRANSACTION_HASH}
```

## GraphQL Schema Used

### Check Mempool
```graphql
query CheckMempool($hash: String!) {
  pooledZkappCommands(hashes: [$hash]) {
    hash
    failureReason
  }
}
```

### Search Recent Blocks
```graphql
query GetTransaction($hash: String!) {
  bestChain(maxLength: 100) {
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
```

## User Experience

### Before
- Transaction confirmed ✅
- No additional information
- User had to manually check explorer

### After
- Transaction confirmed ✅
- **Block Height**: 123456
- **Confirmations**: 1
- **[View on MinaExplorer →]** (clickable link)
- Automatic verification of transaction inclusion
- Visual confirmation with explorer data

## Benefits

1. **Transparency**: Users can verify transactions on public explorer
2. **Trustless**: Provides independent verification source
3. **Debugging**: Block height and confirmations help diagnose issues
4. **UX**: One-click access to detailed transaction info
5. **Compliance**: Auditable on-chain proof verification

## Technical Notes

- Explorer fetch happens **after** transaction confirmation
- Handles cases where explorer data isn't immediately available
- Graceful fallback if explorer query fails
- Progress indicator shows "Fetching transaction details from MinaExplorer..."
- Data stored in verification history for later reference

## Testing

To test the integration:

1. Upload a proof file in Verifier Dashboard
2. Enable "On-Chain Verification"
3. Connect wallet and verify proof
4. After transaction confirms:
   - Check console for explorer data logs
   - Verify block height is displayed
   - Click "View on MinaExplorer" link
   - Confirm transaction appears on explorer

## Example Output

```javascript
{
  id: "v_1234567890",
  proofType: "kyc",
  status: "verified",
  verificationMethod: "on-chain",
  txHash: "5JuZqvSrHPaiv2vg85naBPh21uKTdzhREkBXTzXL3GgxPraDuWyh",
  blockHeight: 123456,
  confirmations: 1,
  explorerUrl: "https://devnet.minaexplorer.com/transaction/5JuZqv...",
  // ... other fields
}
```

## Future Enhancements

- [ ] Add mainnet support with network detection
- [ ] Show transaction timestamp from explorer
- [ ] Display gas fees and transaction details
- [ ] Add "Copy Transaction Hash" button
- [ ] Show proof details from explorer metadata
- [ ] Add explorer link to verification history

## Documentation References

- [MinaExplorer Devnet](https://docs.minaexplorer.com/block-explorer/devnet)
- [BigQuery Public Dataset](https://docs.minaexplorer.com/guides/bigquery-public-dataset)
- [MinaExplorer Introduction](https://docs.minaexplorer.com/introduction)
