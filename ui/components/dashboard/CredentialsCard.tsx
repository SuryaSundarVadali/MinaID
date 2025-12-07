/**
 * CredentialsCard.tsx
 * 
 * Display and manage user credentials with proof generation
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const [generatedProof, setGeneratedProof] = useState<any>(null);

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

  // Generate specific proof type
  const handleGenerateSpecificProof = async (proofType: string) => {
    if (!selectedCredential) return;
    
    setIsGenerating(true);
    try {
      const { generateAgeProof, generateKYCProof, generateSelectiveDisclosureProof, generateCitizenshipZKProof } = await import('../../lib/ProofGenerator');
      const { PrivateKey, PublicKey } = await import('o1js');
      
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (!walletData) {
        alert('Please connect your wallet first');
        return;
      }
      
      const { did, address } = JSON.parse(walletData);
      const userIdentifier = did || address;
      
      const aadharData = localStorage.getItem(`aadhar_${userIdentifier}`);
      if (!aadharData) {
        alert('Please upload your Aadhar credential first');
        router.push('/upload-aadhar');
        return;
      }
      
      const parsedAadhar = JSON.parse(aadharData);
      
      // Get or create salt for this user
      const salt = localStorage.getItem(`proof_salt_${userIdentifier}`) || Math.random().toString(36).substring(7);
      localStorage.setItem(`proof_salt_${userIdentifier}`, salt);
      
      let privateKey: any;
      let publicKey: any;
      
      // Check if Auro wallet is available and use it for signing
      if (typeof window !== 'undefined' && (window as any).mina) {
        try {
          // Request accounts from Auro wallet
          const accounts = await (window as any).mina.requestAccounts();
          if (accounts && accounts.length > 0) {
            publicKey = PublicKey.fromBase58(accounts[0]);
            
            // Create a deterministic key derived from wallet address
            // This ensures proofs can be verified consistently
            const seedString = `${accounts[0]}:${salt}:minaid_proof_key`;
            const seedBytes = new TextEncoder().encode(seedString);
            let seedNum = BigInt(0);
            for (let i = 0; i < Math.min(seedBytes.length, 31); i++) {
              seedNum = (seedNum << BigInt(8)) | BigInt(seedBytes[i]);
            }
            privateKey = PrivateKey.fromBigInt(seedNum);
            publicKey = privateKey.toPublicKey();
            console.log('[ProofGen] Using Auro wallet-derived key for proof generation');
          }
        } catch (walletError) {
          console.warn('[ProofGen] Auro wallet not available, falling back to deterministic key');
        }
      }
      
      // Fallback to deterministic key if wallet not available
      if (!privateKey) {
        const seedString = `${userIdentifier}:${salt}:minaid_proof_key`;
        const seedBytes = new TextEncoder().encode(seedString);
        let seedNum = BigInt(0);
        for (let i = 0; i < Math.min(seedBytes.length, 31); i++) {
          seedNum = (seedNum << BigInt(8)) | BigInt(seedBytes[i]);
        }
        privateKey = PrivateKey.fromBigInt(seedNum);
        publicKey = privateKey.toPublicKey();
        console.log('[ProofGen] Using deterministic key for proof generation');
      }
      
      let proof: any = null;
      
      switch (proofType) {
        case 'age':
          proof = await generateAgeProof(parsedAadhar, 18, privateKey, salt);
          proof = {
            ...proof,
            id: `age18_proof_${Date.now()}`,
            proofType: 'age18',
            did: `did:mina:${publicKey.toBase58()}`,
            selectiveDisclosure: { salt },
            metadata: { proofId: `age18_${Date.now()}`, generatedAt: new Date().toISOString() }
          };
          break;
        case 'age21':
          proof = await generateAgeProof(parsedAadhar, 21, privateKey, salt);
          proof = {
            ...proof,
            id: `age21_proof_${Date.now()}`,
            proofType: 'age21',
            did: `did:mina:${publicKey.toBase58()}`,
            selectiveDisclosure: { salt },
            metadata: { proofId: `age21_${Date.now()}`, generatedAt: new Date().toISOString() }
          };
          break;
        case 'name':
          const nameProof = generateSelectiveDisclosureProof(
            parsedAadhar.name,
            'name',
            privateKey,
            salt
          );
          proof = {
            id: `name_proof_${Date.now()}`,
            type: 'name',
            proofType: 'name',
            did: `did:mina:${publicKey.toBase58()}`,
            proof: JSON.stringify({
              commitment: nameProof.commitment,
              signature: nameProof.signature,
              publicKey: publicKey.toBase58(),
            }),
            selectiveDisclosure: {
              salt,
              name: nameProof,
            },
            timestamp: Date.now(),
            metadata: {
              proofId: `name_${Date.now()}`,
              generatedAt: new Date().toISOString(),
            }
          };
          break;
        case 'citizenship':
          const citizenshipProof = generateCitizenshipZKProof(
            parsedAadhar.country || 'India',
            privateKey,
            salt
          );
          proof = {
            id: `citizenship_proof_${Date.now()}`,
            type: 'citizenship',
            proofType: 'citizenship',
            did: `did:mina:${publicKey.toBase58()}`,
            proof: JSON.stringify({
              commitment: citizenshipProof.commitment,
              signature: citizenshipProof.signature,
              publicKey: publicKey.toBase58(),
            }),
            selectiveDisclosure: {
              salt,
              citizenship: citizenshipProof,
            },
            timestamp: Date.now(),
            metadata: {
              proofId: `citizenship_${Date.now()}`,
              generatedAt: new Date().toISOString(),
            }
          };
          break;
        case 'kyc':
          proof = await generateKYCProof(parsedAadhar, privateKey, ['identity', 'name']);
          proof = {
            ...proof,
            id: `kyc_proof_${Date.now()}`,
            proofType: 'kyc',
            did: `did:mina:${publicKey.toBase58()}`,
            selectiveDisclosure: { salt },
            metadata: { proofId: `kyc_${Date.now()}`, generatedAt: new Date().toISOString() }
          };
          break;
      }
      
      if (proof) {
        const proofs = JSON.parse(localStorage.getItem(`proofs_${userIdentifier}`) || '[]');
        proofs.push({ ...proof, generatedAt: Date.now(), proofType });
        localStorage.setItem(`proofs_${userIdentifier}`, JSON.stringify(proofs));
        
        setGeneratedProof(proof);
        
        if (onGenerateProof) {
          onGenerateProof(selectedCredential, proofType);
        }
      }
    } catch (error: any) {
      console.error('Failed to generate proof:', error);
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
                <p className="text-gray-600">Generating ZK proof with your wallet signature...</p>
                <p className="text-xs text-gray-400 mt-2">This may take a few seconds</p>
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
                    {generatedProof.id || generatedProof.metadata?.proofId}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={downloadProof}
                    className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                  >
                    📥 Download Proof
                  </button>
                  <button
                    onClick={() => {
                      setShowProofOptions(false);
                      setGeneratedProof(null);
                    }}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                  >
                    Close
                  </button>
                </div>
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
    </div>
  );
}
