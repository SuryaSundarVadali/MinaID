/**
 * VerifierDashboard.tsx
 * 
 * Verifier dashboard with on-chain proof verification
 * Allows uploading proof JSON files for verification using RobustTransactionSubmitter
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWallet } from '../context/WalletContext';
import GradientBG from './GradientBG';
import heroMinaLogo from '../public/assets/hero-mina-logo.svg';
import styles from '../styles/Home.module.css';
import { rateLimiter, RateLimitConfigs, formatTimeRemaining as formatRLTime } from '../lib/RateLimiter';
import { validateProofData, containsSuspiciousPatterns } from '../lib/InputValidator';
import { logSecurityEvent } from '../lib/SecurityUtils';
import { getContractInterface } from '../lib/ContractInterface';
import { validateProofForSubmission, quickValidate } from '../lib/PreSubmissionValidator';
import { submitTransaction, canSubmit, SubmissionResult } from '../lib/RobustTransactionSubmitter';
import { monitorTransaction, TxStatus, getStatusMessage, formatTimeRemaining } from '../lib/CompleteTransactionMonitor';
import { GeneratedProof } from '../lib/SmartProofGenerator';

export type VerificationResult = {
  id: string;
  proofId: string;
  requestId?: string;
  status: 'verified' | 'failed' | 'invalid';
  timestamp: number;
  proofType: string;
  subjectDID?: string;
  txHash?: string;
  verificationMethod?: 'on-chain' | 'client-side';
};

export function VerifierDashboard() {
  const router = useRouter();
  const { logout } = useWallet();
  
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofData, setProofData] = useState<any>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [expectedName, setExpectedName] = useState('');
  const [expectedCitizenship, setExpectedCitizenship] = useState('');
  const [history, setHistory] = useState<any[]>([]);
  
  // On-chain verification state
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [txHash, setTxHash] = useState<string>('');
  const [txStatus, setTxStatus] = useState<TxStatus>('unknown');
  const [useOnChain, setUseOnChain] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('minaid_verification_history');
    if (stored) {
      setHistory(JSON.parse(stored).slice(0, 10));
    }
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('minaid_passkey_last_verified');
    localStorage.removeItem('minaid_passkey_verified_did');
    sessionStorage.removeItem('minaid_passkey_verified');
    logout();
    router.push('/');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setError('');
    setVerificationResult(null);

    if (!file.name.endsWith('.json')) {
      setError('Please upload a JSON file');
      return;
    }
    if (file.size > 1024 * 1024) {
      setError('File too large. Maximum size is 1MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        if (containsSuspiciousPatterns(content)) {
          setError('Invalid proof: suspicious content detected');
          return;
        }
        setProofFile(file);
        setProofData(parsed);
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  };

  const handleVerify = async () => {
    if (!proofData) {
      setError('Please upload a proof file first');
      return;
    }

    const rateLimitKey = 'proof_verification:verifier';
    if (!rateLimiter.isAllowed(rateLimitKey, RateLimitConfigs.PROOF_VERIFICATION)) {
      const timeRemaining = rateLimiter.getTimeUntilUnblocked(rateLimitKey);
      setError(`Rate limit exceeded. Try again in ${formatRLTime(timeRemaining)}.`);
      return;
    }

    setIsVerifying(true);
    setError('');
    setVerificationProgress(0);
    setVerificationStatus('Validating proof data...');
    setTxHash('');
    setTxStatus('unknown');

    try {
      const validation = validateProofData(proofData);
      if (!validation.valid) {
        throw new Error(`Invalid proof: ${validation.error}`);
      }

      const proofId = proofData.metadata?.proofId || proofData.id || 'unknown';
      const proofType = proofData.proofType || proofData.type || 'unknown';
      const subjectDID = proofData.did || proofData.subjectDID || 'unknown';
      
      if (proofType === 'citizenship' && (!expectedName.trim() || !expectedCitizenship.trim())) {
        throw new Error('Citizenship verification requires Name and Citizenship fields');
      }

      // Import o1js for cryptographic verification
      const { PublicKey, Signature, Field } = await import('o1js');
      const { verifySelectiveDisclosureProof, verifyCitizenshipZKProof } = await import('../lib/ProofGenerator');

      let credentialChecks: any = {};
      let cryptoVerified = false;
      const selectiveDisclosure = proofData.selectiveDisclosure;
      
      // Parse the proof data
      let parsedProof: any = {};
      try {
        parsedProof = typeof proofData.proof === 'string' ? JSON.parse(proofData.proof) : proofData.proof;
      } catch {}

      // Get public key from proof
      let userPublicKey: any = null;
      try {
        if (parsedProof?.publicKey) {
          userPublicKey = PublicKey.fromBase58(parsedProof.publicKey);
        } else {
          userPublicKey = PublicKey.fromBase58(subjectDID.replace('did:mina:', ''));
        }
      } catch (e) {
        console.warn('Failed to parse public key:', e);
      }

      setVerificationProgress(20);
      setVerificationStatus('Verifying signature...');

      // ========== CLIENT-SIDE CRYPTOGRAPHIC VERIFICATION ==========
      if (parsedProof?.signature && parsedProof?.commitment && userPublicKey) {
        try {
          const signature = Signature.fromBase58(parsedProof.signature);
          const commitment = Field(parsedProof.commitment);
          const isValidSignature = signature.verify(userPublicKey, [commitment]);
          cryptoVerified = isValidSignature.toBoolean();
          console.log('[Verify] Signature verification:', cryptoVerified);
        } catch (sigError) {
          console.warn('[Verify] Signature verification failed:', sigError);
          cryptoVerified = false;
        }
      }

      setVerificationProgress(40);
      
      // Verify selective disclosure proofs if present
      if (selectiveDisclosure?.salt && userPublicKey) {
        if (expectedName.trim() && selectiveDisclosure.name) {
          try {
            const isValid = verifySelectiveDisclosureProof(
              expectedName.trim(),
              selectiveDisclosure.name.commitment,
              selectiveDisclosure.salt,
              selectiveDisclosure.name.signature,
              'name',
              userPublicKey
            );
            credentialChecks.name = { expected: expectedName.trim(), matches: isValid };
          } catch {
            credentialChecks.name = { expected: expectedName.trim(), matches: false };
          }
        }

        if (expectedCitizenship.trim() && selectiveDisclosure.citizenship) {
          try {
            const isValid = verifyCitizenshipZKProof(
              expectedCitizenship.trim(),
              selectiveDisclosure.citizenship.commitment,
              selectiveDisclosure.salt,
              selectiveDisclosure.citizenship.signature,
              userPublicKey
            );
            credentialChecks.citizenship = { expected: expectedCitizenship.trim(), matches: isValid };
          } catch {
            credentialChecks.citizenship = { expected: expectedCitizenship.trim(), matches: false };
          }
        }
      }

      setVerificationProgress(60);

      // ========== ON-CHAIN VERIFICATION (if enabled and wallet connected) ==========
      let onChainVerified = false;
      let transactionHash = '';
      let verificationMethod: 'on-chain' | 'client-side' = 'client-side';

      if (useOnChain && cryptoVerified) {
        const walletStatus = canSubmit();
        
        if (walletStatus.ready) {
          setVerificationStatus('Submitting on-chain verification...');
          
          try {
            // Pre-validate the proof
            const preValidation = await validateProofForSubmission(proofData as GeneratedProof);
            if (!preValidation.isValid) {
              console.warn('[Verify] Pre-validation warnings:', preValidation.errors);
            }

            // Submit verification transaction
            const submissionResult = await submitTransaction(
              proofData as GeneratedProof,
              async () => {
                // Build verification transaction
                // For now, just return the proof data as JSON
                // The actual transaction will be signed by the wallet
                return JSON.stringify({
                  type: 'verification',
                  proof: proofData,
                  timestamp: Date.now(),
                });
              },
              {
                onAttempt: (attempt, max) => {
                  setVerificationStatus(`Submission attempt ${attempt}/${max}...`);
                  setVerificationProgress(60 + (attempt / max) * 15);
                },
                onRetry: (delay, reason) => {
                  setVerificationStatus(`Retrying in ${Math.round(delay / 1000)}s: ${reason}`);
                },
                onSuccess: (hash) => {
                  setTxHash(hash);
                  transactionHash = hash;
                },
              }
            );

            if (submissionResult.success && submissionResult.transactionHash) {
              setVerificationProgress(80);
              setVerificationStatus('Monitoring transaction...');
              
              // Monitor the transaction
              const monitorResult = await monitorTransaction(
                submissionResult.transactionHash,
                {
                  onStatusChange: (status, message) => {
                    setTxStatus(status);
                    setVerificationStatus(message);
                  },
                  onProgress: (elapsed, maxWait) => {
                    const progress = 80 + (elapsed / maxWait) * 20;
                    setVerificationProgress(Math.min(progress, 99));
                  },
                }
              );

              if (monitorResult.status === 'confirmed' || monitorResult.status === 'included') {
                onChainVerified = true;
                verificationMethod = 'on-chain';
              }
            }
          } catch (onChainError: any) {
            console.warn('[Verify] On-chain verification failed, falling back to client-side:', onChainError.message);
            // Continue with client-side verification result
          }
        } else {
          console.log('[Verify] Wallet not connected, using client-side verification');
        }
      }

      setVerificationProgress(100);

      // Determine final status
      const credentialFailed = Object.values(credentialChecks).some((c: any) => !c.matches);
      const hasCredentialChecks = Object.keys(credentialChecks).length > 0;
      
      let status: 'verified' | 'failed' = 'failed';
      if (onChainVerified || (cryptoVerified && !credentialFailed)) {
        status = 'verified';
      } else if (hasCredentialChecks && !credentialFailed) {
        status = 'verified';
      }

      const result = { 
        id: `v_${Date.now()}`, 
        proofId, 
        proofType, 
        subjectDID, 
        status, 
        timestamp: Date.now(), 
        credentialChecks,
        cryptoVerified,
        onChainVerified,
        txHash: transactionHash,
        verificationMethod,
      };
      
      const newHistory = [result, ...history].slice(0, 20);
      localStorage.setItem('minaid_verification_history', JSON.stringify(newHistory));
      setHistory(newHistory);
      setVerificationResult(result);
      setVerificationStatus(status === 'verified' ? 'Verification complete!' : 'Verification failed');
      logSecurityEvent('proof_verified', { proofId, status, cryptoVerified, onChainVerified, verificationMethod }, 'info');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
      setVerificationStatus('Error: ' + (err.message || 'Verification failed'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReset = () => {
    setProofFile(null);
    setProofData(null);
    setVerificationResult(null);
    setError('');
    setExpectedName('');
    setExpectedCitizenship('');
  };

  return (
    <GradientBG>
      <div className={styles.main} style={{ padding: '2rem', minHeight: '100vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '1200px', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Image src={heroMinaLogo} alt="Mina" width={50} height={50} style={{ filter: 'invert(0.7)', mixBlendMode: 'difference' }} />
            <div>
              <h1 style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '1.5rem', color: '#fff' }}>Verifier Portal</h1>
              <p style={{ fontFamily: 'var(--font-monument-light)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.8)' }}>Upload & Verify ZK Proofs</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => router.push('/dashboard')} className={styles.card} style={{ padding: '0.5rem 1rem', minHeight: 'auto', width: 'auto' }}>
              <h2 style={{ marginBottom: 0, fontSize: '0.875rem' }}><span>Dashboard</span></h2>
            </button>
            <button onClick={handleLogout} className={styles.card} style={{ padding: '0.5rem 1rem', minHeight: 'auto', width: 'auto' }}>
              <h2 style={{ marginBottom: 0, fontSize: '0.875rem' }}><span>Logout</span></h2>
            </button>
          </div>
        </div>

        <p className={styles.tagline}>ZERO-KNOWLEDGE PROOF VERIFICATION</p>
        <p className={styles.start}>Upload a proof file to verify its authenticity</p>

        <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '4px', border: '1px solid #2d2d2d', padding: '2rem', width: '100%', maxWidth: '600px', marginTop: '2rem' }}>
          {!verificationResult ? (
            <>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>UPLOAD PROOF FILE</label>
                <div style={{ border: '2px dashed #ccc', borderRadius: '4px', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: proofFile ? '#e8f5e9' : '#fafafa' }}>
                  <input type="file" accept=".json" onChange={handleFileUpload} style={{ display: 'none' }} id="proof-file" />
                  <label htmlFor="proof-file" style={{ cursor: 'pointer' }}>
                    {proofFile ? (
                      <><span style={{ fontSize: '2rem' }}>✓</span><p style={{ fontFamily: 'var(--font-monument)', marginTop: '0.5rem' }}>{proofFile.name}</p></>
                    ) : (
                      <><span style={{ fontSize: '2rem' }}>📄</span><p style={{ fontFamily: 'var(--font-monument)', marginTop: '0.5rem' }}>Click to upload JSON proof</p></>
                    )}
                  </label>
                </div>
              </div>

              {proofData && (
                <div style={{ background: '#f5f5f5', borderRadius: '4px', padding: '1rem', marginBottom: '1.5rem' }}>
                  <p style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.75rem' }}>PROOF TYPE: {proofData.proofType || proofData.type || 'Unknown'}</p>
                  {proofData.did && <p style={{ fontFamily: 'monospace', fontSize: '0.75rem', marginTop: '0.5rem' }}>DID: {proofData.did.substring(0, 30)}...</p>}
                </div>
              )}

              {proofData?.selectiveDisclosure && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <p style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '1rem' }}>VERIFY CREDENTIALS</p>
                  <input type="text" value={expectedName} onChange={(e) => setExpectedName(e.target.value)} placeholder="Expected Name" style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px', marginBottom: '0.5rem' }} />
                  <input type="text" value={expectedCitizenship} onChange={(e) => setExpectedCitizenship(e.target.value)} placeholder="Expected Citizenship (e.g., India)" style={{ width: '100%', padding: '0.75rem', border: '1px solid #ccc', borderRadius: '4px' }} />
                </div>
              )}

              {error && <div style={{ background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '4px', padding: '0.75rem', marginBottom: '1rem', color: '#DC2626', fontSize: '0.875rem' }}>{error}</div>}

              <button onClick={handleVerify} disabled={!proofData || isVerifying} className={styles.card} style={{ width: '100%', margin: 0, opacity: (!proofData || isVerifying) ? 0.5 : 1 }}>
                <h2><span>{isVerifying ? '⏳ Verifying...' : '✓ Verify Proof'}</span><span>→</span></h2>
                <p>Cryptographically verify the proof on-chain</p>
              </button>
            </>
          ) : (
            <>
              <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                <span style={{ fontSize: '4rem' }}>{verificationResult.status === 'verified' ? '✅' : '❌'}</span>
                <h3 style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '1.5rem', color: verificationResult.status === 'verified' ? '#2e7d32' : '#c62828', marginTop: '1rem' }}>
                  {verificationResult.status === 'verified' ? 'PROOF VERIFIED' : 'VERIFICATION FAILED'}
                </h3>
              </div>

              <div style={{ background: '#f5f5f5', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
                <p><span style={{ fontFamily: 'var(--font-monument-light)', fontSize: '0.75rem' }}>Type: </span><strong>{verificationResult.proofType}</strong></p>
                {verificationResult.txHash && <p style={{ marginTop: '0.5rem' }}><span style={{ fontFamily: 'var(--font-monument-light)', fontSize: '0.75rem' }}>TX: </span><code style={{ fontSize: '0.7rem' }}>{verificationResult.txHash.substring(0, 20)}...</code></p>}
              </div>

              {verificationResult.credentialChecks && Object.keys(verificationResult.credentialChecks).length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>CREDENTIAL CHECKS</p>
                  {verificationResult.credentialChecks.name && (
                    <div style={{ padding: '0.5rem', background: verificationResult.credentialChecks.name.matches ? '#e8f5e9' : '#ffebee', borderRadius: '4px', marginBottom: '0.5rem' }}>
                      {verificationResult.credentialChecks.name.matches ? '✅' : '❌'} Name: {verificationResult.credentialChecks.name.expected}
                    </div>
                  )}
                  {verificationResult.credentialChecks.citizenship && (
                    <div style={{ padding: '0.5rem', background: verificationResult.credentialChecks.citizenship.matches ? '#e8f5e9' : '#ffebee', borderRadius: '4px' }}>
                      {verificationResult.credentialChecks.citizenship.matches ? '✅' : '❌'} Citizenship: {verificationResult.credentialChecks.citizenship.expected}
                    </div>
                  )}
                </div>
              )}

              <button onClick={handleReset} className={styles.card} style={{ width: '100%', margin: 0 }}>
                <h2><span>🔄 Verify Another</span><span>→</span></h2>
                <p>Upload a new proof file</p>
              </button>
            </>
          )}
        </div>

        {history.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: '4px', border: '1px solid #2d2d2d', padding: '1.5rem', width: '100%', maxWidth: '600px', marginTop: '2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '1rem' }}>RECENT VERIFICATIONS</h3>
            {history.slice(0, 5).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: '#f5f5f5', borderRadius: '4px', marginBottom: '0.5rem' }}>
                <span>{item.status === 'verified' ? '✅' : '❌'} {item.proofType}</span>
                <span style={{ fontSize: '0.75rem', color: '#666' }}>{new Date(item.timestamp).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: '3rem', textAlign: 'center', fontFamily: 'var(--font-monument-light)', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
          🔒 Zero-knowledge proofs verify claims without exposing sensitive data.
        </div>
      </div>
    </GradientBG>
  );
}
