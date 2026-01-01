/**
 * MinaID Oracle Server
 * 
 * This server acts as a trusted verifier for passport authenticity.
 * It validates passport data (MRZ checksums, document security features)
 * and cryptographically signs the verification result using o1js.
 * 
 * The signature can then be verified on-chain by the Mina smart contract.
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(cors());
app.use(express.json());

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// ============================================
// Oracle Configuration
// ============================================

// Hologram Service Configuration
const HOLOGRAM_SERVICE_URL = process.env.HOLOGRAM_SERVICE_URL || 'http://localhost:8000';

let Field: any;
let PrivateKey: any;
let PublicKey: any;
let Signature: any;
let Poseidon: any;
let Bool: any;
let ORACLE_PRIVATE_KEY: any;
let ORACLE_PUBLIC_KEY: any;

// Initialize o1js dynamically
const initO1js = async () => {
  const o1js = await import('o1js');
  Field = o1js.Field;
  PrivateKey = o1js.PrivateKey;
  PublicKey = o1js.PublicKey;
  Signature = o1js.Signature;
  Poseidon = o1js.Poseidon;
  Bool = o1js.Bool;

  /**
   * Oracle's private key (KEEP THIS SECRET!)
   * In production, load this from environment variables or a secure key vault.
   */
  ORACLE_PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY 
    ? PrivateKey.fromBase58(process.env.ORACLE_PRIVATE_KEY)
    : PrivateKey.random(); // Generate new key if not provided

  /**
   * Oracle's public key
   * This should be stored in the smart contract state.
   */
  ORACLE_PUBLIC_KEY = ORACLE_PRIVATE_KEY.toPublicKey();

  console.log('Oracle Public Key:', ORACLE_PUBLIC_KEY.toBase58());
  console.log('⚠️  Store this public key in your smart contract!');
};

// ============================================
// Types
// ============================================

interface PassportData {
  passportNumber: string;
  birthDate: string;
  expiryDate: string;
  nationality: string;
  fullName: string;
  mrzLine1?: string;
  mrzLine2?: string;
  verificationType: 'physical' | 'epassport';
}

interface VerificationRequest {
  passportData: PassportData;
  imageUrl?: string; // For physical passport verification
  nfcData?: any; // For ePassport verification
}

interface VerificationResult {
  isValid: boolean;
  hologramValid: boolean; // NEW: Hologram verification result
  passportHash: string; // Field as base58 string
  signature: string; // Signature as JSON string
  oraclePublicKey: string;
  timestamp: number;
  verificationType: 'physical' | 'epassport';
  checks: {
    mrzChecksum: boolean;
    documentSecurity: boolean;
    expiryValid: boolean;
    blacklist: boolean;
    nfcSignature?: boolean;
    hologramVerification?: boolean; // NEW: Hologram check result
  };
  hologramDetails?: { // NEW: Hologram verification details
    confidence: number;
    details: string;
    frames: number;
    detections: number;
  };
  error?: string;
}

// ============================================
// Verification Functions
// ============================================

/**
 * Verifies hologram authenticity by calling the Python microservice.
 * 
 * @param videoPath - Path to the video file containing passport hologram
 * @returns Promise resolving to hologram verification result
 */
async function verifyHologram(videoPath: string): Promise<{
  valid: boolean;
  confidence: number;
  details: string;
  frames: number;
  detections: number;
}> {
  try {
    console.log('🎥 Verifying hologram with Python service...');
    
    // Check if video file exists
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Video file not found: ${videoPath}`);
    }
    
    // Create form data with video file
    const form = new FormData();
    form.append('video', fs.createReadStream(videoPath));
    
    // Call hologram verification service
    const response = await axios.post(
      `${HOLOGRAM_SERVICE_URL}/verify_hologram`,
      form,
      {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 120000, // 2 minute timeout for video processing
      }
    );
    
    const result = response.data;
    
    console.log('✅ Hologram verification complete');
    console.log(`   Valid: ${result.valid}`);
    console.log(`   Confidence: ${result.confidence}`);
    console.log(`   Details: ${result.details}`);
    
    return {
      valid: result.valid,
      confidence: result.confidence,
      details: result.details,
      frames: result.total_frames,
      detections: result.detections_count,
    };
    
  } catch (error) {
    console.error('❌ Hologram verification error:', error);
    
    if (axios.isAxiosError(error)) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Hologram service not reachable. Is it running on port 8000?');
      }
      if (error.response) {
        throw new Error(`Hologram service error: ${error.response.data?.detail || error.response.statusText}`);
      }
    }
    
    throw error;
  }
}

/**
 * Validates MRZ checksums for a passport.
 * This should use your existing MRZUtils implementation.
 */
function validateMRZChecksums(passportData: PassportData): boolean {
  try {
    // In production, import and use your MRZUtils here
    // For now, we'll do a simplified check
    
    const { passportNumber, birthDate, expiryDate } = passportData;
    
    // Basic format validation
    if (!passportNumber || passportNumber.length < 9) return false;
    if (!birthDate || birthDate.length !== 7) return false;
    if (!expiryDate || expiryDate.length !== 7) return false;
    
    // TODO: Import and use actual MRZUtils.validatePassportMRZ()
    // const mrzValid = MRZUtils.validatePassportMRZ({
    //   passportNumber: MRZUtils.stringToFields(passportNumber),
    //   birthDate: MRZUtils.stringToFields(birthDate),
    //   expiryDate: MRZUtils.stringToFields(expiryDate),
    // });
    // return mrzValid.toBoolean();
    
    return true; // Placeholder
  } catch (err) {
    console.error('MRZ validation error:', err);
    return false;
  }
}

/**
 * Verifies document security features using third-party service.
 * This would integrate with SmileID, HyperVerge, or similar.
 */
async function verifyDocumentSecurity(imageUrl?: string): Promise<boolean> {
  if (!imageUrl) return false;
  
  try {
    // TODO: Integrate with SmileID or HyperVerge API
    // const response = await fetch('https://api.smileid.com/verify', {
    //   method: 'POST',
    //   headers: { 'Authorization': `Bearer ${process.env.SMILEID_API_KEY}` },
    //   body: JSON.stringify({ image: imageUrl })
    // });
    // const result = await response.json();
    // return result.isAuthentic;
    
    console.log('📸 Document security check (placeholder)');
    return true; // Placeholder - always returns true for demo
  } catch (err) {
    console.error('Document security check error:', err);
    return false;
  }
}

/**
 * Validates ePassport NFC digital signature.
 * Verifies the Document Security Object (SOD) signed by CSCA.
 */
function validateNFCSignature(nfcData: any): boolean {
  if (!nfcData) return false;
  
  try {
    // TODO: Implement CSCA certificate verification
    // This requires:
    // 1. Extract SOD from NFC data
    // 2. Verify signature against CSCA public key
    // 3. Validate DG1, DG2 hashes match SOD
    
    console.log('🔐 NFC signature verification (placeholder)');
    return true; // Placeholder
  } catch (err) {
    console.error('NFC verification error:', err);
    return false;
  }
}

/**
 * Checks if passport is expired.
 */
function isPassportExpired(expiryDate: string): boolean {
  try {
    // Parse YYMMDD format
    const yy = parseInt(expiryDate.substring(0, 2));
    const mm = parseInt(expiryDate.substring(2, 4));
    const dd = parseInt(expiryDate.substring(4, 6));
    
    // Convert to full year (20xx for yy < 50, 19xx otherwise)
    const year = yy < 50 ? 2000 + yy : 1900 + yy;
    
    const expiry = new Date(year, mm - 1, dd);
    const now = new Date();
    
    return expiry < now;
  } catch (err) {
    console.error('Date parsing error:', err);
    return true; // Assume expired if can't parse
  }
}

/**
 * Checks if passport is on a blacklist (lost/stolen/revoked).
 */
async function checkBlacklist(passportNumber: string): Promise<boolean> {
  try {
    // TODO: Check against INTERPOL Stolen and Lost Travel Documents (SLTD)
    // or similar database
    
    console.log('🚫 Blacklist check (placeholder)');
    return true; // Placeholder - always passes for demo
  } catch (err) {
    console.error('Blacklist check error:', err);
    return false;
  }
}

/**
 * Creates a hash of passport data for on-chain storage.
 */
function createPassportHash(passportData: PassportData): typeof Field {
  // Hash the critical passport fields
  const fields = [
    passportData.passportNumber,
    passportData.birthDate,
    passportData.expiryDate,
    passportData.nationality,
  ].map(str => {
    // Convert string to Field-compatible number
    const hash = Poseidon.hash(
      str.split('').map(c => Field(c.charCodeAt(0)))
    );
    return hash;
  });
  
  // Create composite hash
  return Poseidon.hash(fields);
}

/**
 * Signs the verification result using Oracle's private key.
 * UPDATED: Now includes hologramValid in the signature
 */
function signVerificationResult(
  passportHash: typeof Field,
  isValid: boolean,
  hologramValid: boolean
): typeof Signature {
  // Create message to sign
  // Message format: [passportHash, isValid, hologramValid, timestamp]
  const timestamp = Field(Math.floor(Date.now() / 1000));
  const validityFlag = Bool(isValid).toField();
  const hologramFlag = Bool(hologramValid).toField();
  
  const message = [passportHash, validityFlag, hologramFlag, timestamp];
  
  // Sign the message
  const signature = Signature.create(ORACLE_PRIVATE_KEY, message);
  
  return signature;
}

// ============================================
// API Routes
// ============================================

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'MinaID Oracle',
    oraclePublicKey: ORACLE_PUBLIC_KEY.toBase58(),
    timestamp: Date.now(),
  });
});

/**
 * Get Oracle's public key
 */
app.get('/oracle-key', (req, res) => {
  res.json({
    publicKey: ORACLE_PUBLIC_KEY.toBase58(),
    publicKeyJSON: ORACLE_PUBLIC_KEY.toJSON(),
  });
});

/**
 * Main verification endpoint (UPDATED with hologram support)
 * POST /verify-passport
 * 
 * Accepts multipart/form-data with:
 * - passportData: JSON string with passport information
 * - image: (optional) Image file for physical passport
 * - video: (optional) Video file for hologram verification
 */
app.post('/verify-passport', upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]), async (req, res) => {
  let videoPath: string | undefined;
  let imagePath: string | undefined;
  
  try {
    // Parse passport data from form
    const passportData: PassportData = JSON.parse(req.body.passportData);
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    // Get file paths
    if (files.image && files.image[0]) {
      imagePath = files.image[0].path;
    }
    if (files.video && files.video[0]) {
      videoPath = files.video[0].path;
    }
    
    console.log('📋 Received verification request');
    console.log('Type:', passportData.verificationType);
    console.log('Passport:', passportData.passportNumber);
    console.log('Has video:', !!videoPath);
    console.log('Has image:', !!imagePath);
    
    // Initialize hologram verification result
    let hologramResult = {
      valid: true, // Default to true if no video provided
      confidence: 0,
      details: 'No video provided',
      frames: 0,
      detections: 0
    };
    
    // Run hologram verification if video is provided
    if (videoPath) {
      try {
        hologramResult = await verifyHologram(videoPath);
      } catch (hologramError) {
        console.error('Hologram verification failed:', hologramError);
        hologramResult.valid = false;
        hologramResult.details = hologramError instanceof Error 
          ? hologramError.message 
          : 'Hologram verification failed';
      }
    }
    
    // Run all other verification checks
    const checks = {
      mrzChecksum: validateMRZChecksums(passportData),
      documentSecurity: await verifyDocumentSecurity(imagePath),
      expiryValid: !isPassportExpired(passportData.expiryDate),
      blacklist: await checkBlacklist(passportData.passportNumber),
      nfcSignature: passportData.verificationType === 'epassport' 
        ? validateNFCSignature(req.body.nfcData) 
        : undefined,
      hologramVerification: hologramResult.valid, // NEW: Include hologram check
    };
    
    // Determine overall validity (including hologram)
    const isValid = checks.mrzChecksum 
      && checks.documentSecurity 
      && checks.expiryValid 
      && checks.blacklist
      && (passportData.verificationType === 'physical' || checks.nfcSignature === true);
    
    const hologramValid = hologramResult.valid;
    
    console.log('✅ Verification checks:', checks);
    console.log('MRZ Valid:', isValid);
    console.log('Hologram Valid:', hologramValid);
    
    // Create passport hash
    const passportHash = createPassportHash(passportData);
    
    // Sign the result (NOW INCLUDES HOLOGRAM)
    const signature = signVerificationResult(passportHash, isValid, hologramValid);
    
    // Prepare response
    const result: VerificationResult = {
      isValid,
      hologramValid, // NEW: Include hologram validity
      passportHash: passportHash.toString(),
      signature: JSON.stringify(signature.toJSON()),
      oraclePublicKey: ORACLE_PUBLIC_KEY.toBase58(),
      timestamp: Date.now(),
      verificationType: passportData.verificationType,
      checks,
      hologramDetails: { // NEW: Include hologram details
        confidence: hologramResult.confidence,
        details: hologramResult.details,
        frames: hologramResult.frames,
        detections: hologramResult.detections,
      },
    };
    
    if (!isValid || !hologramValid) {
      const reasons = [];
      if (!isValid) reasons.push('MRZ/document verification failed');
      if (!hologramValid) reasons.push('Hologram verification failed');
      result.error = `Verification failed: ${reasons.join(', ')}. Check individual checks for details.`;
    }
    
    res.json(result);
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      isValid: false,
      hologramValid: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  } finally {
    // Clean up uploaded files
    if (videoPath && fs.existsSync(videoPath)) {
      fs.unlinkSync(videoPath);
    }
    if (imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
});

/**
 * Batch verification endpoint
 * POST /verify-batch
 */
app.post('/verify-batch', async (req, res) => {
  try {
    const { requests } = req.body as { requests: VerificationRequest[] };
    
    if (!Array.isArray(requests)) {
      return res.status(400).json({ error: 'requests must be an array' });
    }
    
    console.log(`📦 Processing batch of ${requests.length} verifications`);
    
    // Process all requests in parallel
    const results = await Promise.all(
      requests.map(async (request) => {
        try {
          const checks = {
            mrzChecksum: validateMRZChecksums(request.passportData),
            documentSecurity: await verifyDocumentSecurity(request.imageUrl),
            expiryValid: !isPassportExpired(request.passportData.expiryDate),
            blacklist: await checkBlacklist(request.passportData.passportNumber),
            nfcSignature: request.passportData.verificationType === 'epassport'
              ? validateNFCSignature(request.nfcData)
              : undefined,
          };
          
          const isValid = checks.mrzChecksum 
            && checks.documentSecurity 
            && checks.expiryValid 
            && checks.blacklist
            && (request.passportData.verificationType === 'physical' || checks.nfcSignature === true);
          
          const passportHash = createPassportHash(request.passportData);
          const hologramValid = true; // Batch endpoint doesn't support hologram verification yet
          const signature = signVerificationResult(passportHash, isValid, hologramValid);
          
          return {
            isValid,
            passportHash: passportHash.toString(),
            signature: JSON.stringify(signature.toJSON()),
            checks,
          };
        } catch (err) {
          return {
            isValid: false,
            error: err instanceof Error ? err.message : 'Unknown error',
          };
        }
      })
    );
    
    res.json({
      total: requests.length,
      results,
      oraclePublicKey: ORACLE_PUBLIC_KEY.toBase58(),
      timestamp: Date.now(),
    });
    
  } catch (error) {
    console.error('Batch verification error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================
// Start Server
// ============================================

const PORT = process.env.PORT || 4000;

// Initialize o1js and start server
async function startServer() {
  console.log('🔄 Initializing o1js...');
  await initO1js();
  console.log('✅ o1js initialized\n');
  
  app.listen(PORT, () => {
    console.log('');
    console.log('='.repeat(60));
    console.log('🚀 MinaID Oracle Server');
    console.log('='.repeat(60));
    console.log('');
    console.log(`📡 Listening on port ${PORT}`);
    console.log('');
    console.log('🔑 Oracle Public Key:');
    console.log(ORACLE_PUBLIC_KEY.toBase58());
    console.log('');
    console.log('📝 Add this public key to your smart contract:');
    console.log(`this.oraclePublicKey.set(PublicKey.fromBase58('${ORACLE_PUBLIC_KEY.toBase58()}'));`);
    console.log('');
    console.log('🌐 Endpoints:');
    console.log(`   GET  http://localhost:${PORT}/health`);
    console.log(`   GET  http://localhost:${PORT}/oracle-key`);
    console.log(`   POST http://localhost:${PORT}/verify-passport (with video support)`);
    console.log(`   POST http://localhost:${PORT}/verify-batch`);
    console.log('');
    console.log('🐍 Hologram Service:');
    console.log(`   ${HOLOGRAM_SERVICE_URL}`);
    console.log('   Make sure hologram service is running!');
    console.log('');
    console.log('='.repeat(60));
    console.log('');
  });
}

// Start the server
startServer().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});

export { ORACLE_PUBLIC_KEY, ORACLE_PRIVATE_KEY };
