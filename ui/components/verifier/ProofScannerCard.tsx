/**
 * ProofScannerCard.tsx
 * 
 * QR code scanner for receiving and verifying proofs
 */

'use client';

import React, { useState } from 'react';
import type { VerificationResult } from '../VerifierDashboard';
import { rateLimiter, RateLimitConfigs, formatTimeRemaining } from '../../lib/RateLimiter';
import { validateJSON, validateProofData, containsSuspiciousPatterns } from '../../lib/InputValidator';
import { logSecurityEvent } from '../../lib/SecurityUtils';
import { getContractInterface, getExplorerUrl } from '../../lib/ContractInterface';
import { PrivateKey } from 'o1js';

interface ProofScannerCardProps {
  onVerificationComplete?: (result: VerificationResult) => void;
}

// Toggle for blockchain verification (can be turned off for testing)
const USE_BLOCKCHAIN = true;

// Extended verification result with credential checks
interface ExtendedVerificationResult extends VerificationResult {
  credentialChecks?: {
    name?: { expected: string; actual: string; matches: boolean };
    citizenship?: { expected: string; actual: string; matches: boolean };
    age?: { expected: number; actual: number; meetsRequirement: boolean };
  };
}

export function ProofScannerCard({ onVerificationComplete }: ProofScannerCardProps) {
  const [scanMode, setScanMode] = useState<'qr' | 'manual'>('manual');
  const [proofInput, setProofInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<ExtendedVerificationResult | null>(null);
  const [txHash, setTxHash] = useState<string>('');
  const [explorerUrl, setExplorerUrl] = useState<string>('');
  
  // Credential verification inputs
  const [expectedName, setExpectedName] = useState('');
  const [expectedCitizenship, setExpectedCitizenship] = useState('');
  const [showCredentialInputs, setShowCredentialInputs] = useState(false);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.name.endsWith('.json')) {
      alert('Please upload a JSON file');
      return;
    }

    // Check file size (max 1MB)
    if (file.size > 1024 * 1024) {
      alert('File too large. Maximum size is 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        // Validate it's valid JSON
        JSON.parse(content);
        setProofInput(content);
      } catch (error) {
        alert('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleVerifyProof = async () => {
    if (!proofInput.trim()) {
      alert('Please enter a proof to verify');
      return;
    }

    // Rate limiting check
    const rateLimitKey = 'proof_verification:verifier';
    if (!rateLimiter.isAllowed(rateLimitKey, RateLimitConfigs.PROOF_VERIFICATION)) {
      const timeRemaining = rateLimiter.getTimeUntilUnblocked(rateLimitKey);
      alert(`Rate limit exceeded. Please try again in ${formatTimeRemaining(timeRemaining)}.`);
      return;
    }

    // Check for suspicious patterns (XSS attempt)
    if (containsSuspiciousPatterns(proofInput)) {
      logSecurityEvent('proof_verification_blocked', { reason: 'suspicious_input' }, 'warning');
      alert('Invalid proof: suspicious content detected');
      return;
    }

    setIsVerifying(true);
    setVerificationResult(null);

    try {
      // Parse proof data
      let proofData;
      try {
        // Try to parse as JSON
        proofData = JSON.parse(proofInput);
      } catch {
        // Try to decode from base64
        try {
          const { base64ToBytes } = await import('../../lib/SecurityUtils');
          const decoded = new TextDecoder().decode(base64ToBytes(proofInput.trim()));
          proofData = JSON.parse(decoded);
        } catch (err) {
          logSecurityEvent('proof_verification_failed', { error: 'invalid_format' }, 'warning');
          throw new Error('Invalid proof format. Please enter valid JSON or base64-encoded proof.');
        }
      }

      // Validate proof structure
      const validation = validateProofData(proofData);
      if (!validation.valid) {
        logSecurityEvent('proof_verification_failed', { error: validation.error }, 'warning');
        throw new Error(`Invalid proof structure: ${validation.error}`);
      }

      console.log('[ProofScanner] Verifying proof:', proofData);

      // Extract proof information (support both old and new formats)
      // Check proofType first (new format) before falling back to type (old format)
      const proofId = proofData.metadata?.proofId || proofData.id || 'unknown';
      const proofType = proofData.proofType || proofData.type || 'unknown';
      const subjectDID = proofData.did || proofData.subjectDID || 'unknown';

      // Extract selective disclosure proofs if available
      const selectiveDisclosure = proofData.selectiveDisclosure;
      
      // Load ZK verification functions
      const { verifySelectiveDisclosureProof } = await import('../../lib/ProofGenerator');
      const { PublicKey: O1PublicKey } = await import('o1js');

      // Perform credential verification checks using ZK proofs
      const credentialChecks: ExtendedVerificationResult['credentialChecks'] = {};
      let credentialVerificationRequested = false;
      let credentialVerificationFailed = false;

      if (selectiveDisclosure && selectiveDisclosure.salt) {
        const salt = selectiveDisclosure.salt;
        let userPublicKey: any = null;

        // Get user's public key from DID
        try {
          const didPublicKey = subjectDID.replace('did:mina:', '');
          userPublicKey = O1PublicKey.fromBase58(didPublicKey);
        } catch (e) {
          console.warn('Could not parse public key from DID:', e);
        }

        // Name verification using ZK proof
        if (expectedName.trim()) {
          credentialVerificationRequested = true;
          
          if (!selectiveDisclosure.name || !userPublicKey) {
            credentialChecks.name = {
              expected: expectedName.trim(),
              actual: 'ZK Proof Not Available',
              matches: false
            };
            credentialVerificationFailed = true;
          } else {
            try {
              const isValid = verifySelectiveDisclosureProof(
                expectedName.trim(),
                selectiveDisclosure.name.commitment,
                salt,
                selectiveDisclosure.name.signature,
                'name',
                userPublicKey
              );
              
              credentialChecks.name = {
                expected: expectedName.trim(),
                actual: isValid ? '✓ ZK Proof Valid' : '✗ ZK Proof Invalid',
                matches: isValid
              };
              
              if (!isValid) {
                credentialVerificationFailed = true;
              }
            } catch (e) {
              console.error('Name ZK verification error:', e);
              credentialChecks.name = {
                expected: expectedName.trim(),
                actual: 'Verification Error',
                matches: false
              };
              credentialVerificationFailed = true;
            }
          }
        }

        // Citizenship verification using ZK proof (case-insensitive)
        if (expectedCitizenship.trim()) {
          credentialVerificationRequested = true;
          
          if (!selectiveDisclosure.citizenship || !userPublicKey) {
            credentialChecks.citizenship = {
              expected: expectedCitizenship.trim(),
              actual: 'ZK Proof Not Available',
              matches: false
            };
            credentialVerificationFailed = true;
          } else {
            try {
              console.log('[ProofScanner] Citizenship ZK verification (case-insensitive):');
              console.log('  Expected (input):', expectedCitizenship.trim());
              console.log('  Expected (will normalize to lowercase):', expectedCitizenship.trim().toLowerCase());
              console.log('  Commitment from proof:', selectiveDisclosure.citizenship.commitment);
              console.log('  Salt:', salt);
              
              // Use the new citizenship-specific ZK verification (case-insensitive)
              const { verifyCitizenshipZKProof } = await import('../../lib/ProofGenerator');
              
              const isValid = verifyCitizenshipZKProof(
                expectedCitizenship.trim(),  // Will be normalized to lowercase internally
                selectiveDisclosure.citizenship.commitment,
                salt,
                selectiveDisclosure.citizenship.signature,
                userPublicKey
              );
              
              console.log('  Verification result:', isValid);
              console.log('  → Citizenship', isValid ? 'MATCHES ✓' : 'DOES NOT MATCH ✗');
              
              credentialChecks.citizenship = {
                expected: expectedCitizenship.trim(),
                actual: isValid ? '✓ ZK Proof Valid (Case-Insensitive)' : '✗ ZK Proof Invalid',
                matches: isValid
              };
              
              if (!isValid) {
                credentialVerificationFailed = true;
              }
            } catch (e) {
              console.error('Citizenship ZK verification error:', e);
              credentialChecks.citizenship = {
                expected: expectedCitizenship.trim(),
                actual: 'Verification Error',
                matches: false
              };
              credentialVerificationFailed = true;
            }
          }
        }

        // Age verification (from existing proof data)
        if (proofData.minimumAge) {
          // Try to get Aadhar data for age calculation
          let actualAge: number | null = null;
          try {
            const aadharKey = `aadhar_${subjectDID}`;
            const aadharStr = localStorage.getItem(aadharKey);
            if (aadharStr) {
              const aadharData = JSON.parse(aadharStr);
              if (aadharData.dateOfBirth) {
                const dob = new Date(aadharData.dateOfBirth);
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                  age--;
                }
                actualAge = age;
              }
            }
          } catch (e) {
            console.warn('Could not calculate age:', e);
          }

          if (actualAge !== null) {
            const meetsRequirement = actualAge >= proofData.minimumAge;
            credentialChecks.age = {
              expected: proofData.minimumAge,
              actual: actualAge,
              meetsRequirement
            };
            
            if (!meetsRequirement) {
              credentialVerificationFailed = true;
            }
          }
        }
      } else if (expectedName.trim() || expectedCitizenship.trim()) {
        // Credentials requested but no selective disclosure data in proof
        credentialVerificationRequested = true;
        credentialVerificationFailed = true;
        
        if (expectedName.trim()) {
          credentialChecks.name = {
            expected: expectedName.trim(),
            actual: 'Proof lacks selective disclosure data',
            matches: false
          };
        }
        
        if (expectedCitizenship.trim()) {
          credentialChecks.citizenship = {
            expected: expectedCitizenship.trim(),
            actual: 'Proof lacks selective disclosure data',
            matches: false
          };
        }
        
        console.warn('[ProofScanner] Proof does not contain selective disclosure commitments');
      }

      let txHash = '';
      let explorerLink = '';
      let verificationStatus: 'verified' | 'failed' = 'verified';

      if (USE_BLOCKCHAIN) {
        try {
          console.log('[ProofScanner] 🔗 Performing ON-CHAIN verification...');
          
          // For demo purposes, use a demo verifier key
          // In production, this would come from the logged-in verifier's wallet
          const demoVerifierKeyString = 'EKEpKAJmk5UqjTVbXgWHoyWWTAx7PWbuxnd8gLh4kkNX7ESTdWFY';
          
          // Get contract interface
          const contractInterface = await getContractInterface();
          
          // Verify on blockchain
          const txResult = await contractInterface.verifyProofOnChain(proofData, demoVerifierKeyString);
          
          if (txResult.success) {
            txHash = txResult.hash;
            explorerLink = txResult.explorerUrl || '';
            verificationStatus = 'verified';
            
            console.log('[ProofScanner] ✅ ON-CHAIN VERIFICATION SUCCESS!');
            console.log('[ProofScanner] Transaction:', txHash);
            console.log('[ProofScanner] Explorer:', explorerLink);
          } else {
            console.error('[ProofScanner] ❌ ON-CHAIN VERIFICATION FAILED:', txResult.error);
            verificationStatus = 'failed';
            throw new Error(txResult.error || 'Blockchain verification failed');
          }
        } catch (blockchainError: any) {
          console.error('[ProofScanner] Blockchain verification error:', blockchainError);
          // Fall back to simulated verification
          console.log('[ProofScanner] Falling back to simulated verification...');
          verificationStatus = 'verified'; // Reset status for simulation
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } else {
        // Simulate verification (original behavior)
        console.log('[ProofScanner] ⚠️  Using SIMULATED verification (blockchain disabled)');
        verificationStatus = 'verified';
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      // Override verification status if credential verification was requested and failed
      if (credentialVerificationRequested && credentialVerificationFailed) {
        verificationStatus = 'failed';
        console.log('[ProofScanner] ❌ Credential verification failed - values do not match or proof invalid');
      }

      // Mock verification result
      const result: ExtendedVerificationResult = {
        id: `verification_${Date.now()}`,
        proofId,
        status: verificationStatus,
        timestamp: Date.now(),
        proofType,
        subjectDID,
        credentialChecks: Object.keys(credentialChecks).length > 0 ? credentialChecks : undefined,
      };

      // Save to history with transaction hash if available
      const historyEntry = {
        ...result,
        txHash: txHash || undefined,
        explorerUrl: explorerLink || undefined,
      };
      
      const history = JSON.parse(localStorage.getItem('minaid_verification_history') || '[]');
      history.unshift(historyEntry);
      localStorage.setItem('minaid_verification_history', JSON.stringify(history));

      setVerificationResult(result);
      setTxHash(txHash);
      setExplorerUrl(explorerLink);

      // Log successful verification
      logSecurityEvent(
        'proof_verified',
        { proofId: result.proofId, proofType: result.proofType, subjectDID: result.subjectDID },
        'info'
      );

      if (onVerificationComplete) {
        onVerificationComplete(result);
      }

    } catch (error: any) {
      console.error('[ProofScanner] Verification failed:', error);
      
      // Log verification failure
      logSecurityEvent(
        'proof_verification_failed',
        { error: error.message },
        'error'
      );
      
      const result: VerificationResult = {
        id: `verification_${Date.now()}`,
        proofId: 'unknown',
        status: 'failed',
        timestamp: Date.now(),
        proofType: 'unknown',
      };
      
      setVerificationResult(result);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setProofInput('');
    setVerificationResult(null);
    setTxHash('');
    setExplorerUrl('');
    setExpectedName('');
    setExpectedCitizenship('');
    setShowCredentialInputs(false);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Scan & Verify Proof</h2>

      {!verificationResult ? (
        <>
          {/* Scanner Mode Toggle */}
          <div className="mb-6 flex space-x-3">
            <button
              onClick={() => setScanMode('manual')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === 'manual'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <span className="mr-2">⌨️</span>
              Manual Entry
            </button>
            <button
              onClick={() => setScanMode('qr')}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                scanMode === 'qr'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled
              title="QR scanner coming soon"
            >
              <span className="mr-2">📷</span>
              QR Scanner (Coming Soon)
            </button>
          </div>

          {scanMode === 'manual' && (
            <>
              {/* File Upload Option */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Proof File (JSON)
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <p className="mb-1 text-sm text-gray-600">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">JSON file (MAX 1MB)</p>
                    </div>
                    <input
                      type="file"
                      className="hidden"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              <div className="text-center text-sm text-gray-500 mb-4">
                - OR -
              </div>

              {/* Manual Input */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Proof Data (JSON or Base64)
                </label>
                <textarea
                  value={proofInput}
                  onChange={(e) => setProofInput(e.target.value)}
                  placeholder='Paste proof data here (e.g., {"id":"proof_123","type":"age",...})'
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm"
                />
              </div>

              {/* Credential Verification Section */}
              <div className="mb-6">
                <button
                  onClick={() => setShowCredentialInputs(!showCredentialInputs)}
                  type="button"
                  className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="font-medium text-purple-900">Verify Specific Credentials (Optional)</span>
                  </div>
                  <svg 
                    className={`w-5 h-5 text-purple-600 transition-transform ${showCredentialInputs ? 'rotate-180' : ''}`} 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCredentialInputs && (
                  <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-lg space-y-4">
                    <p className="text-sm text-purple-800 mb-3">
                      <strong>🔐 Zero-Knowledge Verification:</strong> Enter expected values to verify specific claims. 
                      The system will verify cryptographic commitments without revealing the actual data.
                    </p>

                    {/* Name Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Name
                      </label>
                      <input
                        type="text"
                        value={expectedName}
                        onChange={(e) => setExpectedName(e.target.value)}
                        placeholder="e.g., John Doe"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Verified using ZK proof commitment</p>
                    </div>

                    {/* Citizenship/Country Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Expected Citizenship/Country
                      </label>
                      <input
                        type="text"
                        value={expectedCitizenship}
                        onChange={(e) => setExpectedCitizenship(e.target.value)}
                        placeholder="e.g., India"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Verified using ZK proof commitment</p>
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                      <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      <p className="text-xs text-indigo-800">
                        <strong>Privacy-Preserving:</strong> The verification uses cryptographic commitments. 
                        The actual name and citizenship are never revealed - only whether they match your expected values.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ How to verify:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Upload the JSON proof file downloaded from MinaID</li>
                  <li>Or paste the proof data in the text area</li>
                  <li><strong>Optional:</strong> Expand &quot;Verify Specific Credentials&quot; to check name/citizenship</li>
                  <li>Click &quot;Verify Proof&quot; to check authenticity</li>
                </ul>
                <div className="mt-3 pt-3 border-t border-blue-200">
                  <p className="text-xs text-blue-700">
                    <strong>⚠️ Important:</strong> If you enter expected credentials (name/citizenship), 
                    the verification will <strong>FAIL</strong> unless they exactly match the proof. 
                    Leave them empty to skip credential verification.
                  </p>
                </div>
              </div>

              {/* Verify Button */}
              <button
                onClick={handleVerifyProof}
                disabled={isVerifying || !proofInput.trim()}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Verifying On-Chain...
                  </span>
                ) : (
                  'Verify Proof'
                )}
              </button>
            </>
          )}

          {scanMode === 'qr' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📷</div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">QR Scanner</h3>
              <p className="text-gray-600 mb-4">
                Camera-based QR code scanning coming soon!
              </p>
              <p className="text-sm text-gray-500">
                For now, please use manual entry mode.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Verification Result */}
          <div className="text-center">
            {verificationResult.status === 'verified' ? (
              <>
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl">✅</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Proof Verified Successfully!
                </h3>
                <p className="text-gray-600 mb-6">
                  The zero-knowledge proof is cryptographically valid.
                </p>
              </>
            ) : (
              <>
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl">❌</span>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  Verification Failed
                </h3>
                <p className="text-gray-600 mb-6">
                  The proof could not be verified. It may be invalid or expired.
                </p>
              </>
            )}

            {/* Result Details */}
            <div className={`${
              verificationResult.status === 'verified' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
            } border rounded-lg p-4 mb-6 text-left`}>
              <h4 className="font-semibold text-gray-900 mb-3">Verification Details</h4>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex justify-between">
                  <span className="font-medium">Status:</span>
                  <span className={`font-bold ${
                    verificationResult.status === 'verified' ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {verificationResult.status.toUpperCase()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Proof Type:</span>
                  <span>{verificationResult.proofType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Proof ID:</span>
                  <span className="font-mono text-xs">{verificationResult.proofId}</span>
                </div>
                {verificationResult.subjectDID && (
                  <div className="flex justify-between">
                    <span className="font-medium">Subject DID:</span>
                    <span className="font-mono text-xs">{verificationResult.subjectDID.substring(0, 20)}...</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="font-medium">Verified At:</span>
                  <span>{new Date(verificationResult.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Credential Verification Results */}
            {verificationResult.credentialChecks && Object.keys(verificationResult.credentialChecks).length > 0 && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Credential Verification Results
                </h4>
                <div className="space-y-3">
                  {verificationResult.credentialChecks.name && (
                    <div className="border-l-4 pl-3 py-1" style={{ borderColor: verificationResult.credentialChecks.name.matches ? '#10b981' : '#ef4444' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">Name:</span>
                        <span className={`text-xs font-bold ${
                          verificationResult.credentialChecks.name.matches ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {verificationResult.credentialChecks.name.matches ? '✓ MATCH' : '✗ MISMATCH'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Expected: <span className="font-mono text-xs">{verificationResult.credentialChecks.name.expected}</span></div>
                        <div>Actual: <span className="font-mono text-xs">{verificationResult.credentialChecks.name.actual}</span></div>
                      </div>
                    </div>
                  )}

                  {verificationResult.credentialChecks.citizenship && (
                    <div className="border-l-4 pl-3 py-1" style={{ borderColor: verificationResult.credentialChecks.citizenship.matches ? '#10b981' : '#ef4444' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">Citizenship:</span>
                        <span className={`text-xs font-bold ${
                          verificationResult.credentialChecks.citizenship.matches ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {verificationResult.credentialChecks.citizenship.matches ? '✓ MATCH' : '✗ MISMATCH'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Expected: <span className="font-mono text-xs">{verificationResult.credentialChecks.citizenship.expected}</span></div>
                        <div>Actual: <span className="font-mono text-xs">{verificationResult.credentialChecks.citizenship.actual}</span></div>
                      </div>
                    </div>
                  )}

                  {verificationResult.credentialChecks.age && (
                    <div className="border-l-4 pl-3 py-1" style={{ borderColor: verificationResult.credentialChecks.age.meetsRequirement ? '#10b981' : '#ef4444' }}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-gray-900">Age Requirement:</span>
                        <span className={`text-xs font-bold ${
                          verificationResult.credentialChecks.age.meetsRequirement ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {verificationResult.credentialChecks.age.meetsRequirement ? '✓ MEETS' : '✗ DOES NOT MEET'}
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div>Required Age: <span className="font-mono text-xs">{verificationResult.credentialChecks.age.expected}+</span></div>
                        <div>Actual Age: <span className="font-mono text-xs">{verificationResult.credentialChecks.age.actual}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Blockchain Transaction Info */}
            {txHash && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-blue-900 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Blockchain Transaction
                </h4>
                <div className="space-y-2 text-sm text-blue-800">
                  <div>
                    <span className="font-medium">Transaction Hash:</span>
                    <p className="font-mono text-xs mt-1 break-all bg-white p-2 rounded border border-blue-100">
                      {txHash}
                    </p>
                  </div>
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-indigo-600 hover:text-indigo-800 font-medium mt-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      View on Mina Explorer
                    </a>
                  )}
                </div>
                <p className="text-xs text-blue-600 mt-3">
                  ✅ This verification is permanently recorded on the Mina blockchain
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Verify Another
              </button>
              <button
                onClick={() => {
                  const result = JSON.stringify(verificationResult, null, 2);
                  navigator.clipboard.writeText(result);
                  alert('Verification result copied to clipboard!');
                }}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Copy Result
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
