# IPFS Integration Guide for MinaID

## Overview

MinaID now supports **IPFS (InterPlanetary File System)** integration for decentralized storage of encrypted Aadhar credentials and ZK proofs. This enables:

✅ **Encrypted storage** on IPFS with AES-256 encryption  
✅ **Dual verification paths**: Upload from device OR load from IPFS  
✅ **Secure credential sharing** via IPFS CIDs  
✅ **Immutable, decentralized storage** with Pinata pinning service

---

## Features Implemented

### 1. Core Infrastructure

#### **IPFSCrypto.ts** - Encryption Utilities
- AES-256-CBC encryption/decryption
- PBKDF2 key derivation (100,000 iterations)
- Deterministic passphrase generation from wallet address + password
- Support for both JSON data and binary files

**Key Functions:**
```typescript
encryptForIPFS(data, passphrase) // Encrypt before upload
decryptFromIPFS(params) // Decrypt after download
generatePassphrase(walletAddress, password) // Deterministic key
```

#### **IPFSService.ts** - IPFS Service Layer
- Pinata SDK integration for uploads/downloads
- Automatic encryption before upload
- CORS-enabled IPFS gateway access
- Pin management (list, unpin)

**Key Functions:**
```typescript
uploadEncrypted(data, passphrase, options) // Upload encrypted data
downloadDecrypted(cid, passphrase) // Download and decrypt
uploadJSON(data, options) // Upload public data (unencrypted)
uploadFile(file, options) // Upload file to IPFS
```

### 2. UI Components

#### **IPFSUploader.tsx**
- Upload encrypted data to IPFS
- Real-time progress tracking
- CID display with copy/share functionality
- Success/error notifications

#### **IPFSDownloader.tsx**
- Download from IPFS using CID
- Automatic decryption
- Error handling with helpful messages
- Debug view for downloaded data

#### **UploadAadharContent.tsx** (Updated)
Three upload modes:
1. **📱 Upload from Device** - Traditional local storage
2. **☁️ Save to IPFS** - Encrypted IPFS upload
3. **🔗 Load from IPFS** - Download using CID

---

## Setup Instructions

### Step 1: Get Pinata API Keys

1. Visit [https://app.pinata.cloud](https://app.pinata.cloud)
2. Sign up for a free account
3. Navigate to **API Keys** section
4. Click **"New Key"** → Select permissions:
   - `pinFileToIPFS`
   - `pinJSONToIPFS`
   - `unpin`
   - `pinList`
5. Copy your **API Key** and **API Secret**

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Add your Pinata credentials to `.env.local`:
```env
# IPFS Configuration (Pinata)
NEXT_PUBLIC_PINATA_API_KEY=your_actual_api_key_here
NEXT_PUBLIC_PINATA_API_SECRET=your_actual_api_secret_here

# Optional: Custom IPFS Gateway
NEXT_PUBLIC_IPFS_GATEWAY_URL=https://gateway.pinata.cloud
```

### Step 3: Install Dependencies

```bash
cd ui
npm install
```

**New dependencies added:**
- `@pinata/sdk` - Pinata API client
- `ipfs-http-client` - IPFS HTTP client
- `crypto-js` - Encryption library
- `@types/crypto-js` - TypeScript types

### Step 4: Test the Integration

```bash
npm run dev
```

Navigate to:
- `/upload-aadhar` - Test IPFS upload/download
- `/dashboard` - View stored IPFS CIDs

---

## Usage Examples

### Upload Aadhar to IPFS

```typescript
import { getIPFSService } from '@/lib/IPFSService';
import { generatePassphrase } from '@/lib/IPFSCrypto';

const ipfsService = getIPFSService();
const passphrase = generatePassphrase(walletAddress, userPassword);

const result = await ipfsService.uploadEncrypted(
  aadharData,
  passphrase,
  {
    name: 'aadhar-credential',
    metadata: { type: 'aadhar', walletAddress }
  }
);

console.log('CID:', result.cid);
// Store CID for future retrieval
localStorage.setItem(`aadhar_ipfs_${walletAddress}`, result.cid);
```

### Download from IPFS

```typescript
const cid = 'QmXx...'; // IPFS CID
const passphrase = generatePassphrase(walletAddress, userPassword);

const result = await ipfsService.downloadDecrypted(cid, passphrase);
console.log('Downloaded data:', result.data);
```

### Using React Components

```tsx
import { IPFSUploader } from '@/components/IPFSUploader';

<IPFSUploader
  data={aadharData}
  walletAddress={walletAddress}
  onUploadSuccess={(cid, metadata) => {
    console.log('Uploaded to IPFS:', cid);
  }}
  buttonText="Upload to IPFS"
/>
```

---

## Architecture

### Encryption Flow

```
User Data → Encrypt (AES-256) → Upload to IPFS → Get CID
           ↑
   Passphrase from:
   SHA256(walletAddress + password)
```

### Decryption Flow

```
CID → Download from IPFS → Encrypted Data → Decrypt → Original Data
                                           ↑
                               Passphrase from wallet
```

### Storage Locations

1. **IPFS** - Encrypted credential data (decentralized)
2. **LocalStorage** - Decrypted data for local use
3. **LocalStorage** - CID reference mapping

```
localStorage["aadhar_{walletAddress}"] = decrypted Aadhar data
localStorage["aadhar_ipfs_{walletAddress}"] = { cid, timestamp }
```

---

## Security Considerations

### ✅ What's Secure

- **End-to-end encryption**: Data encrypted client-side before upload
- **Deterministic keys**: Wallet address ensures only owner can decrypt
- **Strong encryption**: AES-256-CBC with PBKDF2 (100k iterations)
- **No plaintext on IPFS**: All sensitive data is encrypted

### ⚠️ Important Notes

1. **Passphrase must be consistent**: Same wallet address + password required for decryption
2. **CID sharing**: Sharing a CID shares encrypted data, but decryption requires passphrase
3. **Pinata account**: Free tier has limits (1GB storage, 100MB/month bandwidth)
4. **Public IPFS**: Encrypted data is publicly accessible via CID (but encrypted)

### 🔒 Best Practices

1. **Never share passphrases** - Only share CIDs
2. **Store CIDs securely** - In user profiles or databases
3. **Backup CIDs** - User won't be able to recover data without CID
4. **Use strong passwords** - Encryption strength depends on password

---

## Testing

### Manual Testing Checklist

- [ ] Upload Aadhar XML → Get CID
- [ ] Download using CID → Verify decryption
- [ ] Try wrong passphrase → Should fail gracefully
- [ ] Copy CID → Paste in downloader → Verify works
- [ ] Check CID stored in localStorage
- [ ] Verify data encrypted on IPFS gateway
- [ ] Test error scenarios (invalid CID, network issues)

### Unit Tests (TODO)

Create `__tests__/IPFS.test.ts`:
```typescript
describe('IPFS Integration', () => {
  test('encrypts data before upload', () => {});
  test('decrypts data after download', () => {});
  test('generates deterministic passphrase', () => {});
  test('handles invalid CID', () => {});
});
```

---

## Troubleshooting

### Issue: "IPFS service not initialized"
**Solution**: Check `.env.local` has valid Pinata API keys

### Issue: "Decryption failed: Invalid passphrase"
**Solution**: Ensure same wallet address + password used for encryption

### Issue: "Failed to download from IPFS"
**Solution**:
1. Check CID is valid (starts with Qm...)
2. Verify IPFS gateway is accessible
3. Check network connectivity

### Issue: Slow uploads
**Solution**:
1. Use Pinata dedicated gateway (upgrade plan)
2. Compress data before encryption
3. Use smaller file sizes

### Issue: "Pin limit reached"
**Solution**: Upgrade Pinata plan or unpin old content

---

## API Reference

### IPFSService

#### `uploadEncrypted(data, passphrase, options?)`
Upload encrypted data to IPFS

**Parameters:**
- `data: any` - Data to encrypt and upload
- `passphrase: string` - Encryption passphrase
- `options?: { name?, metadata? }` - Upload options

**Returns:** `Promise<IPFSUploadResult>`

#### `downloadDecrypted<T>(cid, passphrase)`
Download and decrypt data from IPFS

**Parameters:**
- `cid: string` - IPFS Content Identifier
- `passphrase: string` - Decryption passphrase

**Returns:** `Promise<IPFSDownloadResult<T>>`

### IPFSCrypto

#### `encryptForIPFS(data, passphrase)`
Encrypt data with AES-256

**Returns:** `EncryptionResult { ciphertext, iv, salt }`

#### `decryptFromIPFS(params)`
Decrypt data downloaded from IPFS

**Parameters:**
```typescript
{
  ciphertext: string,
  iv: string,
  salt: string,
  passphrase: string
}
```

#### `generatePassphrase(walletAddress, userPassword)`
Generate deterministic encryption key

**Returns:** `string` (SHA256 hash)

---

## Future Enhancements

### Phase 2 (Planned)
- [ ] IPFS pinning service fallback (Infura, Fleek)
- [ ] Direct IPFS node integration (no third-party)
- [ ] Batch upload/download support
- [ ] IPFS CID sharing UI (QR codes)
- [ ] Proof uploads to IPFS
- [ ] VerifierDashboard IPFS integration

### Phase 3 (Future)
- [ ] IPFS clustering for redundancy
- [ ] Content addressing for deduplication
- [ ] IPNS (mutable pointers) support
- [ ] Filecoin long-term archival
- [ ] Web3.Storage integration

---

## Resources

- [IPFS Documentation](https://docs.ipfs.tech/)
- [Pinata Documentation](https://docs.pinata.cloud/)
- [IPFS HTTP Client](https://github.com/ipfs/js-ipfs/tree/master/packages/ipfs-http-client)
- [CryptoJS Documentation](https://cryptojs.gitbook.io/docs/)

---

## Support

For issues or questions:
1. Check this guide first
2. Review error messages in browser console
3. Verify environment configuration
4. Test with sample data
5. Open an issue on GitHub

---

**Status**: ✅ Core IPFS integration complete  
**Last Updated**: December 21, 2025
