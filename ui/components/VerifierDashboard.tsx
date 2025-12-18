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
import { Field, PublicKey, Signature, Poseidon } from 'o1js';
import { 
  generateAttributeCommitment, 
  verifySelectiveDisclosureProof, 
  verifyCitizenshipZKProof 
} from '../lib/ProofGenerator';

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
  blockHeight?: number;
  confirmations?: number;
  explorerUrl?: string;
};

/**
 * Fetch transaction details from MinaExplorer after successful inclusion
 */
async function getTransactionFromExplorer(txHash: string): Promise<{
  blockHeight?: number;
  confirmed: boolean;
  explorerUrl: string;
  indexedByExplorer?: boolean;
} | null> {
  try {
    // Use Minascan GraphQL endpoint for queries
    const GRAPHQL_ENDPOINT = 'https://api.minascan.io/node/devnet/v1/graphql';
    // Use MinaExplorer for UI links
    const EXPLORER_BASE_URL = 'https://devnet.minaexplorer.com';
    
    // Query bestChain to find the transaction
    const response = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query GetTransaction($hash: String!) {
            bestChain(maxLength: 290) {
              protocolState {
                consensusState {
                  blockHeight
                }
              }
              transactions {
                zkappCommands {
                  hash
                  failureReason {
                    failures
                  }
                }
              }
            }
          }
        `,
        variables: { hash: txHash },
      }),
    });

    const result = await response.json();
    const blocks = result.data?.bestChain || [];

    // Search for our transaction
    for (const block of blocks) {
      const zkappCommands = block.transactions?.zkappCommands || [];
      const tx = zkappCommands.find((cmd: any) => cmd.hash === txHash);
      
      if (tx && !tx.failureReason) {
        const blockHeight = parseInt(block.protocolState?.consensusState?.blockHeight || '0');
        
        // Transaction found on blockchain and visible via GraphQL
        return {
          blockHeight,
          confirmed: true,
          indexedByExplorer: true, // If GraphQL returns it, it's indexed
          explorerUrl: `${EXPLORER_BASE_URL}/transaction/${txHash}`,
        };
      }
    }

    // If not found but transaction was successful, return minimal info
    return {
      confirmed: false,
      indexedByExplorer: false,
      explorerUrl: `${EXPLORER_BASE_URL}/transaction/${txHash}`,
    };
  } catch (error) {
    console.warn('[getTransactionFromExplorer] Error:', error);
    return null;
  }
}

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

      // Use static imports instead of dynamic ones
      // const { PublicKey, Signature, Field } = await import('o1js');
      // const { verifySelectiveDisclosureProof, verifyCitizenshipZKProof, generateAttributeCommitment } = await import('../lib/ProofGenerator');

      let credentialChecks: any = {};
      let cryptoVerified = false;
      const selectiveDisclosure = proofData.selectiveDisclosure;
      
      // Parse the proof data
      let parsedProof: any = {};
      try {
        console.log('[Verify] Raw proof data type:', typeof proofData.proof);
        parsedProof = typeof proofData.proof === 'string' ? JSON.parse(proofData.proof) : proofData.proof;
        console.log('[Verify] Parsed proof keys:', Object.keys(parsedProof));
      } catch (e) {
        console.error('[Verify] Failed to parse proof JSON:', e);
      }

      // Get public key from proof
      let userPublicKey: any = null;
      try {
        if (parsedProof?.publicKey) {
          console.log('[Verify] Using public key from proof:', parsedProof.publicKey);
          userPublicKey = PublicKey.fromBase58(parsedProof.publicKey);
        } else {
          console.log('[Verify] Using public key from DID:', subjectDID);
          userPublicKey = PublicKey.fromBase58(subjectDID.replace('did:mina:', ''));
        }
      } catch (e) {
        console.warn('Failed to parse public key:', e);
      }

      setVerificationProgress(20);
      setVerificationStatus('Verifying signature...');

      // ========== CLIENT-SIDE CRYPTOGRAPHIC VERIFICATION ==========
      
      // 1. Check for ZK Proofs (Citizenship/Name) - Verify Hash Commitment
      if ((proofType === 'citizenship' || proofType === 'name') && proofData.publicInput && selectiveDisclosure?.salt) {
        try {
          const publicHash = proofData.publicInput.citizenshipHash || proofData.publicInput.nameHash;
          const input = proofType === 'citizenship' ? expectedCitizenship : expectedName;
          
          if (publicHash && input) {
            console.log(`[Verify] Verifying ${proofType} hash commitment...`);
            const calculatedCommitment = generateAttributeCommitment(input, selectiveDisclosure.salt);
            
            if (calculatedCommitment.toString() === publicHash) {
              console.log(`[Verify] ${proofType} hash verified successfully!`);
              cryptoVerified = true;
              
              // Set credential check result
              if (proofType === 'citizenship') {
                credentialChecks.citizenship = { expected: input, matches: true };
              } else {
                credentialChecks.name = { expected: input, matches: true };
              }
            } else {
              console.warn(`[Verify] ${proofType} hash mismatch!`);
              console.warn(`Expected: ${publicHash}`);
              console.warn(`Calculated: ${calculatedCommitment.toString()}`);
            }
          }
        } catch (err) {
          console.error('[Verify] ZK hash verification failed:', err);
        }
      }

      // 1.5 Check for Age Proofs - Verify Hash Commitment (True ZK)
      if ((proofType.startsWith('age') || proofType === 'age18' || proofType === 'age21') && proofData.publicInput && proofData.publicOutput) {
        try {
          console.log('[Verify] Verifying Age Proof commitment...');
          const { publicInput, publicOutput } = proofData;
          
          // Extract fields
          const ageHash = Field(publicInput.ageHash || publicInput.kycHash || '0');
          const minAge = Field(publicInput.minimumAge || '18');
          const subject = PublicKey.fromBase58(publicInput.subjectPublicKey);
          const issuer = PublicKey.fromBase58(publicInput.issuerPublicKey);
          const timestamp = Field(publicInput.timestamp || 0);
          
          // Reconstruct commitment
          // Must match ZKPVerifier.verifyAgeProof logic
          const expectedCommitment = Poseidon.hash([
            ageHash,
            minAge,
            ...subject.toFields(),
            ...issuer.toFields(),
            timestamp,
          ]);
          
          const actualCommitment = Field(publicOutput);
          
          console.log('[Verify] Expected Commitment:', expectedCommitment.toString());
          console.log('[Verify] Actual Commitment:  ', actualCommitment.toString());
          
          if (expectedCommitment.equals(actualCommitment).toBoolean()) {
            console.log('[Verify] Age Proof commitment verified successfully!');
            cryptoVerified = true;
          } else {
            console.warn('[Verify] Age Proof commitment mismatch!');
          }
        } catch (err) {
          console.error('[Verify] Age Proof verification failed:', err);
        }
      }

      // 1.6 Check for KYC Proofs - Verify Hash Commitment
      if (proofType === 'kyc' && proofData.publicInput && proofData.publicOutput) {
        try {
          console.log('[Verify] Verifying KYC Proof commitment...');
          const { publicInput, publicOutput } = proofData;
          
          // Extract fields
          const kycHash = Field(publicInput.kycHash || '0');
          const subject = PublicKey.fromBase58(publicInput.subjectPublicKey);
          const issuer = PublicKey.fromBase58(publicInput.issuerPublicKey);
          
          // Reconstruct commitment
          // Must match ZKPVerifier.verifyKYCProof logic
          const expectedCommitment = Poseidon.hash([
            kycHash,
            ...subject.toFields(),
            ...issuer.toFields(),
            Field(1),
          ]);
          
          const actualCommitment = Field(publicOutput);
          
          console.log('[Verify] Expected Commitment:', expectedCommitment.toString());
          console.log('[Verify] Actual Commitment:  ', actualCommitment.toString());
          
          if (expectedCommitment.equals(actualCommitment).toBoolean()) {
            console.log('[Verify] KYC Proof commitment verified successfully!');
            cryptoVerified = true;
            credentialChecks.kyc = { expected: "Verified Identity", matches: true };
          } else {
            console.warn('[Verify] KYC Proof commitment mismatch!');
          }
        } catch (err) {
          console.error('[Verify] KYC Proof verification failed:', err);
        }
      }
      
      // 2. Fallback to Legacy Signature Verification (if not already verified)
      if (!cryptoVerified) {
        console.log('[Verify] Attempting signature verification...');
        if (parsedProof?.signature && parsedProof?.commitment && userPublicKey) {
          try {
            console.log('[Verify] Verifying signature...');
            console.log('[Verify] Public Key:', userPublicKey.toBase58());
            console.log('[Verify] Commitment:', parsedProof.commitment);
            console.log('[Verify] Signature:', parsedProof.signature);
            
            const signature = Signature.fromBase58(parsedProof.signature);
            const commitment = Field(parsedProof.commitment);
            const isValidSignature = signature.verify(userPublicKey, [commitment]);
            cryptoVerified = isValidSignature.toBoolean();
            console.log('[Verify] Signature verification result:', cryptoVerified);
          } catch (sigError) {
            console.error('[Verify] Signature verification failed with error:', sigError);
            cryptoVerified = false;
          }
        } else {
          console.warn('[Verify] Skipping signature verification. Missing data:', {
            hasSignature: !!parsedProof?.signature,
            hasCommitment: !!parsedProof?.commitment,
            hasPublicKey: !!userPublicKey
          });
        }
      }

      setVerificationProgress(40);
      
      // Verify selective disclosure proofs if present (Legacy support)
      if (!cryptoVerified && selectiveDisclosure?.salt && userPublicKey) {
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
      let explorerBlockHeight: number | undefined;
      let explorerConfirmations: number | undefined;
      let explorerUrl: string | undefined;

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
                // Build verification transaction using ContractInterface
                const contractInterface = await getContractInterface();
                
                // Get wallet account
                const accounts = await (window as any).mina.requestAccounts();
                if (!accounts || accounts.length === 0) {
                  throw new Error('Please connect your wallet');
                }
                const verifierAddress = accounts[0];
                
                // Determine expected data override
                let expectedData = undefined;
                if (proofType === 'citizenship' && expectedCitizenship.trim()) {
                  expectedData = expectedCitizenship.trim();
                } else if (proofType === 'name' && expectedName.trim()) {
                  expectedData = expectedName.trim();
                }

                const tx = await contractInterface.buildVerificationTransaction(
                  proofData,
                  verifierAddress,
                  expectedData
                );
                
                // Prove and return JSON
                await tx.prove();
                return tx.toJSON();
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
              transactionHash = submissionResult.transactionHash;
              setTxHash(transactionHash);
              setVerificationProgress(80);
              setVerificationStatus('Monitoring transaction...');
              
              // Monitor the transaction (wait indefinitely for blockchain confirmation)
              const monitorResult = await monitorTransaction(
                transactionHash,
                {
                  onStatusChange: (status, message) => {
                    setTxStatus(status);
                    setVerificationStatus(message);
                  },
                  onProgress: (elapsed, maxWait) => {
                    const progress = 80 + (elapsed / maxWait) * 15;
                    setVerificationProgress(Math.min(progress, 95));
                  },
                },
                {
                  maxWaitTime: 30 * 60 * 1000, // 30 minutes - extended timeout for blockchain confirmation
                  requiredConfirmations: 1,
                }
              );

              if (monitorResult.status === 'confirmed' || monitorResult.status === 'included') {
                onChainVerified = true;
                verificationMethod = 'on-chain';
                
                // Fetch transaction details from MinaExplorer
                setVerificationProgress(96);
                setVerificationStatus('Fetching transaction details from MinaExplorer...');
                const explorerData = await getTransactionFromExplorer(transactionHash);
                
                if (explorerData) {
                  console.log('[Verify] Transaction found on MinaExplorer:', explorerData);
                  
                  // Store explorer data in variables
                  explorerBlockHeight = explorerData.blockHeight;
                  explorerConfirmations = monitorResult.confirmations;
                  explorerUrl = explorerData.explorerUrl;
                  
                  // If GraphQL returned the transaction, it's confirmed and indexed
                  setVerificationStatus(
                    `✅ Verified on MinaExplorer! Block: ${explorerData.blockHeight || 'pending'}, Confirmations: ${monitorResult.confirmations}`
                  );
                } else {
                  explorerUrl = `https://devnet.minaexplorer.com/transaction/${transactionHash}`;
                  setVerificationStatus('✅ On-chain verification confirmed!');
                }
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
      
      // If on-chain verification was attempted, ONLY show verified if blockchain confirmed
      if (useOnChain && cryptoVerified) {
        if (onChainVerified) {
          status = 'verified';
        } else {
          // On-chain verification was attempted but not confirmed on blockchain
          status = 'failed';
        }
      } else {
        // Client-side verification only (when on-chain is disabled)
        if (cryptoVerified && !credentialFailed) {
          status = 'verified';
        } else if (hasCredentialChecks && !credentialFailed) {
          status = 'verified';
        }
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
        blockHeight: explorerBlockHeight,
        confirmations: explorerConfirmations,
        explorerUrl: explorerUrl,
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

              {verificationResult.verificationMethod === 'on-chain' && verificationResult.explorerUrl && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: '#EFF6FF', borderRadius: '8px', border: '1px solid #BFDBFE' }}>
                  <p style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', color: '#1E40AF', marginBottom: '0.75rem' }}>
                    🔗 On-Chain Verification
                  </p>
                  {verificationResult.blockHeight && (
                    <p style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#1E3A8A', marginBottom: '0.25rem' }}>
                      Block Height: <strong>{verificationResult.blockHeight}</strong>
                    </p>
                  )}
                  {verificationResult.confirmations !== undefined && (
                    <p style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#1E3A8A', marginBottom: '0.75rem' }}>
                      Confirmations: <strong>{verificationResult.confirmations}</strong>
                    </p>
                  )}
                  <a 
                    href={verificationResult.explorerUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    style={{ 
                      fontFamily: 'var(--font-monument)', 
                      fontSize: '0.75rem', 
                      color: '#2563EB',
                      textDecoration: 'underline',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem'
                    }}
                  >
                    View on MinaExplorer →
                  </a>
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
