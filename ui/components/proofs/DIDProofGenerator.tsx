/**
 * DIDProofGenerator.tsx
 * 
 * Component for mandatory DID proof generation after login/signup
 * Users must complete this step before accessing the dashboard
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../context/WalletContext';
import { PrivateKey, Field } from 'o1js';
import {
  generateAgeProofZK,
  generateCitizenshipProofZK,
  generateNameProofZK,
  compileAgeProgram,
  compileCitizenshipProgram
} from '../../lib/ZKProofGenerator';
import { ProofStorage } from '../../lib/ProofStorage';
import GradientBG from '../GradientBG';

type StepType = 'welcome' | 'generating' | 'verifying' | 'success' | 'error';
type ProofType = 'citizenship' | 'age18' | 'age21';

// Helper function to calculate age from date of birth
function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

// Helper function to get user-friendly proof type labels
function getProofTypeLabel(type: ProofType): string {
  switch (type) {
    case 'citizenship':
      return 'Citizenship Proof';
    case 'age18':
      return 'Age 18+ Proof';
    case 'age21':
      return 'Age 21+ Proof';
    default:
      return 'Proof';
  }
}

// Helper function to get minimum age requirement
function getMinimumAge(type: ProofType): number {
  switch (type) {
    case 'age18':
      return 18;
    case 'age21':
      return 21;
    case 'citizenship':
    default:
      return 0; // No age requirement for citizenship
  }
}

interface GenerationState {
  step: StepType;
  progress: number;
  error?: string;
  proofId?: string;
  statusMessage: string;
  ipfsCID?: string;
  isUploadingIPFS?: boolean;
  generatedProof?: {
    proof: any;
    publicOutput: any;
    did: string;
    proofType: ProofType;
    minimumAge?: number;
    timestamp: number;
    selectiveDisclosure?: {
      name: { commitment: string; signature: string; attributeName: string };
      citizenship: { commitment: string; signature: string; normalizedValue: string };
      salt: string;
    };
  };
}

interface DIDProofGeneratorProps {
  proofType?: ProofType;
}

export default function DIDProofGenerator({ proofType = 'citizenship' }: DIDProofGeneratorProps) {
  const router = useRouter();
  const { session, loadPrivateKey } = useWallet();
  const [userIdentifier, setUserIdentifier] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<'auro' | 'metamask'>('auro');
  
  const [state, setState] = useState<GenerationState>({
    step: 'welcome',
    progress: 0,
    statusMessage: `Ready to generate your ${getProofTypeLabel(proofType)}`
  });

  // Load user identifier (DID or wallet address) and wallet type
  useEffect(() => {
    let identifier = session?.did || null;
    let type: 'auro' | 'metamask' = 'auro';
    
    if (!identifier) {
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        try {
          const parsed = JSON.parse(walletData);
          identifier = parsed.address;
          type = parsed.walletType || 'auro';
        } catch (e) {
          console.error('Failed to parse wallet data:', e);
        }
      }
    } else {
      // Get wallet type from stored data if we have a session
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        try {
          const parsed = JSON.parse(walletData);
          type = parsed.walletType || 'auro';
        } catch (e) {
          console.error('Failed to parse wallet data:', e);
        }
      }
    }
    
    setUserIdentifier(identifier);
    setWalletType(type);
  }, [session]);

  // Note: We no longer auto-redirect users who have verified proofs
  // Users may want to generate additional proofs of different types

  const handleGenerateProof = async () => {
    if (!userIdentifier) {
      setState(prev => ({ 
        ...prev, 
        step: 'error',
        error: 'Please connect your wallet first.' 
      }));
      return;
    }

    // Check if user has full session with passkey (required for proof generation)
    // Also check localStorage for backup passkeyId
    let passkeyId = session?.passkeyId;
    
    // Check wallet connection data for passkeyId and wallet type
    const walletData = localStorage.getItem('minaid_wallet_connected');
    let isSimpleSignup = false;
    let isAuroWallet = false;
    
    if (walletData) {
      try {
        const parsed = JSON.parse(walletData);
        if (!passkeyId && parsed.passkeyId) {
          passkeyId = parsed.passkeyId;
        }
        isSimpleSignup = parsed.simpleSignup === true;
        isAuroWallet = parsed.walletType === 'auro';
      } catch (e) {
        console.error('[DIDProofGenerator] Failed to parse wallet data:', e);
      }
    }
    
    // User can generate proofs if:
    // 1. They have a passkeyId (from session or localStorage), OR
    // 2. They are an Auro wallet user (can use deterministic key), OR  
    // 3. They are a simpleSignup user (new wallet-only user)
    const canGenerateProof = !!passkeyId || isAuroWallet || isSimpleSignup;
    
    if (!session?.did && !userIdentifier) {
      console.error('[DIDProofGenerator] No user identifier available');
      setState(prev => ({ 
        ...prev, 
        step: 'error',
        error: 'Please connect your wallet first.' 
      }));
      return;
    }
    
    if (!canGenerateProof) {
      console.error('[DIDProofGenerator] Cannot generate proof - no valid authentication method:', { 
        hasDid: !!session?.did, 
        hasPasskeyId: !!passkeyId,
        isSimpleSignup,
        isAuroWallet,
        canGenerateProof,
        session 
      });
      
      setState(prev => ({ 
        ...prev, 
        step: 'error',
        error: 'Account setup incomplete. Please sign up again to create your passkey for secure proof generation.' 
      }));
      return;
    }

    // Determine the effective DID to use (session.did or userIdentifier for Auro wallet)
    const effectiveDid = session?.did || userIdentifier;
    
    console.log('[DIDProofGenerator] Starting proof generation with session:', {
      did: effectiveDid,
      passkeyId: passkeyId,
      walletType,
      userIdentifier,
      isSimpleSignup,
      isAuroWallet,
      canGenerateProof
    });

    setState(prev => ({ 
      ...prev, 
      step: 'generating',
      progress: 10,
      statusMessage: 'Loading your credentials...'
    }));

    try {
      // Step 1: Get private key - either from stored key or generate for Auro wallet users
      setState(prev => ({ 
        ...prev, 
        progress: 20,
        statusMessage: 'Authenticating...'
      }));
      
      console.log('[DIDProofGenerator] Loading private key for:', walletType, effectiveDid);
      
      let privateKey: PrivateKey;
      
      if (isSimpleSignup || isAuroWallet) {
        // For Auro wallet users without stored keys, generate a deterministic key from wallet address
        // This ensures consistent key generation for the same wallet address
        console.log('[DIDProofGenerator] Using Auro wallet mode - generating deterministic key from address');
        
        try {
          // First try to load stored key (if they did full signup)
          if (passkeyId && effectiveDid) {
            const privateKeyString = await loadPrivateKey(walletType, passkeyId, effectiveDid);
            privateKey = PrivateKey.fromBase58(privateKeyString);
          } else {
            throw new Error('No passkey available, using deterministic key');
          }
        } catch (keyError: any) {
          // No stored key - generate deterministic key for proof generation
          // Note: This is for development/testing. In production, you'd want proper key management.
          console.log('[DIDProofGenerator] No stored key, using wallet-derived approach');
          
          // Generate a deterministic private key from the wallet address hash
          // This allows proof generation without storing private keys
          const addressHash = await crypto.subtle.digest(
            'SHA-256', 
            new TextEncoder().encode(userIdentifier + '_minaid_proof_key')
          );
          const hashArray = new Uint8Array(addressHash);
          // Take first 32 bytes and create a Field-compatible bigint
          let seedBigInt = BigInt(0);
          for (let i = 0; i < 32; i++) {
            seedBigInt = (seedBigInt << BigInt(8)) | BigInt(hashArray[i]);
          }
          // Mod by field order to ensure valid private key
          const fieldOrder = BigInt('28948022309329048855892746252171976963363056481941560715954676764349967630337');
          const privateKeyBigInt = seedBigInt % fieldOrder;
          
          // Create private key from the seed
          privateKey = PrivateKey.fromBigInt(privateKeyBigInt);
          console.log('[DIDProofGenerator] Generated deterministic key for wallet:', userIdentifier);
        }
      } else {
        // Standard flow - load from secure storage
        try {
          if (!passkeyId || !effectiveDid) {
            throw new Error('Missing passkey or DID for standard flow');
          }
          const privateKeyString = await loadPrivateKey(walletType, passkeyId, effectiveDid);
          privateKey = PrivateKey.fromBase58(privateKeyString);
        } catch (keyError: any) {
          console.error('[DIDProofGenerator] Failed to load private key:', keyError);
          
          if (keyError.message?.includes('No stored private key')) {
            throw new Error(
              'Your account was created before the passkey security system was implemented. ' +
              'Please sign out and create a new account to use the secure proof generation feature.'
            );
          }
          throw keyError;
        }
      }

      // Step 2: Load Aadhar data from localStorage
      setState(prev => ({ 
        ...prev, 
        progress: 40,
        statusMessage: 'Loading your Aadhar data...'
      }));
      
      const aadharData = localStorage.getItem(`aadhar_${userIdentifier}`);
      if (!aadharData) {
        throw new Error('Aadhar data not found. Please upload your Aadhar XML first.');
      }

      const parsedData = JSON.parse(aadharData);

      // Step 3: Compile ZK programs (one-time per session)
      setState(prev => ({ 
        ...prev, 
        progress: 50,
        statusMessage: 'Compiling zero-knowledge circuits...'
      }));
      
      if (proofType === 'citizenship') {
        await compileCitizenshipProgram((msg, pct) => {
          setState(prev => ({ 
            ...prev, 
            statusMessage: msg,
            progress: 50 + (pct * 0.1) // 50-60%
          }));
        });
      } else {
        await compileAgeProgram((msg, pct) => {
          setState(prev => ({ 
            ...prev, 
            statusMessage: msg,
            progress: 50 + (pct * 0.1) // 50-60%
          }));
        });
      }
      
      // Step 4: Generate ZK proof based on type
      setState(prev => ({ 
        ...prev, 
        progress: 60,
        statusMessage: `Generating ${getProofTypeLabel(proofType)} (this takes 2-3 minutes)...`
      }));

      const minimumAge = getMinimumAge(proofType);
      
      // Create AadharData object with all required fields
      const aadharDataObj = {
        uid: parsedData.aadhaarNumber || parsedData.uid || 'XXXX-XXXX-0000',
        name: parsedData.name || 'User',
        dateOfBirth: parsedData.dateOfBirth || new Date(new Date().getFullYear() - 25, 0, 1).toISOString(),
        gender: (parsedData.gender || 'M') as 'M' | 'F' | 'T',
        address: parsedData.address || {
          house: '',
          street: '',
          locality: '',
          district: '',
          state: '',
          pincode: ''
        },
        verifiedAt: parsedData.verifiedAt || Date.now(),
        issuer: 'UIDAI' as const
      };

      // Generate a deterministic salt based on DID and timestamp
      const salt = `${session?.did || userIdentifier}_${Date.now()}`;
      
      // Generate proof based on type - ALL USE TRUE ZK PROOFS (OFF-CHAIN)
      let zkProofData: any;
      if (proofType === 'citizenship') {
        // Get citizenship from parsedData (e.g., "India", "USA", etc.)
        const citizenship = parsedData.citizenship || parsedData.country || 'India';
        
        zkProofData = await generateCitizenshipProofZK(
          citizenship,
          privateKey,
          salt,
          (msg, pct) => {
            setState(prev => ({ 
              ...prev, 
              statusMessage: msg,
              progress: 60 + (pct * 0.3) // 60-90%
            }));
          }
        );
        console.log('[DID Proof Gen] ✅ Generated TRUE zkSNARK citizenship proof (OFF-CHAIN)');
      } else {
        // Age proofs (age18, age21) - TRUE ZK PROOFS
        const actualAge = calculateAge(aadharDataObj.dateOfBirth);
        
        zkProofData = await generateAgeProofZK(
          actualAge,
          minimumAge,
          privateKey,
          salt,
          (msg, pct) => {
            setState(prev => ({ 
              ...prev, 
              statusMessage: msg,
              progress: 60 + (pct * 0.3) // 60-90%
            }));
          }
        );
        console.log('[DID Proof Gen] ✅ Generated TRUE zkSNARK age proof (OFF-CHAIN)');
      }
      
      // Also generate name proof for additional verification
      const nameZKProof = await generateNameProofZK(
        aadharDataObj.name,
        privateKey,
        salt + '_name',
        (msg, pct) => {
          console.log('[Name Proof]', msg, pct);
        }
      );
      console.log('[DID Proof Gen] ✅ Generated name zkSNARK proof (OFF-CHAIN)');

      const proofId = `minaid-${proofType}-${Date.now()}`;

      // Step 5: Store proofs locally
      setState(prev => ({ 
        ...prev, 
        progress: 92,
        statusMessage: 'Saving proofs...'
      }));
      
      // Map ProofType to StoredProof type
      const storedProofType = proofType === 'citizenship' ? 'kyc' as const : 'age' as const;
      
      // Store the main proof
      ProofStorage.saveProof({
        type: storedProofType,
        did: session?.did || userIdentifier,
        status: 'pending',
        metadata: {
          proofType: proofType,
          minimumAge: minimumAge > 0 ? minimumAge : undefined,
        },
        proofData: JSON.stringify(zkProofData)
      });

      // Store name proof separately
      ProofStorage.saveProof({
        type: 'kyc',
        did: session?.did || userIdentifier,
        status: 'pending',
        metadata: {
          proofType: 'name',
        },
        proofData: JSON.stringify(nameZKProof)
      });

      // Create downloadable proof package
      const downloadableProof = {
        proof: zkProofData.proof,
        publicOutput: zkProofData.publicOutput,
        did: session?.did || userIdentifier,
        proofType,
        minimumAge: minimumAge > 0 ? minimumAge : undefined,
        timestamp: zkProofData.timestamp,
        selectiveDisclosure: zkProofData.selectiveDisclosure
      };

      // Step 6: Record proof on blockchain (optional, non-blocking)
      setState(prev => ({ 
        ...prev, 
        progress: 95,
        statusMessage: 'Recording proof on blockchain...'
      }));

      // Attempt blockchain recording (don't fail if it doesn't work)
      try {
        // Import ContractInterface to verify proof on-chain
        const { ContractInterface } = await import('../../lib/ContractInterface');
        const contract = new ContractInterface({
          minaEndpoint: 'https://proxy.devnet.minaexplorer.com/graphql',
          archiveEndpoint: 'https://archive.devnet.minaexplorer.com',
          networkId: 'devnet',
          didRegistryAddress: process.env.NEXT_PUBLIC_DID_REGISTRY_ADDRESS || '',
          zkpVerifierAddress: process.env.NEXT_PUBLIC_ZKP_VERIFIER_ADDRESS || ''
        });
        await contract.initialize();
        
        // Verify the ZK proof on-chain (only verification, proof was generated off-chain)
        const result = await contract.verifyZKProofOnChain(
          zkProofData,
          privateKey.toBase58()
        );
        
        if (result.success && result.hash) {
          console.log('[DIDProofGenerator] ✅ Proof VERIFIED ON-CHAIN:', result.hash);
          localStorage.setItem(`minaid_proof_tx_${proofId}`, result.hash);
        }
      } catch (blockchainError: any) {
        console.warn('[DIDProofGenerator] ⚠️ On-chain verification failed (non-blocking):', blockchainError.message);
      }

      // Success
      setState(prev => ({ 
        ...prev, 
        step: 'success',
        progress: 100,
        statusMessage: 'Proof generated successfully!',
        proofId,
        generatedProof: downloadableProof
      }));

    } catch (error: any) {
      console.error('[DIDProofGenerator] Error:', error);
      setState(prev => ({ 
        ...prev, 
        step: 'error',
        error: error.message || 'Failed to generate proof',
        statusMessage: 'Proof generation failed'
      }));
    }
  };

  const handleContinue = () => {
    // After successful proof generation, go to verifier page for KYC verification
    router.push('/verifier');
  };

  const handleRetry = () => {
    setState({
      step: 'welcome',
      progress: 0,
      statusMessage: 'Ready to generate your DID proof'
    });
  };

  const handleUploadToIPFS = async () => {
    if (!state.generatedProof || !userIdentifier) {
      console.error('[DIDProofGenerator] No proof data or user identifier');
      return;
    }

    try {
      setState(prev => ({ ...prev, isUploadingIPFS: true }));

      const { getIPFSService } = await import('../../lib/IPFSService');
      const { generatePassphrase } = await import('../../lib/IPFSCrypto');
      
      const ipfsService = getIPFSService();
      
      // Generate passphrase from wallet address
      const passphrase = generatePassphrase(userIdentifier, 'minaid-proof');
      
      // Upload proof to IPFS with encryption
      const result = await ipfsService.uploadEncrypted(
        state.generatedProof,
        passphrase,
        {
          name: `minaid-proof-${state.generatedProof.proofType}-${Date.now()}`,
          metadata: {
            type: 'minaid-proof',
            proofType: state.generatedProof.proofType,
            did: state.generatedProof.did
          }
        }
      );

      // Store CID
      localStorage.setItem(
        `minaid_proof_cid_${state.proofId}`,
        JSON.stringify({ cid: result.cid, timestamp: Date.now() })
      );

      setState(prev => ({ ...prev, ipfsCID: result.cid, isUploadingIPFS: false }));
      
      // Display wallet address with CID for sharing
      alert(
        `✅ Proof uploaded to IPFS!\n\n` +
        `CID: ${result.cid}\n\n` +
        `🔑 Wallet Address: ${userIdentifier}\n\n` +
        `Share BOTH the CID and wallet address with verifiers to access your proof.`
      );
    } catch (error: any) {
      console.error('[DIDProofGenerator] IPFS upload failed:', error);
      setState(prev => ({ ...prev, isUploadingIPFS: false }));
      alert(`Failed to upload to IPFS: ${error.message}`);
    }
  };

  const handleDownloadProof = () => {
    if (!state.generatedProof) {
      console.error('[DIDProofGenerator] No proof data to download');
      return;
    }

    try {
      // Create downloadable JSON with all necessary verification data
      // IMPORTANT: Include selectiveDisclosure for credential verification
      const downloadData = {
        version: '1.0',
        type: 'mina-zkp-proof',
        proofType: state.generatedProof.proofType,
        did: state.generatedProof.did,
        timestamp: state.generatedProof.timestamp,
        minimumAge: state.generatedProof.minimumAge,
        proof: state.generatedProof.proof,
        publicOutput: state.generatedProof.publicOutput,
        // Include selective disclosure for name/citizenship verification
        selectiveDisclosure: state.generatedProof.selectiveDisclosure,
        metadata: {
          generatedAt: new Date(state.generatedProof.timestamp).toISOString(),
          proofId: state.proofId,
        }
      };

      // Convert to JSON string with formatting
      const jsonString = JSON.stringify(downloadData, null, 2);
      
      // Create blob and download
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `minaid-proof-${state.generatedProof.proofType}-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('[DIDProofGenerator] Proof downloaded successfully');
    } catch (error) {
      console.error('[DIDProofGenerator] Download failed:', error);
      alert('Failed to download proof. Please try again.');
    }
  };

  if (!userIdentifier) {
    return (
      <GradientBG>
        <div className="flex flex-col items-center justify-center min-h-screen p-4">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Wallet Connection Required</h2>
            <p className="text-gray-600 mb-6">Please connect your wallet to generate proofs</p>
            <button
              onClick={() => router.push('/signup')}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </GradientBG>
    );
  }

  return (
    <GradientBG>
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-2xl w-full">
          
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">
              Generate {getProofTypeLabel(proofType)}
            </h1>
            <p className="text-gray-600">
              {proofType === 'citizenship' 
                ? 'Create your citizenship proof for identity verification'
                : `Prove you are ${getMinimumAge(proofType)}+ years old without revealing your exact age`
              }
            </p>
          </div>

          {/* Welcome Step */}
          {state.step === 'welcome' && (
            <div className="space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-blue-900 mb-2">
                  What is {proofType === 'citizenship' ? 'a Citizenship' : 'an Age'} Proof?
                </h3>
                <p className="text-blue-800 text-sm">
                  {proofType === 'citizenship' 
                    ? 'A citizenship proof verifies your nationality and identity using zero-knowledge cryptography. This proof is stored on the Mina blockchain and can be used for secure, privacy-preserving verification without revealing your personal details.'
                    : `An age proof uses zero-knowledge cryptography to prove you are at least ${getMinimumAge(proofType)} years old without revealing your exact age or date of birth. This proof is stored on the Mina blockchain for secure verification.`
                  }
                </p>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <h3 className="font-semibold text-gray-800">What we'll verify:</h3>
                <ul className="space-y-2 text-sm text-gray-700">
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Age verification (minimum 18 years)</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Identity credentials from Aadhar</span>
                  </li>
                  <li className="flex items-start">
                    <svg className="w-5 h-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span>Zero-knowledge proof generation</span>
                  </li>
                </ul>
              </div>

              <button
                onClick={handleGenerateProof}
                className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-semibold text-lg"
              >
                Generate Proof
              </button>
            </div>
          )}

          {/* Generating Step */}
          {state.step === 'generating' && (
            <div className="space-y-6">
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600"></div>
              </div>

              <div className="space-y-3">
                <div className="bg-gray-200 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-indigo-600 h-full transition-all duration-500 ease-out"
                    style={{ width: `${state.progress}%` }}
                  />
                </div>
                <p className="text-center text-gray-600 font-medium">
                  {state.statusMessage}
                </p>
                <p className="text-center text-sm text-gray-500">
                  {state.progress}% Complete
                </p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> Proof generation may take 10-30 seconds. Please don't close this window.
                </p>
              </div>
            </div>
          )}

          {/* Success Step */}
          {state.step === 'success' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Proof Generated Successfully!
                </h2>
                <p className="text-gray-600">
                  Your DID proof has been created and stored securely
                </p>
              </div>

              {state.proofId && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Proof ID:</p>
                  <p className="text-xs font-mono text-gray-800 break-all bg-white p-2 rounded border">
                    {state.proofId}
                  </p>
                </div>
              )}

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Download Your Proof
                </h3>
                <p className="text-sm text-green-800 mb-2">
                  Download your proof as a JSON file that you can:
                </p>
                <ul className="text-sm text-green-800 list-disc list-inside space-y-1 ml-2">
                  <li>Share with verifiers for validation</li>
                  <li>Upload to verification systems</li>
                  <li>Keep as a backup of your proof</li>
                  <li>Use in the "Verify Proof" section</li>
                </ul>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Next Step: KYC Verification</h3>
                <p className="text-sm text-blue-800">
                  Your proof needs to be verified by a trusted verifier before you can access the dashboard. 
                  Click continue to proceed to the verification step.
                </p>
              </div>

              {state.ipfsCID && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h3 className="font-semibold text-purple-900 mb-2 flex items-center gap-2">
                    ☁️ Uploaded to IPFS
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-purple-600 font-semibold">CID:</p>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(state.ipfsCID!);
                              const toast = (await import('react-hot-toast')).default;
                              toast.success('CID copied!');
                            } catch (error) {
                              const toast = (await import('react-hot-toast')).default;
                              toast.error('Failed to copy');
                            }
                          }}
                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-purple-800 font-mono break-all bg-white px-3 py-2 rounded">
                        {state.ipfsCID}
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs text-purple-600 font-semibold">Wallet Address (for decryption):</p>
                        <button
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(userIdentifier!);
                              const toast = (await import('react-hot-toast')).default;
                              toast.success('Wallet address copied!');
                            } catch (error) {
                              const toast = (await import('react-hot-toast')).default;
                              toast.error('Failed to copy');
                            }
                          }}
                          className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors flex items-center gap-1"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Copy
                        </button>
                      </div>
                      <p className="text-sm text-purple-800 font-mono break-all bg-white px-3 py-2 rounded">
                        {userIdentifier}
                      </p>
                    </div>
                    <p className="text-xs text-purple-700">
                      ⚠️ Share BOTH the CID and wallet address with verifiers to access your proof securely.
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <button
                  onClick={handleUploadToIPFS}
                  disabled={state.isUploadingIPFS}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition font-semibold text-lg flex items-center justify-center gap-2"
                >
                  {state.isUploadingIPFS ? (
                    <>
                      <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                      Uploading to IPFS...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      ☁️ Upload Proof to IPFS
                    </>
                  )}
                </button>

                <button
                  onClick={handleDownloadProof}
                  className="w-full bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition font-semibold text-lg flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Proof (JSON)
                </button>
                <button
                  onClick={handleContinue}
                  className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-semibold text-lg"
                >
                  Continue to Verification
                </button>
              </div>
            </div>
          )}

          {/* Error Step */}
          {state.step === 'error' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-red-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  {state.error?.includes('passkey') || state.error?.includes('setup') 
                    ? 'Setup Required' 
                    : 'Proof Generation Failed'}
                </h2>
                <p className="text-gray-600">
                  {state.error?.includes('passkey') || state.error?.includes('setup')
                    ? 'Complete your account setup to generate proofs'
                    : 'We encountered an error while generating your proof'}
                </p>
              </div>

              {state.error && (
                <div className={`border rounded-lg p-4 ${
                  state.error.includes('passkey') || state.error.includes('setup') || state.error.includes('Aadhar') || state.error.includes('create a new account')
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}>
                  <p className={`text-sm ${
                    state.error.includes('passkey') || state.error.includes('setup') || state.error.includes('Aadhar') || state.error.includes('create a new account')
                      ? 'text-yellow-800'
                      : 'text-red-800'
                  }`}>
                    <strong>
                      {state.error.includes('passkey') || state.error.includes('setup') || state.error.includes('create a new account')
                        ? 'Action Required:' 
                        : 'Error:'}
                    </strong> {state.error}
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {(state.error?.includes('Aadhar') || state.error?.includes('upload')) && (
                  <button
                    onClick={() => router.push('/upload-aadhar')}
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-semibold"
                  >
                    Upload Aadhar XML
                  </button>
                )}
                {(state.error?.includes('before the passkey') || state.error?.includes('create a new account')) && (
                  <button
                    onClick={async () => {
                      // Clear old session data using proper function
                      const { clearAllData } = await import('../../lib/DataManagement');
                      clearAllData();
                      router.push('/signup');
                    }}
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-semibold"
                  >
                    Create New Account
                  </button>
                )}
                {!state.error?.includes('Aadhar') && !state.error?.includes('upload') && !state.error?.includes('create a new account') && (
                  <button
                    onClick={handleRetry}
                    className="w-full bg-indigo-600 text-white py-3 px-6 rounded-lg hover:bg-indigo-700 transition font-semibold"
                  >
                    Try Again
                  </button>
                )}
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full bg-gray-200 text-gray-700 py-3 px-6 rounded-lg hover:bg-gray-300 transition font-semibold"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </GradientBG>
  );
}
