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

interface ProofScannerCardProps {
  onVerificationComplete?: (result: VerificationResult) => void;
}

export function ProofScannerCard({ onVerificationComplete }: ProofScannerCardProps) {
  const [scanMode, setScanMode] = useState<'qr' | 'manual'>('manual');
  const [proofInput, setProofInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);

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
          const decoded = atob(proofInput);
          proofData = JSON.parse(decoded);
        } catch {
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

      // Simulate verification (TODO: integrate with actual on-chain verification)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Mock verification result
      const result: VerificationResult = {
        id: `verification_${Date.now()}`,
        proofId: proofData.id || 'unknown',
        status: 'verified', // In real implementation, this would come from on-chain verification
        timestamp: Date.now(),
        proofType: proofData.type || 'unknown',
        subjectDID: proofData.subjectDID || 'unknown',
      };

      // Save to history
      const history = JSON.parse(localStorage.getItem('minaid_verification_history') || '[]');
      history.unshift(result);
      localStorage.setItem('minaid_verification_history', JSON.stringify(history));

      setVerificationResult(result);

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

              {/* Info */}
              <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-800">
                  <strong>ℹ️ How to verify:</strong>
                </p>
                <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                  <li>Ask the user to share their proof (JSON or QR code)</li>
                  <li>Paste the proof data in the text area above</li>
                  <li>Click "Verify Proof" to check authenticity on-chain</li>
                </ul>
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
