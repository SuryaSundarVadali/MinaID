// lib/IPFSService.ts - IPFS integration service (client-side)
import { encryptForIPFS, decryptFromIPFS } from './IPFSCrypto';

/**
 * IPFS upload result
 */
export interface IPFSUploadResult {
  cid: string; // IPFS Content Identifier
  ipfsHash: string; // Same as CID
  size: number;
  timestamp: number;
  encryptionMetadata?: {
    iv: string;
    salt: string;
  };
}

/**
 * IPFS download result
 */
export interface IPFSDownloadResult<T = any> {
  data: T;
  cid: string;
  metadata?: any;
}

/**
 * IPFS Service class for uploading/downloading encrypted data
 * Uses Next.js API routes instead of direct Pinata SDK (browser compatibility)
 */
export class IPFSService {
  private gatewayUrl: string;

  constructor() {
    this.gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL || 'https://gateway.pinata.cloud';
  }

  /**
   * Upload encrypted data to IPFS via API route
   * @param data Data to upload (will be encrypted)
   * @param passphrase Encryption passphrase
   * @param options Upload options
   * @param credentials Optional user Pinata credentials
   */
  async uploadEncrypted(
    data: any,
    passphrase: string,
    options?: {
      name?: string;
      metadata?: any;
    },
    credentials?: {
      apiKey: string;
      apiSecret: string;
    }
  ): Promise<IPFSUploadResult> {
    try {
      console.log('[IPFSService] Encrypting data...');
      
      // Encrypt data client-side
      const encrypted = encryptForIPFS(data, passphrase);

      // Upload via API route
      console.log('[IPFSService] Uploading to IPFS via API...');
      const response = await fetch('/api/ipfs/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            ciphertext: encrypted.ciphertext,
            iv: encrypted.iv,
            salt: encrypted.salt,
          },
          name: options?.name || `encrypted-data-${Date.now()}`,
          metadata: {
            timestamp: Date.now().toString(),
            ...options?.metadata,
          },
          credentials, // Pass user credentials if provided
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();

      console.log('[IPFSService] Upload successful:', result.cid);

      return {
        ...result,
        encryptionMetadata: {
          iv: encrypted.iv,
          salt: encrypted.salt,
        },
      };
    } catch (error) {
      console.error('[IPFSService] Upload failed:', error);
      throw new Error('Failed to upload encrypted data to IPFS: ' + (error as Error).message);
    }
  }

  /**
   * Download raw (unencrypted) data from IPFS
   * For data uploaded via IPFS Desktop or other non-MinaID sources
   * @param cid IPFS Content Identifier
   */
  async downloadRaw<T = any>(cid: string): Promise<IPFSDownloadResult<T>> {
    try {
      console.log('[IPFSService] Downloading raw data from IPFS:', cid);

      const url = `${this.gatewayUrl}/ipfs/${cid}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      console.log('[IPFSService] Content-Type:', contentType);

      // Handle different content types
      let data;
      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else if (contentType?.includes('text')) {
        data = await response.text();
      } else {
        // Binary data - return as blob
        data = await response.blob();
      }

      return {
        data,
        cid,
        metadata: { contentType },
      };
    } catch (error) {
      console.error('[IPFSService] Raw download failed:', error);
      throw new Error('Failed to download raw data from IPFS: ' + (error as Error).message);
    }
  }

  /**
   * Download and decrypt data from IPFS
   * @param cid IPFS Content Identifier
   * @param passphrase Decryption passphrase
   */
  async downloadDecrypted<T = any>(
    cid: string,
    passphrase: string
  ): Promise<IPFSDownloadResult<T>> {
    try {
      console.log('[IPFSService] Downloading from IPFS:', cid);

      // Download via direct gateway
      const url = `${this.gatewayUrl}/ipfs/${cid}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Check content type
      const contentType = response.headers.get('content-type');
      console.log('[IPFSService] Content-Type:', contentType);

      // Get response text first to check what we're receiving
      const responseText = await response.text();
      
      // Check if it's XML or HTML (error page)
      if (responseText.trim().startsWith('<?xml') || responseText.trim().startsWith('<!DOCTYPE')) {
        console.error('[IPFSService] Received XML/HTML instead of JSON:', responseText.substring(0, 200));
        throw new Error(
          'The IPFS gateway returned an error page. This CID may not exist or may not contain encrypted data. ' +
          'Please verify the CID is correct and was generated by this application.'
        );
      }

      // Try to parse as JSON
      let encryptedData;
      try {
        encryptedData = JSON.parse(responseText);
      } catch (parseError) {
        console.error('[IPFSService] Failed to parse response:', responseText.substring(0, 200));
        throw new Error(
          'IPFS_DESKTOP_UPLOAD: This appears to be data uploaded via IPFS Desktop or another tool. ' +
          'It\'s not encrypted with MinaID\'s format. Use "Import from IPFS Desktop" option instead.'
        );
      }

      // Validate encrypted data structure
      if (!encryptedData.ciphertext || !encryptedData.iv || !encryptedData.salt) {
        console.error('[IPFSService] Invalid data structure:', encryptedData);
        throw new Error(
          'IPFS_DESKTOP_UPLOAD: This data is missing MinaID\'s encryption fields. ' +
          'It was likely uploaded via IPFS Desktop. Use "Import from IPFS Desktop" option instead.'
        );
      }

      console.log('[IPFSService] Decrypting data...');

      // Decrypt data client-side
      const decrypted = decryptFromIPFS({
        ciphertext: encryptedData.ciphertext,
        iv: encryptedData.iv,
        salt: encryptedData.salt,
        passphrase,
      });

      return {
        data: decrypted,
        cid,
      };
    } catch (error) {
      console.error('[IPFSService] Download failed:', error);
      throw error; // Re-throw to preserve error type
    }
  }

  /**
   * Get gateway URL for a CID
   * @param cid IPFS Content Identifier
   */
  getGatewayUrl(cid: string): string {
    return `${this.gatewayUrl}/ipfs/${cid}`;
  }
}

/**
 * Create IPFS service instance
 */
export function createIPFSService(): IPFSService {
  return new IPFSService();
}

// Singleton instance
let ipfsServiceInstance: IPFSService | null = null;

/**
 * Get singleton IPFS service instance
 */
export function getIPFSService(): IPFSService {
  if (!ipfsServiceInstance) {
    ipfsServiceInstance = createIPFSService();
  }
  return ipfsServiceInstance;
}
