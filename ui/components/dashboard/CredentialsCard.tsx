/**
 * CredentialsCard.tsx
 * 
 * Display and manage user credentials with proof generation
 * Updated to use ZKProofGenerator for TRUE OFF-CHAIN proof generation
 */

'use client';

import React, { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  generateAgeProofZK,
  generateCitizenshipProofZK,
  generateNameProofZK,
  generateKYCProofZK,
  compileAgeProgram,
  compileCitizenshipProgram,
  ZKProofData
} from '../../lib/ZKProofGenerator';
import { monitorTransaction, TxStatus, getStatusMessage, formatTimeRemaining, MonitoringCallbacks } from '../../lib/CompleteTransactionMonitor';
import { ContractInterface, DEFAULT_CONFIG } from '../../lib/ContractInterface';

interface Credential {
  id: string;
  type: 'age' | 'kyc' | 'address' | 'identity' | 'name' | 'citizenship';
  issuer: string;
  issuedAt: number;
  expiresAt?: number;
  status: 'active' | 'revoked' | 'expired';
  attributes: Record<string, any>;
}

interface CredentialsCardProps {
  credentials?: Credential[];
  onGenerateProof?: (credential: Credential, proofType: string) => void;
  onViewCredential?: (credential: Credential) => void;
  onRevokeCredential?: (credential: Credential) => void;
  userDid?: string;
}

export function CredentialsCard({ 
  credentials = [], 
  onGenerateProof, 
  onViewCredential, 
  onRevokeCredential,
  userDid 
}: CredentialsCardProps) {
  const router = useRouter();
  const [selectedCredential, setSelectedCredential] = useState<Credential | null>(null);
  const [showProofOptions, setShowProofOptions] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedProof, setGeneratedProof] = useState<ZKProofData | null>(null);
  
  // Progress tracking for proof generation
  const [proofProgress, setProofProgress] = useState(0);
  const [proofStatus, setProofStatus] = useState('');
  const [showOnChainModal, setShowOnChainModal] = useState(false);
  const [txHash, setTxHash] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>('unknown');
  
  // IPFS upload state
  const [isUploadingIPFS, setIsUploadingIPFS] = useState(false);
  const [ipfsCID, setIpfsCID] = useState<string | null>(null);

  const getCredentialIcon = (type: string) => {
    const icons: Record<string, string> = {
      age: '🎂',
      kyc: '✅',
      address: '📍',
      identity: '👤',
      name: '📛',
      citizenship: '🏳️',
    };
    return icons[type] || '📄';
  };

  const getStatusBadge = (status: Credential['status']) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      revoked: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Mock credential if none exist
  const displayCredentials = credentials.length > 0 ? credentials : [
    {
      id: 'aadhar-age-credential',
      type: 'age' as const,
      issuer: 'UIDAI (Aadhaar)',
      issuedAt: Date.now() - 86400000 * 7,
      status: 'active' as const,
      attributes: {
        minimumAge: 18,
        verified: true,
      },
    },
  ];

  // Handle View button click
  const handleView = (credential: Credential) => {
    setSelectedCredential(credential);
    setShowViewModal(true);
    if (onViewCredential) {
      onViewCredential(credential);
    }
  };

  // Handle Generate Proof button click
  const handleGenerateProofClick = (credential: Credential) => {
    setSelectedCredential(credential);
    setShowProofOptions(true);
  };

  // Generate specific proof type using ZKProofGenerator (OFF-CHAIN)
  const handleGenerateSpecificProof = async (proofType: string) => {
    if (!selectedCredential) return;
    
    // Check if already generating
    if (isGenerating) {
      alert('Proof generation already in progress. Please wait.');
      return;
    }
    
    setIsGenerating(true);
    setProofProgress(0);
    setProofStatus('Initializing...');
    
    try {
      const { PrivateKey, PublicKey } = await import('o1js');
      
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (!walletData) {
        throw new Error('Please connect your wallet first');
      }
      
      const { did, address } = JSON.parse(walletData);
      const userIdentifier = did || address;
      
      const aadharData = localStorage.getItem(`aadhar_${userIdentifier}`);
      if (!aadharData) {
        throw new Error('Please upload your Aadhar credential first');
      }
      
      const parsedAadhar = JSON.parse(aadharData);
      
      // Get or create salt for this user
      let salt = localStorage.getItem(`proof_salt_${userIdentifier}`);
      if (!salt) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        salt = '';
        for (let i = 0; i < 16; i++) {
          salt += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        localStorage.setItem(`proof_salt_${userIdentifier}`, salt);
      }
      
      let privateKey: InstanceType<typeof PrivateKey>;
      
      // Get or derive private key
      if (typeof window !== 'undefined' && (window as any).mina) {
        try {
          const accounts = await (window as any).mina.requestAccounts();
          if (accounts && accounts.length > 0) {
            // Derive deterministic key from wallet address
            const seedString = `${accounts[0]}:${salt}:minaid_proof_key`;
            const seedBytes = new TextEncoder().encode(seedString);
            let seedNum = BigInt(0);
            for (let i = 0; i < Math.min(seedBytes.length, 31); i++) {
              seedNum = (seedNum << BigInt(8)) | BigInt(seedBytes[i]);
            }
            privateKey = PrivateKey.fromBigInt(seedNum);
            console.log('[CredentialsCard] Using wallet-derived key');
          } else {
            throw new Error('No wallet accounts available');
          }
        } catch (walletError) {
          console.warn('[CredentialsCard] Wallet error, using fallback key');
          const seedString = `${userIdentifier}:${salt}:minaid_proof_key`;
          const seedBytes = new TextEncoder().encode(seedString);
          let seedNum = BigInt(0);
          for (let i = 0; i < Math.min(seedBytes.length, 31); i++) {
            seedNum = (seedNum << BigInt(8)) | BigInt(seedBytes[i]);
          }
          privateKey = PrivateKey.fromBigInt(seedNum);
        }
      } else {
        // Fallback to deterministic key
        const seedString = `${userIdentifier}:${salt}:minaid_proof_key`;
        const seedBytes = new TextEncoder().encode(seedString);
        let seedNum = BigInt(0);
        for (let i = 0; i < Math.min(seedBytes.length, 31); i++) {
          seedNum = (seedNum << BigInt(8)) | BigInt(seedBytes[i]);
        }
        privateKey = PrivateKey.fromBigInt(seedNum);
      }
      
      let proof: ZKProofData | null = null;
      
      // Progress callback
      const onProgress = (message: string, percent: number) => {
        setProofStatus(message);
        setProofProgress(percent);
      };
      
      // Calculate age from Aadhar DOB
      const dob = new Date(parsedAadhar.dateOfBirth || parsedAadhar.dob);
      const today = new Date();
      let actualAge = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
        actualAge--;
      }
      
      // Generate TRUE zkSNARK proofs OFF-CHAIN
      switch (proofType) {
        case 'age':
        case 'age18':
          // Compile age program first
          setProofStatus('Compiling zero-knowledge circuits (one-time)...');
          await compileAgeProgram(onProgress);
          
          // Generate age 18+ proof OFF-CHAIN
          proof = await generateAgeProofZK(actualAge, 18, privateKey, salt, onProgress);
          console.log('✅ Age 18+ proof generated OFF-CHAIN');
          break;
          
        case 'age21':
          // Compile age program first
          setProofStatus('Compiling zero-knowledge circuits (one-time)...');
          await compileAgeProgram(onProgress);
          
          // Generate age 21+ proof OFF-CHAIN
          proof = await generateAgeProofZK(actualAge, 21, privateKey, salt, onProgress);
          console.log('✅ Age 21+ proof generated OFF-CHAIN');
          break;
          
        case 'kyc':
          // KYC proof
          setProofStatus('Generating KYC proof...');
          proof = await generateKYCProofZK(
            { uid: parsedAadhar.uid, name: parsedAadhar.name, dateOfBirth: parsedAadhar.dateOfBirth },
            privateKey,
            salt,
            onProgress
          );
          console.log('✅ KYC proof generated OFF-CHAIN');
          break;
          
        case 'name':
          // Compile citizenship program (used for name proofs too)
          setProofStatus('Compiling zero-knowledge circuits (one-time)...');
          await compileCitizenshipProgram(onProgress);
          
          // Generate name proof OFF-CHAIN
          proof = await generateNameProofZK(parsedAadhar.name, privateKey, salt, onProgress);
          console.log('✅ Name proof generated OFF-CHAIN');
          break;
          
        case 'citizenship':
          // Compile citizenship program first
          setProofStatus('Compiling zero-knowledge circuits (one-time)...');
          await compileCitizenshipProgram(onProgress);
          
          // Generate citizenship proof OFF-CHAIN
          const citizenship = parsedAadhar.country || parsedAadhar.citizenship || 'India';
          proof = await generateCitizenshipProofZK(citizenship, privateKey, salt, onProgress);
          console.log('✅ Citizenship proof generated OFF-CHAIN');
          break;
          
        default:
          throw new Error(`Unknown proof type: ${proofType}`);
      }
      
      if (proof) {
        // Save proof to localStorage
        const proofs = JSON.parse(localStorage.getItem(`proofs_${userIdentifier}`) || '[]');
        proofs.push({ ...proof, generatedAt: Date.now() });
        localStorage.setItem(`proofs_${userIdentifier}`, JSON.stringify(proofs));
        
        setGeneratedProof(proof as any); // Cast for UI compatibility
        
        // Step 2: Verify proof ON-CHAIN (only verification, proof was generated off-chain)
        setProofStatus('Verifying proof on blockchain...');
        
        try {
          // Initialize contract interface
          // const contractInterface = new ContractInterface(DEFAULT_CONFIG);
          // await contractInterface.initialize();
          
          // Verify proof on-chain (ONLY verification, generation was off-chain)
          // setProofStatus('Submitting proof for on-chain verification...');
          // const registrationResult = await contractInterface.verifyZKProofOnChain(proof, privateKey.toBase58());
          
          // STOP HERE - Do not verify automatically
          setProofStatus('✅ Proof generated successfully! Ready for verification.');
          alert(`✅ ${proofType} proof generated successfully!\n\nYou can now verify this proof on the Verifier Dashboard.`);
          
          /* 
          // Automatic verification removed as per user request
          // Verification should happen separately in the Verifier Dashboard
          */
        } catch (regError: any) {
          console.error('[CredentialsCard] Registration error:', regError);
          setProofStatus(`⚠️ Proof saved locally, but blockchain registration failed: ${regError.message}`);
        }
        
        // Step 3: Done! Proof generated OFF-CHAIN
        console.log('[CredentialsCard] ✅ Proof generation complete');
        
        if (onGenerateProof) {
          onGenerateProof(selectedCredential, proofType);
        }
      }
    } catch (error: any) {
      console.error('[CredentialsCard] Failed to generate proof:', error);
      setProofStatus(`Error: ${error.message}`);
      alert(`Failed to generate proof: ${error.message}`);
    } finally {
      setIsGenerating(false);
    }
  };
  const handleRevoke = (credential: Credential) => {
    if (confirm('Are you sure you want to revoke this credential? This action cannot be undone.')) {
      if (onRevokeCredential) {
        onRevokeCredential(credential);
      }
      credential.status = 'revoked';
    }
  };

  const downloadProof = () => {
    if (!generatedProof) return;
    
    const dataStr = JSON.stringify(generatedProof, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proof_${generatedProof.proofType || 'zk'}_${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleUploadToIPFS = async () => {
    if (!generatedProof || !userDid) {
      alert('No proof data or user identifier available');
      return;
    }

    try {
      setIsUploadingIPFS(true);

      const { getIPFSService } = await import('../../lib/IPFSService');
      const { generatePassphrase } = await import('../../lib/IPFSCrypto');
      const { getPinataCredentials } = await import('../settings/PinataSettings');
      
      // Get user's Pinata credentials
      const credentials = getPinataCredentials(userDid);
      
      if (!credentials) {
        alert('⚠️ Pinata account not connected!\n\nPlease connect your Pinata account in Settings to upload proofs to IPFS.');
        setIsUploadingIPFS(false);
        return;
      }
      
      const ipfsService = getIPFSService();
      
      // Generate passphrase from wallet address
      const passphrase = generatePassphrase(userDid, 'minaid-proof');
      
      // Upload proof to IPFS with encryption using user's credentials
      const result = await ipfsService.uploadEncrypted(
        generatedProof,
        passphrase,
        {
          name: `minaid-proof-${generatedProof.proofType}-${Date.now()}`,
          metadata: {
            type: 'minaid-proof',
            proofType: generatedProof.proofType,
            did: userDid
          }
        },
        credentials // Pass user's Pinata credentials
      );

      // Store CID
      localStorage.setItem(
        `minaid_proof_cid_${generatedProof.metadata?.proofId || Date.now()}`,
        JSON.stringify({ cid: result.cid, timestamp: Date.now() })
      );

      setIpfsCID(result.cid);
      setIsUploadingIPFS(false);
      
      alert(`✅ Proof uploaded to IPFS!\n\nCID: ${result.cid}\n\nShare this CID with verifiers to access your proof.`);
    } catch (error: any) {
      console.error('[CredentialsCard] IPFS upload failed:', error);
      setIsUploadingIPFS(false);
      alert(`Failed to upload to IPFS: ${error.message}`);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Credentials</h2>
        <button 
          onClick={() => router.push('/upload-aadhar')}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          + Add Credential
        </button>
      </div>

      {displayCredentials.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-gray-500 mb-4">No credentials yet</p>
          <button 
            onClick={() => router.push('/upload-aadhar')}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            Upload Your First Credential
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayCredentials.map(credential => (
            <div
              key={credential.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="text-3xl">{getCredentialIcon(credential.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-bold text-gray-900 capitalize">
                        {credential.type} Credential
                      </h3>
                      {getStatusBadge(credential.status)}
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600">
                        <span className="font-medium">Issuer:</span> {credential.issuer}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Issued:</span>{' '}
                        {new Date(credential.issuedAt).toLocaleDateString()}
                      </p>
                      {credential.expiresAt && (
                        <p className="text-gray-600">
                          <span className="font-medium">Expires:</span>{' '}
                          {new Date(credential.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {Object.keys(credential.attributes).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(credential.attributes).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col space-y-2 ml-4">
                  <button 
                    onClick={() => handleView(credential)}
                    className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors text-xs font-medium"
                  >
                    View
                  </button>
                  <button 
                    onClick={() => handleGenerateProofClick(credential)}
                    className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs font-medium"
                  >
                    Generate Proof
                  </button>
                  {credential.status === 'active' && (
                    <button 
                      onClick={() => handleRevoke(credential)}
                      className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs font-medium"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Proof Generation Options Modal */}
      {showProofOptions && selectedCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Generate ZK Proof</h3>
              <button 
                onClick={() => {
                  setShowProofOptions(false);
                  setGeneratedProof(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {isGenerating ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Generating zero-knowledge proof OFF-CHAIN...</p>
                <p className="text-xs text-gray-400 mt-2">This may take 2-3 minutes for TRUE zkSNARK generation</p>
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-800 font-semibold">✨ What's happening:</p>
                  <p className="text-xs text-blue-700 mt-1">Your proof is being generated entirely in your browser using cryptographic zero-knowledge algorithms. No data is sent to the server or blockchain during generation.</p>
                </div>
                {proofProgress > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{width: `${proofProgress}%`}}></div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{proofProgress}% - {proofStatus}</p>
                  </div>
                )}
              </div>
            ) : generatedProof ? (
              <div className="text-center py-4">
                <div className="text-5xl mb-4">✅</div>
                <h4 className="text-lg font-semibold text-green-700 mb-2">Proof Generated!</h4>
                <p className="text-sm text-gray-600 mb-4">
                  Your {generatedProof.proofType || 'ZK'} proof has been created and signed.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 text-left">
                  <p className="text-xs text-gray-500 mb-1">Proof ID:</p>
                  <p className="text-xs font-mono text-gray-700 break-all">
                    {generatedProof.metadata?.proofId || generatedProof.proofType}
                  </p>
                </div>
                
                {ipfsCID && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 mb-4 text-left">
                    <p className="text-xs text-purple-700 font-semibold mb-1">☁️ Uploaded to IPFS</p>
                    <p className="text-xs font-mono text-purple-900 break-all mb-1">
                      {ipfsCID}
                    </p>
                    <p className="text-xs text-purple-600">
                      Share this CID with verifiers
                    </p>
                  </div>
                )}
                
                <div className="space-y-2 mb-4">
                  <button
                    onClick={handleUploadToIPFS}
                    disabled={isUploadingIPFS || !!ipfsCID}
                    className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm font-medium flex items-center justify-center gap-2"
                  >
                    {isUploadingIPFS ? (
                      <>
                        <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                        Uploading...
                      </>
                    ) : ipfsCID ? (
                      <>✓ Uploaded to IPFS</>
                    ) : (
                      <>☁️ Upload to IPFS</>
                    )}
                  </button>
                  
                  <button
                    onClick={downloadProof}
                    className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    📥 Download Proof
                  </button>
                </div>
                
                <button
                  onClick={() => {
                    setShowProofOptions(false);
                    setGeneratedProof(null);
                    setIpfsCID(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  Close
                </button>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-4 text-sm">
                  Select the type of proof to generate. The proof will be signed with your credentials.
                </p>
                
                <div className="space-y-3">
                  <button
                    onClick={() => handleGenerateSpecificProof('age')}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🎂</span>
                      <div>
                        <p className="font-semibold text-gray-900">Age Verification (18+)</p>
                        <p className="text-xs text-gray-500">Prove you are 18+ without revealing exact age</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleGenerateSpecificProof('age21')}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🍷</span>
                      <div>
                        <p className="font-semibold text-gray-900">Age Verification (21+)</p>
                        <p className="text-xs text-gray-500">Prove you are 21+ without revealing exact age</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleGenerateSpecificProof('name')}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📛</span>
                      <div>
                        <p className="font-semibold text-gray-900">Name Verification</p>
                        <p className="text-xs text-gray-500">Prove your name matches a given value</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleGenerateSpecificProof('citizenship')}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🏳️</span>
                      <div>
                        <p className="font-semibold text-gray-900">Citizenship Verification</p>
                        <p className="text-xs text-gray-500">Prove your citizenship/country</p>
                      </div>
                    </div>
                  </button>

                  <button
                    onClick={() => handleGenerateSpecificProof('kyc')}
                    className="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-indigo-400 hover:bg-indigo-50 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">✅</span>
                      <div>
                        <p className="font-semibold text-gray-900">KYC Status</p>
                        <p className="text-xs text-gray-500">Prove KYC verification without revealing details</p>
                      </div>
                    </div>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* View Credential Modal */}
      {showViewModal && selectedCredential && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Credential Details</h3>
              <button 
                onClick={() => setShowViewModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 pb-4 border-b">
                <span className="text-4xl">{getCredentialIcon(selectedCredential.type)}</span>
                <div>
                  <h4 className="font-bold text-gray-900 capitalize">{selectedCredential.type} Credential</h4>
                  {getStatusBadge(selectedCredential.status)}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Issuer</p>
                  <p className="font-medium text-gray-900">{selectedCredential.issuer}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Issued Date</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedCredential.issuedAt).toLocaleDateString()}
                  </p>
                </div>
                {selectedCredential.expiresAt && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Expiration Date</p>
                    <p className="font-medium text-gray-900">
                      {new Date(selectedCredential.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Attributes</p>
                  <div className="bg-gray-50 rounded-lg p-3">
                    {Object.entries(selectedCredential.attributes).map(([key, value]) => (
                      <div key={key} className="flex justify-between py-1">
                        <span className="text-gray-600 capitalize">{key}:</span>
                        <span className="font-medium text-gray-900">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button
                onClick={() => setShowViewModal(false)}
                className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium mt-4"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Transaction Status Modal */}
      {showOnChainModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">Blockchain Transaction</h3>
              <button 
                onClick={() => setShowOnChainModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              {/* Status Indicator */}
              <div className="flex items-center justify-center py-4">
                {txStatus === 'pending' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600"></div>
                    <p className="text-gray-600">Processing transaction...</p>
                  </div>
                )}
                {txStatus === 'confirmed' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-6xl">✅</div>
                    <p className="text-green-600 font-semibold">Transaction Confirmed!</p>
                  </div>
                )}
                {txStatus === 'failed' && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="text-6xl">❌</div>
                    <p className="text-red-600 font-semibold">Transaction Failed</p>
                  </div>
                )}
              </div>

              {/* Transaction Hash */}
              {txHash && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Transaction Hash</p>
                  <p className="font-mono text-xs break-all text-gray-900">{txHash}</p>
                  <a
                    href={`https://minascan.io/devnet/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-700 text-sm mt-2 inline-block"
                  >
                    View on Minascan →
                  </a>
                </div>
              )}

              {/* Status Message */}
              <div className="bg-blue-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">{proofStatus}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {txStatus === 'confirmed' && generatedProof && (
                  <button
                    onClick={downloadProof}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
                  >
                    Download Proof
                  </button>
                )}
                <button
                  onClick={() => setShowOnChainModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
