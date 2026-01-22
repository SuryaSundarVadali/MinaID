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
import { 
  validateProofValidity, 
  verifyProofCircuit,
  recordProofUsage 
} from '../lib/ProofValidation';

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
 * Fetch transaction details from Blockberry after successful inclusion
 */
async function getTransactionFromExplorer(txHash: string): Promise<{
  blockHeight?: number;
  confirmed: boolean;
  explorerUrl: string;
  indexedByExplorer?: boolean;
} | null> {
  try {
    console.log('[VerifierDashboard] Fetching transaction from Minascan...');
    
    const GRAPHQL_ENDPOINT = 'https://api.minascan.io/node/devnet/v1/graphql';
    
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
                    index
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
    
    if (result.errors) {
      console.warn('[getTransactionFromExplorer] GraphQL errors:', result.errors);
      return {
        confirmed: false,
        explorerUrl: `https://minascan.io/devnet/tx/${txHash}?type=zk-tx`,
      };
    }
    
    const blocks = result.data?.bestChain || [];
    
    for (const block of blocks) {
      const zkappCommands = block.transactions?.zkappCommands || [];
      const tx = zkappCommands.find((cmd: any) => cmd.hash === txHash);
      
      if (tx) {
        const blockHeight = parseInt(block.protocolState?.consensusState?.blockHeight || '0');
        
        if (tx.failureReason) {
          return {
            blockHeight,
            confirmed: false,
            indexedByExplorer: true,
            explorerUrl: `https://minascan.io/devnet/tx/${txHash}?type=zk-tx`,
          };
        }
        
        return {
          blockHeight,
          confirmed: true,
          indexedByExplorer: true,
          explorerUrl: `https://minascan.io/devnet/tx/${txHash}?type=zk-tx`,
        };
      }
    }
    
    // Transaction not found
    return {
      confirmed: false,
      indexedByExplorer: false,
      explorerUrl: `https://minascan.io/devnet/tx/${txHash}?type=zk-tx`,
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
  
  // IPFS state
  const [uploadMode, setUploadMode] = useState<'file' | 'ipfs'>('file');
  const [ipfsCID, setIpfsCID] = useState('');
  const [isLoadingFromIPFS, setIsLoadingFromIPFS] = useState(false);
  
  // On-chain verification state
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [verificationStatus, setVerificationStatus] = useState('');
  const [txHash, setTxHash] = useState<string>('');
  const [txStatus, setTxStatus] = useState<TxStatus>('unknown');
  const [useOnChain, setUseOnChain] = useState(true);
  
  // Two-step verification states
  const [clientSideVerified, setClientSideVerified] = useState(false);
  const [circuitValidation, setCircuitValidation] = useState<any>(null);
  const [proofValidityCheck, setProofValidityCheck] = useState<any>(null);
  const [canSubmitOnChain, setCanSubmitOnChain] = useState(false);

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

  const handleLoadFromIPFS = async () => {
    if (!ipfsCID.trim()) {
      setError('Please enter a CID');
      return;
    }

    setIsLoadingFromIPFS(true);
    setError('');
    setVerificationResult(null);

    try {
      const { getIPFSService } = await import('../lib/IPFSService');
      const { generatePassphrase } = await import('../lib/IPFSCrypto');
      
      const ipfsService = getIPFSService();
      
      // Prompt for wallet address (should be shared with CID)
      const walletAddress = prompt(
        'Enter the wallet address that uploaded this proof:\n\n' +
        '⚠️ This must be the EXACT wallet address used during encryption.\n' +
        'The proof owner should have shared this with the CID.'
      );
      
      if (!walletAddress) {
        throw new Error('Wallet address is required to decrypt the proof');
      }

      // Validate wallet address format (basic check)
      const trimmedAddress = walletAddress.trim();
      if (trimmedAddress.length < 10) {
        throw new Error('Invalid wallet address format. Please enter a valid Mina wallet address.');
      }
      
      console.log('[VerifierDashboard] Attempting to decrypt with wallet:', trimmedAddress.substring(0, 10) + '...');
      
      const passphrase = generatePassphrase(trimmedAddress, 'minaid-proof');
      
      const result = await ipfsService.downloadDecrypted(ipfsCID.trim(), passphrase);
      
      if (!result.data) {
        throw new Error('No data received from IPFS');
      }

      setProofData(result.data);
      setProofFile(null); // Clear file since we loaded from IPFS
      
      alert(`✅ Proof loaded from IPFS successfully!\n\nYou can now verify this proof.`);
      
    } catch (error: any) {
      console.error('[VerifierDashboard] IPFS load failed:', error);
      
      // Provide user-friendly error messages
      let errorMessage = error.message;
      
      if (errorMessage.includes('Wrong wallet address') || errorMessage.includes('Malformed UTF-8')) {
        errorMessage = 
          '❌ Decryption Failed\n\n' +
          'The wallet address you entered does not match the one used to encrypt this proof.\n\n' +
          'Please verify:\n' +
          '• You have the correct wallet address from the proof owner\n' +
          '• The wallet address is copied exactly (no extra spaces)\n' +
          '• The CID is correct';
      } else if (errorMessage.includes('IPFS_DESKTOP_UPLOAD')) {
        errorMessage = 
          '❌ Incompatible Data Format\n\n' +
          'This data was not encrypted with MinaID\'s format.\n\n' +
          'Please use the "Import from IPFS Desktop" option if this was uploaded via IPFS Desktop.';
      } else if (errorMessage.includes('HTTP')) {
        errorMessage = 
          '❌ IPFS Gateway Error\n\n' +
          'Unable to fetch data from IPFS.\n\n' +
          'Please verify:\n' +
          '• The CID is correct\n' +
          '• You have internet connectivity\n' +
          '• The IPFS gateway is accessible';
      }
      
      setError(errorMessage);
      alert(errorMessage);
    } finally {
      setIsLoadingFromIPFS(false);
    }
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

    // Step 1: Client-side verification first
    await handleClientSideVerification();
  };

  /**
   * Step 1: Client-side verification
   * Validates proof without blockchain interaction
   */
  const handleClientSideVerification = async () => {
    setIsVerifying(true);
    setError('');
    setVerificationProgress(0);
    setVerificationStatus('Starting client-side verification...');
    setClientSideVerified(false);
    setCanSubmitOnChain(false);

    try {
      // Import validation utilities
      const { validateProofValidity, verifyProofCircuit } = await import('../lib/ProofValidation');
      
      // Step 1.1: Validate proof structure and expiry
      setVerificationStatus('Checking proof validity and expiry...');
      setVerificationProgress(10);
      
      const validityCheck = validateProofValidity(proofData);
      setProofValidityCheck(validityCheck);
      
      if (!validityCheck.canUse) {
        setError(validityCheck.errors.join('; '));
        setIsVerifying(false);
        return;
      }
      
      if (validityCheck.warnings.length > 0) {
        console.warn('[Verify] Warnings:', validityCheck.warnings);
      }

      const rateLimitKey = 'proof_verification:verifier';
      if (!rateLimiter.isAllowed(rateLimitKey, RateLimitConfigs.PROOF_VERIFICATION)) {
        const timeRemaining = rateLimiter.getTimeUntilUnblocked(rateLimitKey);
        setError(`Rate limit exceeded. Try again in ${formatRLTime(timeRemaining)}.`);
        setIsVerifying(false);
        return;
      }

      const validation = validateProofData(proofData);
      if (!validation.valid) {
        throw new Error(`Invalid proof: ${validation.error}`);
      }

      const proofId = proofData.metadata?.proofId || proofData.id || 'unknown';
      const proofType = proofData.proofType || proofData.type || 'unknown';
      const subjectDID = proofData.did || proofData.subjectDID || 'unknown';
      
      // Step 1.2: Verify circuit constraints
      setVerificationStatus('Verifying circuit constraints...');
      setVerificationProgress(30);
      
      const expectedData: any = {};
      if (proofType === 'citizenship' && expectedCitizenship.trim()) {
        expectedData.citizenship = expectedCitizenship.trim();
      }
      if (proofType === 'name' && expectedName.trim()) {
        expectedData.name = expectedName.trim();
      }
      if (proofType.includes('age')) {
        const minAge = parseInt(proofData.publicInput?.minimumAge || '18');
        expectedData.minimumAge = minAge;
      }
      
      const circuitResult = await verifyProofCircuit(proofData, expectedData);
      setCircuitValidation(circuitResult);
      
      if (!circuitResult.satisfiesCircuit) {
        setError(`Circuit verification failed: ${circuitResult.details}`);
        setIsVerifying(false);
        return;
      }

      setVerificationProgress(50);
      setVerificationStatus('Performing cryptographic verification...');

      // ========== CLIENT-SIDE CRYPTOGRAPHIC VERIFICATION ==========
      
      // Extract selective disclosure data and other proof components
      const selectiveDisclosure = proofData.selectiveDisclosure;
      const parsedProof = proofData.proof;
      const userPublicKey = proofData.publicKey ? PublicKey.fromBase58(proofData.publicKey) : null;
      let cryptoVerified = false;
      const credentialChecks: any = {};
      
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

      setVerificationProgress(70);

      // Client-side verification complete
      if (cryptoVerified) {
        console.log('[Verify] ✅ Client-side verification PASSED');
        setClientSideVerified(true);
        setCanSubmitOnChain(true);
        setVerificationProgress(100);
        setVerificationStatus('Client-side verification complete! Ready for on-chain submission.');
        
        // Show success message
        alert(
          '✅ Client-Side Verification Complete!\n\n' +
          `Proof Type: ${proofType}\n` +
          `Circuit Validated: ${circuitResult.satisfiesCircuit ? '✅' : '❌'}\n` +
          `Cryptography Verified: ✅\n` +
          (validityCheck.metadata?.daysUntilExpiry ? `Days Until Expiry: ${validityCheck.metadata.daysUntilExpiry}\n` : '') +
          (validityCheck.metadata?.remainingUses ? `Remaining Uses: ${validityCheck.metadata.remainingUses}\n` : '') +
          '\nYou can now submit this proof for on-chain verification.'
        );
      } else {
        setError('Cryptographic verification failed');
      }
      
      logSecurityEvent('proof_client_verified', { 
        proofId, 
        proofType,
        circuitSatisfied: circuitResult.satisfiesCircuit,
        cryptoVerified 
      }, 'info');
      
    } catch (err: any) {
      setError(err.message || 'Client-side verification failed');
      setVerificationStatus('Error: ' + (err.message || 'Verification failed'));
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * Step 2: On-chain verification submission
   * Only callable after client-side verification passes
   */
  const handleOnChainSubmission = async () => {
    if (!proofData || !clientSideVerified) {
      setError('Please complete client-side verification first');
      return;
    }

    setIsVerifying(true);
    setError('');
    setVerificationProgress(0);
    setVerificationStatus('Preparing on-chain transaction...');
    setTxHash('');
    setTxStatus('unknown');

    try {
      const proofId = proofData.metadata?.proofId || proofData.id || 'unknown';
      const proofType = proofData.proofType || proofData.type || 'unknown';
      const subjectDID = proofData.did || proofData.subjectDID || 'unknown';

      // ========== ON-CHAIN VERIFICATION ==========
      let onChainVerified = false;
      let transactionHash = '';
      let verificationMethod: 'on-chain' | 'client-side' = 'on-chain';
      let explorerBlockHeight: number | undefined;
      let explorerConfirmations: number | undefined;
      let explorerUrl: string | undefined;

      const walletStatus = canSubmit();
      
      if (!walletStatus.ready) {
        throw new Error(walletStatus.reason || 'Wallet not ready');
      }
      
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
              setVerificationProgress(10 + (attempt / max) * 30);
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

        console.log('[Verify] Submission result:', submissionResult);

        if (submissionResult.success && submissionResult.transactionHash) {
          transactionHash = submissionResult.transactionHash;
          setTxHash(transactionHash);
          setVerificationProgress(50);
          setVerificationStatus('Monitoring transaction...');
          
          // Monitor the transaction using Blockberry
          const monitorResult = await monitorTransaction(
            transactionHash,
            {
              onStatusChange: (status, message) => {
                setTxStatus(status);
                setVerificationStatus(message);
              },
              onProgress: (elapsed, maxWait) => {
                const progress = 50 + (elapsed / maxWait) * 40;
                setVerificationProgress(Math.min(progress, 90));
              },
            },
            {
              maxWaitTime: 30 * 60 * 1000, // 30 minutes
              requiredConfirmations: 1,
            }
          );

          if (monitorResult.status === 'confirmed' || monitorResult.status === 'included') {
            onChainVerified = true;
            verificationMethod = 'on-chain';
            
            // Fetch transaction details from Blockberry
            setVerificationProgress(95);
            setVerificationStatus('Fetching transaction details from Blockberry...');
            const explorerData = await getTransactionFromExplorer(transactionHash);
            
            if (explorerData && explorerData.confirmed) {
              console.log('[Verify] Transaction confirmed on Blockberry:', explorerData);
              
              explorerBlockHeight = explorerData.blockHeight;
              explorerConfirmations = monitorResult.confirmations;
              explorerUrl = explorerData.explorerUrl;
              
              setVerificationStatus(
                `✅ Verified on blockchain! Block: ${explorerData.blockHeight || 'pending'}, Confirmations: ${monitorResult.confirmations}`
              );
              
              // Record proof usage
              const updatedProof = recordProofUsage(proofData);
              console.log('[Verify] Proof usage recorded:', updatedProof.metadata.usageCount);
            } else {
              explorerUrl = `https://minascan.io/devnet/tx/${transactionHash}?type=zk-tx`;
              setVerificationStatus('✅ On-chain verification confirmed!');
            }
          } else {
            throw new Error('Transaction monitoring failed or timeout');
          }
        } else {
          const errorMsg = submissionResult.error || 'Unknown submission error';
          console.error('[Verify] Transaction submission failed:', {
            success: submissionResult.success,
            transactionHash: submissionResult.transactionHash,
            error: submissionResult.error,
            status: submissionResult.status,
            fullResult: submissionResult
          });
          throw new Error(`Transaction submission failed: ${errorMsg}`);
        }
      } catch (onChainError: any) {
        console.error('[Verify] On-chain verification error:', onChainError);
        setError(`On-chain verification failed: ${onChainError.message}`);
      }

      setVerificationProgress(100);

      // Create verification result
      const result = { 
        id: `v_${Date.now()}`, 
        proofId, 
        proofType, 
        subjectDID, 
        status: onChainVerified ? 'verified' as const : 'failed' as const, 
        timestamp: Date.now(), 
        credentialChecks: {},
        cryptoVerified: true,
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
      setVerificationStatus(onChainVerified ? 'On-chain verification complete!' : 'On-chain verification failed');
      
      if (onChainVerified) {
        alert(
          '✅ On-Chain Verification Complete!\n\n' +
          `Transaction: ${transactionHash}\n` +
          `Block Height: ${explorerBlockHeight || 'pending'}\n` +
          `Confirmations: ${explorerConfirmations || 0}\n\n` +
          'View transaction on explorer for details.'
        );
      }
      
      logSecurityEvent('proof_onchain_verified', { 
        proofId, 
        status: result.status, 
        onChainVerified, 
        txHash: transactionHash 
      }, 'info');
      
    } catch (err: any) {
      setError(err.message || 'On-chain submission failed');
      setVerificationStatus('Error: ' + (err.message || 'Submission failed'));
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
    setClientSideVerified(false);
    setCanSubmitOnChain(false);
    setCircuitValidation(null);
    setProofValidityCheck(null);
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
              {/* Upload Mode Selector */}
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f5f5f5', padding: '0.5rem', borderRadius: '8px' }}>
                  <button
                    onClick={() => setUploadMode('file')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: uploadMode === 'file' ? 'white' : 'transparent',
                      boxShadow: uploadMode === 'file' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-monument)',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    📁 From Device
                  </button>
                  <button
                    onClick={() => setUploadMode('ipfs')}
                    style={{
                      flex: 1,
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '6px',
                      background: uploadMode === 'ipfs' ? 'white' : 'transparent',
                      boxShadow: uploadMode === 'ipfs' ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-monument)',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    ☁️ From IPFS
                  </button>
                </div>
              </div>

              {/* File Upload Mode */}
              {uploadMode === 'file' && (
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
              )}

              {/* IPFS Load Mode */}
              {uploadMode === 'ipfs' && (
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '0.5rem', display: 'block' }}>LOAD FROM IPFS</label>
                  <div style={{ background: '#f0f9ff', border: '1px solid #bfdbfe', borderRadius: '4px', padding: '1rem', marginBottom: '1rem' }}>
                    <p style={{ fontSize: '0.875rem', color: '#1e40af' }}>
                      Enter the IPFS CID shared by the proof generator. You'll need their wallet address to decrypt the proof.
                    </p>
                  </div>
                  <input
                    type="text"
                    value={ipfsCID}
                    onChange={(e) => setIpfsCID(e.target.value)}
                    placeholder="QmXxx..."
                    style={{ 
                      width: '100%', 
                      padding: '0.75rem', 
                      border: '1px solid #ccc', 
                      borderRadius: '4px', 
                      marginBottom: '0.5rem',
                      fontFamily: 'monospace'
                    }}
                  />
                  <button
                    onClick={handleLoadFromIPFS}
                    disabled={!ipfsCID.trim() || isLoadingFromIPFS}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      border: 'none',
                      borderRadius: '4px',
                      background: (!ipfsCID.trim() || isLoadingFromIPFS) ? '#ccc' : '#3b82f6',
                      color: 'white',
                      cursor: (!ipfsCID.trim() || isLoadingFromIPFS) ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-monument)',
                      fontSize: '0.875rem',
                      transition: 'all 0.2s'
                    }}
                  >
                    {isLoadingFromIPFS ? '⏳ Loading from IPFS...' : '📥 Load Proof from IPFS'}
                  </button>
                </div>
              )}

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

              {/* Display proof validity information */}
              {proofData && proofValidityCheck && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: proofValidityCheck.isValid ? '#E8F5E9' : '#FFEBEE', borderRadius: '8px', border: `1px solid ${proofValidityCheck.isValid ? '#81C784' : '#EF5350'}` }}>
                  <p style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', color: proofValidityCheck.isValid ? '#2E7D32' : '#C62828', marginBottom: '0.5rem' }}>
                    {proofValidityCheck.isValid ? '✅ Proof Valid' : '❌ Proof Invalid'}
                  </p>
                  {!proofValidityCheck.isValid && proofValidityCheck.errors && proofValidityCheck.errors.length > 0 && (
                    <ul style={{ fontSize: '0.75rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                      {proofValidityCheck.errors.map((err: string, idx: number) => (
                        <li key={idx} style={{ color: '#C62828' }}>{err}</li>
                      ))}
                    </ul>
                  )}
                  {proofData.metadata?.validFrom && (
                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                      Valid from: {new Date(proofData.metadata.validFrom).toLocaleString()}
                    </p>
                  )}
                  {proofData.metadata?.validUntil && (
                    <p style={{ fontSize: '0.75rem' }}>
                      Valid until: {new Date(proofData.metadata.validUntil).toLocaleString()}
                    </p>
                  )}
                  {proofData.metadata?.maxUses !== undefined && (
                    <p style={{ fontSize: '0.75rem' }}>
                      Usage: {proofData.metadata.usageCount || 0} / {proofData.metadata.maxUses === 0 ? '∞' : proofData.metadata.maxUses}
                    </p>
                  )}
                </div>
              )}

              {/* Display circuit validation results */}
              {circuitValidation && (
                <div style={{ marginBottom: '1rem', padding: '1rem', background: circuitValidation.satisfiesCircuit ? '#E8F5E9' : '#FFEBEE', borderRadius: '8px', border: `1px solid ${circuitValidation.satisfiesCircuit ? '#81C784' : '#EF5350'}` }}>
                  <p style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', color: circuitValidation.satisfiesCircuit ? '#2E7D32' : '#C62828', marginBottom: '0.5rem' }}>
                    {circuitValidation.satisfiesCircuit ? '✅ Circuit Constraints Verified' : '❌ Circuit Validation Failed'}
                  </p>
                  <p style={{ fontSize: '0.75rem', marginTop: '0.5rem' }}>
                    {circuitValidation.details}
                  </p>
                  {circuitValidation.checks && Object.keys(circuitValidation.checks).length > 0 && (
                    <ul style={{ fontSize: '0.75rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                      {Object.entries(circuitValidation.checks).map(([key, value]) => (
                        <li key={key} style={{ color: value ? '#2E7D32' : '#C62828' }}>
                          {value ? '✅' : '❌'} {key}: {String(value)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Two-step verification buttons */}
              {!clientSideVerified ? (
                <button 
                  onClick={handleClientSideVerification} 
                  disabled={!proofData || isVerifying} 
                  className={styles.card} 
                  style={{ width: '100%', margin: 0, marginBottom: '1rem', opacity: (!proofData || isVerifying) ? 0.5 : 1 }}
                >
                  <h2><span>{isVerifying ? '⏳ Verifying...' : '🔍 Step 1: Verify Circuit Constraints'}</span><span>→</span></h2>
                  <p>Validate proof satisfies circuit requirements (age, citizenship, etc.)</p>
                </button>
              ) : (
                <>
                  <div style={{ marginBottom: '1rem', padding: '1rem', background: '#E8F5E9', borderRadius: '8px', border: '1px solid #81C784' }}>
                    <p style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', color: '#2E7D32' }}>
                      ✅ Client-side validation complete
                    </p>
                    <p style={{ fontSize: '0.75rem', marginTop: '0.5rem', color: '#2E7D32' }}>
                      Circuit constraints verified successfully
                    </p>
                  </div>
                  <button 
                    onClick={handleOnChainSubmission} 
                    disabled={!canSubmitOnChain || isVerifying} 
                    className={styles.card} 
                    style={{ width: '100%', margin: 0, opacity: (!canSubmitOnChain || isVerifying) ? 0.5 : 1 }}
                  >
                    <h2><span>{isVerifying ? '⏳ Submitting...' : '🔗 Step 2: Submit to Blockchain'}</span><span>→</span></h2>
                    <p>Submit verification transaction to Mina blockchain</p>
                  </button>
                </>
              )}
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
                    View on Blockberry Explorer →
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
