/**
 * Oracle Service - Frontend Integration
 * 
 * Connects to the MinaID Oracle server to verify passports
 */

import { Field, PublicKey, Signature } from 'o1js';

// Oracle configuration
const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL || 'http://localhost:4000';

export interface PassportData {
  passportNumber: string;
  birthDate: string; // YYMMDD format
  expiryDate: string; // YYMMDD format
  nationality: string;
  fullName: string;
  mrzLine1?: string;
  mrzLine2?: string;
  verificationType: 'physical' | 'epassport';
}

export interface OracleVerificationResult {
  isValid: boolean;
  passportHash: string;
  signature: {
    r: string;
    s: string;
  };
  timestamp: number;
  oraclePublicKey: string;
  checks: {
    mrzChecksum: boolean;
    documentSecurity: boolean;
    expiryValid: boolean;
    blacklist: boolean;
    nfcSignature?: boolean;
  };
  error?: string;
}

export class OracleService {
  private oracleUrl: string;
  private oraclePublicKey: PublicKey | null = null;

  constructor(oracleUrl: string = ORACLE_URL) {
    this.oracleUrl = oracleUrl;
  }

  /**
   * Check if Oracle server is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.oracleUrl}/health`, {
        method: 'GET',
      });
      
      if (!response.ok) {
        return false;
      }
      
      const data = await response.json();
      return data.status === 'healthy';
    } catch (error) {
      console.error('Oracle health check failed:', error);
      return false;
    }
  }

  /**
   * Get Oracle's public key
   */
  async getOraclePublicKey(): Promise<PublicKey> {
    if (this.oraclePublicKey) {
      return this.oraclePublicKey;
    }

    try {
      const response = await fetch(`${this.oracleUrl}/oracle-key`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error(`Failed to get Oracle key: ${response.statusText}`);
      }

      const data = await response.json();
      this.oraclePublicKey = PublicKey.fromBase58(data.publicKey);
      
      return this.oraclePublicKey;
    } catch (error) {
      console.error('Failed to get Oracle public key:', error);
      throw error;
    }
  }

  /**
   * Verify a passport with the Oracle
   */
  async verifyPassport(passportData: PassportData): Promise<OracleVerificationResult> {
    try {
      const response = await fetch(`${this.oracleUrl}/verify-passport`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          passportData,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Oracle verification failed');
      }

      const result: OracleVerificationResult = await response.json();
      
      return result;
    } catch (error) {
      console.error('Oracle verification error:', error);
      throw error;
    }
  }

  /**
   * Verify multiple passports in batch
   */
  async verifyBatch(requests: { passportData: PassportData }[]): Promise<{
    total: number;
    results: OracleVerificationResult[];
    oraclePublicKey: string;
    timestamp: number;
  }> {
    try {
      const response = await fetch(`${this.oracleUrl}/verify-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Batch verification failed');
      }

      return await response.json();
    } catch (error) {
      console.error('Batch verification error:', error);
      throw error;
    }
  }

  /**
   * Parse Oracle signature for contract use
   */
  parseSignature(signatureData: { r: string; s: string }): Signature {
    return Signature.fromJSON(signatureData);
  }

  /**
   * Create passport hash (matches contract logic)
   */
  createPassportHash(passportData: PassportData): Field {
    const { passportNumber, birthDate, expiryDate, nationality } = passportData;
    
    // Convert strings to Field arrays
    const fields = [passportNumber, birthDate, expiryDate, nationality].map(str => {
      const chars = str.split('').map(c => Field(c.charCodeAt(0)));
      return Field.fromFields(chars);
    });
    
    return Field.fromFields(fields);
  }

  /**
   * Prepare data for smart contract submission
   */
  async prepareContractData(verificationResult: OracleVerificationResult): Promise<{
    passportHash: Field;
    isValid: boolean;
    timestamp: Field;
    signature: Signature;
  }> {
    if (!verificationResult.isValid) {
      throw new Error('Cannot prepare contract data for invalid verification');
    }

    // Parse hash and signature
    const passportHash = Field(verificationResult.passportHash);
    const signature = this.parseSignature(verificationResult.signature);
    const timestamp = Field(Math.floor(verificationResult.timestamp / 1000));

    return {
      passportHash,
      isValid: verificationResult.isValid,
      timestamp,
      signature,
    };
  }
}

// Export singleton instance
export const oracleService = new OracleService();
