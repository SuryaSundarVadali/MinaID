// lib/IPFSService.ts - IPFS integration service using Pinata
import pinataSDK from '@pinata/sdk';
import { encryptForIPFS, decryptFromIPFS, EncryptionResult, DecryptionParams } from './IPFSCrypto';

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
 * Pinata configuration
 */
interface PinataConfig {
  apiKey: string;
  apiSecret: string;
  gatewayUrl?: string;
}

/**
 * IPFS Service class for uploading/downloading encrypted data
 */
export class IPFSService {
  private pinata: any;
  private gatewayUrl: string;
  private isInitialized: boolean = false;

  constructor(config?: PinataConfig) {
    if (config) {
      this.initialize(config);
    }
    this.gatewayUrl = config?.gatewayUrl || 'https://gateway.pinata.cloud';
  }

  /**
   * Initialize Pinata SDK
   */
  initialize(config: PinataConfig): void {
    try {
      this.pinata = new pinataSDK(config.apiKey, config.apiSecret);
      this.isInitialized = true;
      console.log('[IPFSService] Initialized with Pinata');
    } catch (error) {
      console.error('[IPFSService] Initialization failed:', error);
      throw new Error('Failed to initialize IPFS service');
    }
  }

  /**
   * Test Pinata connection
   */
  async testConnection(): Promise<boolean> {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    try {
      await this.pinata.testAuthentication();
      console.log('[IPFSService] Connection test successful');
      return true;
    } catch (error) {
      console.error('[IPFSService] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Upload encrypted data to IPFS via Pinata
   * @param data Data to upload (will be encrypted)
   * @param passphrase Encryption passphrase
   * @param options Upload options
   */
  async uploadEncrypted(
    data: any,
    passphrase: string,
    options?: {
      name?: string;
      metadata?: any;
    }
  ): Promise<IPFSUploadResult> {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    try {
      console.log('[IPFSService] Encrypting data...');
      
      // Encrypt data
      const encrypted = encryptForIPFS(data, passphrase);

      // Prepare metadata
      const pinataMetadata = {
        name: options?.name || `encrypted-data-${Date.now()}`,
        keyvalues: {
          encrypted: 'true',
          timestamp: Date.now().toString(),
          ...options?.metadata,
        },
      };

      // Upload to IPFS
      console.log('[IPFSService] Uploading to IPFS...');
      const result = await this.pinata.pinJSONToIPFS(
        {
          ciphertext: encrypted.ciphertext,
          iv: encrypted.iv,
          salt: encrypted.salt,
        },
        {
          pinataMetadata,
        }
      );

      console.log('[IPFSService] Upload successful:', result.IpfsHash);

      return {
        cid: result.IpfsHash,
        ipfsHash: result.IpfsHash,
        size: result.PinSize,
        timestamp: Date.now(),
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

      // Fetch from IPFS gateway
      const url = `${this.gatewayUrl}/ipfs/${cid}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const encryptedData = await response.json();

      // Validate encrypted data structure
      if (!encryptedData.ciphertext || !encryptedData.iv || !encryptedData.salt) {
        throw new Error('Invalid encrypted data structure');
      }

      console.log('[IPFSService] Decrypting data...');

      // Decrypt data
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
      throw new Error('Failed to download data from IPFS: ' + (error as Error).message);
    }
  }

  /**
   * Upload plain (unencrypted) JSON to IPFS
   * WARNING: Only use for public data!
   * @param data Data to upload
   * @param options Upload options
   */
  async uploadJSON(
    data: any,
    options?: {
      name?: string;
      metadata?: any;
    }
  ): Promise<IPFSUploadResult> {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    try {
      const pinataMetadata = {
        name: options?.name || `data-${Date.now()}`,
        keyvalues: {
          encrypted: 'false',
          timestamp: Date.now().toString(),
          ...options?.metadata,
        },
      };

      const result = await this.pinata.pinJSONToIPFS(data, {
        pinataMetadata,
      });

      return {
        cid: result.IpfsHash,
        ipfsHash: result.IpfsHash,
        size: result.PinSize,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[IPFSService] JSON upload failed:', error);
      throw new Error('Failed to upload JSON to IPFS');
    }
  }

  /**
   * Upload file to IPFS
   * @param file File to upload
   * @param options Upload options
   */
  async uploadFile(
    file: File,
    options?: {
      name?: string;
      metadata?: any;
    }
  ): Promise<IPFSUploadResult> {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    try {
      const pinataMetadata = {
        name: options?.name || file.name,
        keyvalues: {
          originalName: file.name,
          mimeType: file.type,
          size: file.size.toString(),
          timestamp: Date.now().toString(),
          ...options?.metadata,
        },
      };

      const result = await this.pinata.pinFileToIPFS(file, {
        pinataMetadata,
      });

      return {
        cid: result.IpfsHash,
        ipfsHash: result.IpfsHash,
        size: result.PinSize,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[IPFSService] File upload failed:', error);
      throw new Error('Failed to upload file to IPFS');
    }
  }

  /**
   * Download file from IPFS
   * @param cid IPFS Content Identifier
   */
  async downloadFile(cid: string): Promise<Blob> {
    try {
      const url = `${this.gatewayUrl}/ipfs/${cid}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('[IPFSService] File download failed:', error);
      throw new Error('Failed to download file from IPFS');
    }
  }

  /**
   * Unpin content from IPFS (remove from Pinata)
   * @param cid IPFS Content Identifier
   */
  async unpin(cid: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    try {
      await this.pinata.unpin(cid);
      console.log('[IPFSService] Unpinned:', cid);
    } catch (error) {
      console.error('[IPFSService] Unpin failed:', error);
      throw new Error('Failed to unpin content from IPFS');
    }
  }

  /**
   * List pinned items
   */
  async listPins(filters?: any): Promise<any[]> {
    if (!this.isInitialized) {
      throw new Error('IPFS service not initialized');
    }

    try {
      const result = await this.pinata.pinList(filters);
      return result.rows || [];
    } catch (error) {
      console.error('[IPFSService] List pins failed:', error);
      throw new Error('Failed to list pinned items');
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
 * Create IPFS service instance from environment variables
 */
export function createIPFSService(): IPFSService {
  const apiKey = process.env.NEXT_PUBLIC_PINATA_API_KEY;
  const apiSecret = process.env.NEXT_PUBLIC_PINATA_API_SECRET;
  const gatewayUrl = process.env.NEXT_PUBLIC_IPFS_GATEWAY_URL;

  if (!apiKey || !apiSecret) {
    console.warn('[IPFSService] Pinata credentials not configured');
    return new IPFSService(); // Return uninitialized instance
  }

  return new IPFSService({
    apiKey,
    apiSecret,
    gatewayUrl,
  });
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
