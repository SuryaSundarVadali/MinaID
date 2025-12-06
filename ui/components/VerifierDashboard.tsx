/**
 * VerifierDashboard.tsx
 * 
 * Simplified verifier dashboard with homepage-style UI
 * Allows uploading proof JSON files for verification
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWallet } from '../context/WalletContext';
import GradientBG from './GradientBG';
import heroMinaLogo from '../public/assets/hero-mina-logo.svg';
import styles from '../styles/Home.module.css';
import { rateLimiter, RateLimitConfigs, formatTimeRemaining } from '../lib/RateLimiter';
import { validateProofData, containsSuspiciousPatterns } from '../lib/InputValidator';
import { logSecurityEvent } from '../lib/SecurityUtils';
import { getContractInterface } from '../lib/ContractInterface';

export type VerificationResult = {
  id: string;
  proofId: string;
  requestId?: string;
  status: 'verified' | 'failed' | 'invalid';
  timestamp: number;
  proofType: string;
  subjectDID?: string;
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
      setError(`Rate limit exceeded. Try again in ${formatTimeRemaining(timeRemaining)}.`);
      return;
    }

    setIsVerifying(true);
    setError('');

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

      let credentialChecks: any = {};
      const selectiveDisclosure = proofData.selectiveDisclosure;
      
      if (selectiveDisclosure?.salt) {
        const { verifySelectiveDisclosureProof, verifyCitizenshipZKProof } = await import('../lib/ProofGenerator');
        const { PublicKey } = await import('o1js');
        
        let userPublicKey: any = null;
        try {
          const parsedProof = typeof proofData.proof === 'string' ? JSON.parse(proofData.proof) : proofData.proof;
          if (parsedProof?.publicKey) {
            userPublicKey = PublicKey.fromBase58(parsedProof.publicKey);
          } else {
            userPublicKey = PublicKey.fromBase58(subjectDID.replace('did:mina:', ''));
          }
        } catch {}

        if (expectedName.trim() && selectiveDisclosure.name && userPublicKey) {
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

        if (expectedCitizenship.trim() && selectiveDisclosure.citizenship && userPublicKey) {
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

      let txHash = '';
      let status: 'verified' | 'failed' = 'verified';

      try {
        const contractInterface = await getContractInterface();
        const txResult = await contractInterface.verifyProofOnChain(proofData, 'EKEpKAJmk5UqjTVbXgWHoyWWTAx7PWbuxnd8gLh4kkNX7ESTdWFY');
        if (txResult.success) txHash = txResult.hash;
        else status = 'failed';
      } catch {
        status = 'failed';
      }

      const credentialFailed = Object.values(credentialChecks).some((c: any) => !c.matches);
      if (credentialFailed) status = 'failed';

      const result = { id: `v_${Date.now()}`, proofId, proofType, subjectDID, status, timestamp: Date.now(), credentialChecks, txHash };
      const newHistory = [result, ...history].slice(0, 20);
      localStorage.setItem('minaid_verification_history', JSON.stringify(newHistory));
      setHistory(newHistory);
      setVerificationResult(result);
      logSecurityEvent('proof_verified', { proofId, status }, 'info');
    } catch (err: any) {
      setError(err.message || 'Verification failed');
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
