/**
 * ePassport NFC Reader Utility
 * 
 * This utility reads data from ePassport chips using the Web NFC API.
 * It extracts the Machine Readable Zone (MRZ) data and verifies the
 * Document Security Object (SOD) digital signature.
 * 
 * Requirements:
 * - NFC-enabled device (Android phones, modern iPhones)
 * - HTTPS connection (Web NFC API requirement)
 * - User permission to access NFC
 * 
 * Based on ICAO 9303 Part 10 (Logical Data Structure)
 */

/**
 * Data Groups (DG) in ePassport chip
 */
export enum DataGroup {
  DG1 = 1,  // MRZ data
  DG2 = 2,  // Face image
  DG3 = 3,  // Fingerprints
  DG4 = 4,  // Iris data
  DG5 = 5,  // Portrait image
  DG7 = 7,  // Signature
  DG11 = 11, // Additional personal details
  DG12 = 12, // Additional document details
  DG14 = 14, // Security options
  DG15 = 15, // Active authentication public key
  SOD = 99,  // Document security object
}

/**
 * Parsed MRZ data from DG1
 */
export interface EPassportMRZ {
  documentType: string;
  issuingCountry: string;
  surname: string;
  givenNames: string;
  passportNumber: string;
  nationality: string;
  birthDate: string;
  sex: string;
  expiryDate: string;
  optionalData: string;
  mrzLine1: string;
  mrzLine2: string;
}

/**
 * Document Security Object (SOD) structure
 */
export interface DocumentSecurityObject {
  hashAlgorithm: string;
  signatureAlgorithm: string;
  issuerName: string;
  serialNumber: string;
  dataGroupHashes: Map<DataGroup, Uint8Array>;
  signature: Uint8Array;
  certificateChain: Uint8Array[];
}

/**
 * Complete ePassport data
 */
export interface EPassportData {
  mrz: EPassportMRZ;
  faceImage?: Uint8Array;
  sod: DocumentSecurityObject;
  dataGroups: Map<DataGroup, Uint8Array>;
  verificationStatus: {
    sodSignatureValid: boolean;
    dataGroupHashesValid: boolean;
    certificateChainValid: boolean;
    chipAuthenticated: boolean;
  };
}

/**
 * Main ePassport NFC reader class
 */
export class EPassportReader {
  private nfcReader: any;
  private abortController: AbortController | null = null;
  
  constructor() {
    this.checkNFCSupport();
  }
  
  /**
   * Check if NFC is supported on this device
   */
  private checkNFCSupport(): void {
    if (!('NDEFReader' in window)) {
      console.warn('Web NFC API not supported on this device');
      console.info('Supported on: Android Chrome 89+, Edge 90+');
    }
  }
  
  /**
   * Request NFC permission from user
   */
  async requestPermission(): Promise<boolean> {
    try {
      if ('permissions' in navigator) {
        const permission = await (navigator as any).permissions.query({ 
          name: 'nfc' 
        });
        
        if (permission.state === 'denied') {
          throw new Error('NFC permission denied');
        }
        
        return permission.state === 'granted';
      }
      
      // Permission will be requested when first scanning
      return true;
    } catch (err) {
      console.error('NFC permission error:', err);
      return false;
    }
  }
  
  /**
   * Read ePassport chip using NFC
   * 
   * @param mrzInfo - MRZ information for Basic Access Control (BAC)
   * @returns Promise<EPassportData>
   */
  async readEPassport(mrzInfo: {
    passportNumber: string;
    birthDate: string; // YYMMDD
    expiryDate: string; // YYMMDD
  }): Promise<EPassportData> {
    try {
      console.log('🔍 Starting ePassport NFC read...');
      
      // 1. Check NFC support
      if (!('NDEFReader' in window)) {
        throw new Error('NFC not supported on this device');
      }
      
      // 2. Request permission
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new Error('NFC permission required');
      }
      
      // 3. Initialize NFC reader
      this.nfcReader = new (window as any).NDEFReader();
      this.abortController = new AbortController();
      
      // 4. Start scanning
      await this.nfcReader.scan({ signal: this.abortController.signal });
      
      console.log('📱 NFC reader started. Please tap your passport...');
      
      // 5. Wait for NFC tag
      const tagData = await this.waitForNFCTag();
      
      // 6. Perform Basic Access Control (BAC)
      const bacKeys = this.deriveBACKeys(mrzInfo);
      
      // 7. Establish secure messaging
      const secureChannel = await this.establishSecureMessaging(bacKeys);
      
      // 8. Read data groups
      const dataGroups = new Map<DataGroup, Uint8Array>();
      
      // Read DG1 (MRZ)
      const dg1 = await this.readDataGroup(DataGroup.DG1, secureChannel);
      dataGroups.set(DataGroup.DG1, dg1);
      
      // Read DG2 (Face)
      try {
        const dg2 = await this.readDataGroup(DataGroup.DG2, secureChannel);
        dataGroups.set(DataGroup.DG2, dg2);
      } catch (err) {
        console.warn('Could not read DG2 (face image)');
      }
      
      // Read SOD
      const sod = await this.readDataGroup(DataGroup.SOD, secureChannel);
      dataGroups.set(DataGroup.SOD, sod);
      
      // 9. Parse data
      const mrz = this.parseMRZ(dg1);
      const sodData = this.parseSOD(sod);
      
      // 10. Verify signatures
      const verificationStatus = await this.verifyEPassport(
        dataGroups,
        sodData
      );
      
      // 11. Return complete data
      return {
        mrz,
        faceImage: dataGroups.get(DataGroup.DG2),
        sod: sodData,
        dataGroups,
        verificationStatus,
      };
      
    } catch (error) {
      console.error('ePassport read error:', error);
      throw error;
    } finally {
      this.stopScanning();
    }
  }
  
  /**
   * Wait for NFC tag to be detected
   */
  private async waitForNFCTag(): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('NFC scan timeout (30s)'));
      }, 30000);
      
      this.nfcReader.addEventListener('reading', (event: any) => {
        clearTimeout(timeout);
        resolve(event);
      });
      
      this.nfcReader.addEventListener('readingerror', (event: any) => {
        clearTimeout(timeout);
        reject(new Error('NFC read error: ' + event.error));
      });
    });
  }
  
  /**
   * Derive Basic Access Control (BAC) keys from MRZ
   */
  private deriveBACKeys(mrzInfo: {
    passportNumber: string;
    birthDate: string;
    expiryDate: string;
  }): { kEnc: Uint8Array; kMac: Uint8Array } {
    // TODO: Implement proper BAC key derivation
    // This requires:
    // 1. Calculate check digits
    // 2. Concatenate: passportNumber + checkDigit + birthDate + checkDigit + expiryDate + checkDigit
    // 3. Hash with SHA-1
    // 4. Derive encryption (kEnc) and MAC (kMac) keys
    
    console.log('🔐 Deriving BAC keys (placeholder)');
    
    // Placeholder implementation
    return {
      kEnc: new Uint8Array(16),
      kMac: new Uint8Array(16),
    };
  }
  
  /**
   * Establish secure messaging channel
   */
  private async establishSecureMessaging(bacKeys: {
    kEnc: Uint8Array;
    kMac: Uint8Array;
  }): Promise<any> {
    // TODO: Implement secure messaging protocol
    // This requires:
    // 1. Send GET CHALLENGE command
    // 2. Generate session keys
    // 3. Perform EXTERNAL AUTHENTICATE
    
    console.log('🔒 Establishing secure messaging (placeholder)');
    
    return { kEnc: bacKeys.kEnc, kMac: bacKeys.kMac };
  }
  
  /**
   * Read a specific data group from the chip
   */
  private async readDataGroup(
    dataGroup: DataGroup,
    secureChannel: any
  ): Promise<Uint8Array> {
    // TODO: Implement actual APDU commands
    // SELECT FILE -> READ BINARY
    
    console.log(`📖 Reading DG${dataGroup} (placeholder)`);
    
    // Placeholder: Return empty array
    return new Uint8Array(0);
  }
  
  /**
   * Parse MRZ data from DG1
   */
  private parseMRZ(dg1Data: Uint8Array): EPassportMRZ {
    // TODO: Implement ASN.1 parsing and MRZ extraction
    
    // Placeholder: Return empty MRZ
    return {
      documentType: 'P',
      issuingCountry: 'XXX',
      surname: '',
      givenNames: '',
      passportNumber: '',
      nationality: '',
      birthDate: '',
      sex: '',
      expiryDate: '',
      optionalData: '',
      mrzLine1: '',
      mrzLine2: '',
    };
  }
  
  /**
   * Parse Document Security Object (SOD)
   */
  private parseSOD(sodData: Uint8Array): DocumentSecurityObject {
    // TODO: Implement CMS/PKCS#7 parsing
    
    console.log('📜 Parsing SOD (placeholder)');
    
    // Placeholder
    return {
      hashAlgorithm: 'SHA-256',
      signatureAlgorithm: 'RSA',
      issuerName: '',
      serialNumber: '',
      dataGroupHashes: new Map(),
      signature: new Uint8Array(0),
      certificateChain: [],
    };
  }
  
  /**
   * Verify ePassport authenticity
   */
  private async verifyEPassport(
    dataGroups: Map<DataGroup, Uint8Array>,
    sod: DocumentSecurityObject
  ): Promise<{
    sodSignatureValid: boolean;
    dataGroupHashesValid: boolean;
    certificateChainValid: boolean;
    chipAuthenticated: boolean;
  }> {
    // TODO: Implement full verification
    // 1. Verify SOD signature against CSCA certificate
    // 2. Verify data group hashes match SOD
    // 3. Verify certificate chain
    // 4. Perform active authentication (if supported)
    
    console.log('✅ Verifying ePassport (placeholder)');
    
    return {
      sodSignatureValid: false,
      dataGroupHashesValid: false,
      certificateChainValid: false,
      chipAuthenticated: false,
    };
  }
  
  /**
   * Stop NFC scanning
   */
  stopScanning(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}

/**
 * Simplified ePassport reader for browsers without full NFC API
 * This uses a fallback method or WebUSB for external NFC readers
 */
export class FallbackEPassportReader {
  /**
   * Check if external NFC reader is available
   */
  async checkExternalReader(): Promise<boolean> {
    if ('usb' in navigator) {
      const devices = await (navigator as any).usb.getDevices();
      // Check for ACR122U or similar NFC reader
      return devices.some((device: any) => 
        device.vendorId === 0x072f // ACS vendor ID
      );
    }
    return false;
  }
  
  /**
   * Read ePassport using external NFC reader
   */
  async readWithExternalReader(mrzInfo: {
    passportNumber: string;
    birthDate: string;
    expiryDate: string;
  }): Promise<EPassportData> {
    throw new Error('External reader support not yet implemented');
    
    // TODO: Implement WebUSB communication with ACR122U or similar
  }
}

/**
 * Helper function: Validate ePassport data against physical MRZ
 */
export function validateEPassportConsistency(
  physicalMRZ: {
    passportNumber: string;
    birthDate: string;
    expiryDate: string;
  },
  ePassportMRZ: EPassportMRZ
): boolean {
  return (
    physicalMRZ.passportNumber === ePassportMRZ.passportNumber &&
    physicalMRZ.birthDate === ePassportMRZ.birthDate &&
    physicalMRZ.expiryDate === ePassportMRZ.expiryDate
  );
}

/**
 * Helper function: Check if device supports NFC
 */
export function isNFCSupported(): boolean {
  return 'NDEFReader' in window;
}

/**
 * Helper function: Get user-friendly error message
 */
export function getNFCErrorMessage(error: Error): string {
  if (error.message.includes('not supported')) {
    return 'NFC is not supported on this device. Please use an NFC-enabled Android or iOS device.';
  }
  
  if (error.message.includes('permission')) {
    return 'NFC permission denied. Please enable NFC in your device settings.';
  }
  
  if (error.message.includes('timeout')) {
    return 'NFC scan timeout. Please hold your passport steady against the device.';
  }
  
  return `NFC error: ${error.message}`;
}

/**
 * Usage example:
 * 
 * const reader = new EPassportReader();
 * 
 * const hasPermission = await reader.requestPermission();
 * if (!hasPermission) {
 *   alert('Please enable NFC');
 *   return;
 * }
 * 
 * const ePassportData = await reader.readEPassport({
 *   passportNumber: 'L898902C3',
 *   birthDate: '740812',
 *   expiryDate: '120415',
 * });
 * 
 * if (ePassportData.verificationStatus.sodSignatureValid) {
 *   console.log('✅ ePassport verified!');
 *   console.log('MRZ:', ePassportData.mrz);
 * }
 */
