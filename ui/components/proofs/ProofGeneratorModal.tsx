/**
 * ProofGeneratorModal.tsx
 * 
 * Modal for generating zero-knowledge proofs
 * Supports age verification, KYC, and composite proofs
 */

'use client';

import React, { useState } from 'react';
import { useWallet } from '../../context/WalletContext';
import { PrivateKey } from 'o1js';
import { generateAgeProof } from '../../lib/ProofGenerator';
import { ProofStorage } from '../../lib/ProofStorage';
import type { AadharData } from '../../lib/AadharParser';
import { rateLimiter, RateLimitConfigs, formatTimeRemaining } from '../../lib/RateLimiter';
import { validateAge, validateCredentialData } from '../../lib/InputValidator';
import { logSecurityEvent } from '../../lib/SecurityUtils';

type ProofType = 'age' | 'kyc' | 'composite';

interface ProofGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProofGenerated?: (proof: any) => void;
}

interface ProofGenerationState {
  step: 'select' | 'configure' | 'generating' | 'success' | 'error';
  proofType?: ProofType;
  config: {
    minimumAge?: number;
    ageRange?: { min: number; max: number };
    kycAttributes?: string[];
  };
  error?: string;
  generatedProof?: any;
  progress: number;
}

export function ProofGeneratorModal({ 
  isOpen, 
  onClose, 
  onProofGenerated 
}: ProofGeneratorModalProps) {
  const { session, loadPrivateKey } = useWallet();
  
  const [state, setState] = useState<ProofGenerationState>({
    step: 'select',
    config: {},
    progress: 0,
  });

  const handleSelectProofType = (type: ProofType) => {
    setState(prev => ({
      ...prev,
      step: 'configure',
      proofType: type,
    }));
  };

  const handleGenerateProof = async () => {
    if (!session) {
      setState(prev => ({ ...prev, error: 'No active session' }));
      return;
    }

    // Rate limiting check
    const rateLimitKey = `proof_gen:${session.did}`;
    if (!rateLimiter.isAllowed(rateLimitKey, RateLimitConfigs.PROOF_GENERATION)) {
      const timeRemaining = rateLimiter.getTimeUntilUnblocked(rateLimitKey);
      setState(prev => ({ 
        ...prev, 
        error: `Rate limit exceeded. Please try again in ${formatTimeRemaining(timeRemaining)}.` 
      }));
      return;
    }

    // Validate age input
    if (state.proofType === 'age' && state.config.minimumAge) {
      const ageValidation = validateAge(state.config.minimumAge);
      if (!ageValidation.valid) {
        setState(prev => ({ ...prev, error: ageValidation.error }));
        return;
      }
    }

    setState(prev => ({ ...prev, step: 'generating', progress: 10 }));

    try {
      // Step 1: Load private key with Passkey
      setState(prev => ({ ...prev, progress: 20 }));
      const privateKeyString = await loadPrivateKey('auro', session.passkeyId, session.did);
      const privateKey = PrivateKey.fromBase58(privateKeyString);

      // Step 2: Load credential data
      setState(prev => ({ ...prev, progress: 40 }));
      const credentialData = await loadCredentialData(state.proofType!);
      
      if (!credentialData) {
        throw new Error('Failed to load credential data');
      }

      // Validate credential data
      const credentialValidation = validateCredentialData(credentialData);
      if (!credentialValidation.valid) {
        throw new Error(`Invalid credential data: ${credentialValidation.error}`);
      }

      // Step 3: Generate ZK proof based on type
      setState(prev => ({ ...prev, progress: 60 }));
      let proof: any = null;
      
      switch (state.proofType) {
        case 'age':
          proof = await generateAgeProofInternal(
            credentialData,
            state.config.minimumAge || 18,
            privateKey
          );
          break;
        case 'kyc':
          proof = await generateKYCProof(
            credentialData,
            state.config.kycAttributes || [],
            privateKey
          );
          break;
        case 'composite':
          proof = await generateCompositeProof(
            credentialData,
            state.config,
            privateKey
          );
          break;
      }

      setState(prev => ({ ...prev, progress: 80 }));

      // Step 4: Save proof locally
      await saveProofToStorage(proof, session.did);

      // Log successful proof generation
      logSecurityEvent('proof_generated', { 
        proofType: state.proofType, 
        proofId: proof.id 
      }, 'info');

      setState(prev => ({
        ...prev,
        step: 'success',
        progress: 100,
        generatedProof: proof,
      }));

      if (onProofGenerated) {
        onProofGenerated(proof);
      }

    } catch (error: any) {
      console.error('[ProofGenerator] Failed:', error);
      
      // Log failed proof generation
      logSecurityEvent('proof_generation_failed', { 
        proofType: state.proofType,
        error: error.message 
      }, 'error');
      
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error.message || 'Proof generation failed',
      }));
    }
  };

  const handleClose = () => {
    setState({
      step: 'select',
      config: {},
      progress: 0,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
          {/* Close Button */}
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Content */}
          {state.step === 'select' && (
            <SelectProofType onSelect={handleSelectProofType} />
          )}

          {state.step === 'configure' && (
            <ConfigureProof
              proofType={state.proofType!}
              config={state.config}
              onConfigChange={(config) => setState(prev => ({ ...prev, config }))}
              onGenerate={handleGenerateProof}
              onBack={() => setState(prev => ({ ...prev, step: 'select' }))}
            />
          )}

          {state.step === 'generating' && (
            <GeneratingProof progress={state.progress} proofType={state.proofType!} />
          )}

          {state.step === 'success' && (
            <ProofSuccess proof={state.generatedProof} onClose={handleClose} />
          )}

          {state.step === 'error' && (
            <ProofError error={state.error!} onRetry={handleGenerateProof} onClose={handleClose} />
          )}
        </div>
      </div>
    </div>
  );
}

// Sub-components

function SelectProofType({ onSelect }: { onSelect: (type: ProofType) => void }) {
  const proofTypes = [
    {
      type: 'age' as ProofType,
      icon: '🎂',
      title: 'Age Verification',
      description: 'Prove you are above a certain age without revealing your exact age',
      examples: ['18+', '21+', 'Age range'],
    },
    {
      type: 'kyc' as ProofType,
      icon: '✅',
      title: 'KYC Status',
      description: 'Prove KYC compliance without revealing personal details',
      examples: ['Identity verified', 'Address verified'],
    },
    {
      type: 'composite' as ProofType,
      icon: '🔗',
      title: 'Composite Proof',
      description: 'Combine multiple proofs into one',
      examples: ['Age + KYC', 'Multiple attributes'],
    },
  ];

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Generate Proof</h2>
      <p className="text-gray-600 mb-6">
        Select the type of zero-knowledge proof you want to generate
      </p>

      <div className="space-y-4">
        {proofTypes.map((pt) => (
          <button
            key={pt.type}
            onClick={() => onSelect(pt.type)}
            className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
          >
            <div className="flex items-start space-x-4">
              <div className="text-4xl">{pt.icon}</div>
              <div className="flex-1">
                <h3 className="font-bold text-gray-900 group-hover:text-indigo-600 mb-1">
                  {pt.title}
                </h3>
                <p className="text-sm text-gray-600 mb-2">{pt.description}</p>
                <div className="flex flex-wrap gap-2">
                  {pt.examples.map((example, idx) => (
                    <span
                      key={idx}
                      className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                    >
                      {example}
                    </span>
                  ))}
                </div>
              </div>
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-indigo-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function ConfigureProof({
  proofType,
  config,
  onConfigChange,
  onGenerate,
  onBack,
}: {
  proofType: ProofType;
  config: ProofGenerationState['config'];
  onConfigChange: (config: ProofGenerationState['config']) => void;
  onGenerate: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-4 text-gray-600 hover:text-gray-900 flex items-center text-sm"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-2xl font-bold text-gray-900 mb-6">
        Configure {proofType === 'age' ? 'Age' : proofType === 'kyc' ? 'KYC' : 'Composite'} Proof
      </h2>

      {proofType === 'age' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Minimum Age Required
            </label>
            <div className="flex space-x-2">
              {[18, 21, 25, 30].map((age) => (
                <button
                  key={age}
                  onClick={() => onConfigChange({ ...config, minimumAge: age })}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    config.minimumAge === age
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {age}+
                </button>
              ))}
            </div>
            <input
              type="number"
              value={config.minimumAge || 18}
              onChange={(e) => onConfigChange({ ...config, minimumAge: parseInt(e.target.value) })}
              className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              placeholder="Custom age"
            />
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              <strong>ℹ️ Privacy Note:</strong> The verifier will only learn that you are {config.minimumAge || 18}+ years old. Your exact age remains private.
            </p>
          </div>
        </div>
      )}

      {proofType === 'kyc' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              KYC Attributes to Prove
            </label>
            {['Identity Verified', 'Address Verified', 'Phone Verified', 'Email Verified'].map((attr) => (
              <label key={attr} className="flex items-center space-x-2 mb-2">
                <input
                  type="checkbox"
                  checked={config.kycAttributes?.includes(attr)}
                  onChange={(e) => {
                    const attrs = config.kycAttributes || [];
                    if (e.target.checked) {
                      onConfigChange({ ...config, kycAttributes: [...attrs, attr] });
                    } else {
                      onConfigChange({ ...config, kycAttributes: attrs.filter(a => a !== attr) });
                    }
                  }}
                  className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                />
                <span className="text-gray-700">{attr}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onGenerate}
        disabled={
          (proofType === 'age' && !config.minimumAge) ||
          (proofType === 'kyc' && (!config.kycAttributes || config.kycAttributes.length === 0))
        }
        className="mt-6 w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Generate Proof
      </button>
    </div>
  );
}

function GeneratingProof({ progress, proofType }: { progress: number; proofType: ProofType }) {
  const steps = [
    { label: 'Authenticating with Passkey', progress: 20 },
    { label: 'Loading credential data', progress: 40 },
    { label: 'Generating zero-knowledge proof', progress: 60 },
    { label: 'Saving proof', progress: 80 },
    { label: 'Complete', progress: 100 },
  ];

  const currentStep = steps.findIndex(s => progress <= s.progress);

  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-6 animate-pulse">🔐</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Generating {proofType === 'age' ? 'Age' : proofType === 'kyc' ? 'KYC' : 'Composite'} Proof
      </h2>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Steps */}
      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div
            key={idx}
            className={`flex items-center space-x-3 ${
              idx < currentStep ? 'opacity-50' : idx === currentStep ? '' : 'opacity-30'
            }`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
              idx < currentStep ? 'bg-green-500 text-white' : 'bg-gray-300'
            }`}>
              {idx < currentStep ? '✓' : idx + 1}
            </div>
            <span className="text-sm text-gray-700">{step.label}</span>
          </div>
        ))}
      </div>

      <p className="mt-8 text-sm text-gray-500">
        This may take a minute... Zero-knowledge proofs require complex cryptographic computations.
      </p>
    </div>
  );
}

function ProofSuccess({ proof, onClose }: { proof: any; onClose: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-6">✅</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Proof Generated Successfully!
      </h2>
      <p className="text-gray-600 mb-8">
        Your zero-knowledge proof is ready to share with verifiers.
      </p>

      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-green-800">
          <strong>Proof ID:</strong> {proof?.id || 'proof_' + Date.now()}
        </p>
        <p className="text-xs text-green-600 mt-1">
          Generated: {new Date().toLocaleString()}
        </p>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Close
        </button>
        <button
          onClick={() => alert('Share proof feature coming soon!')}
          className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Share Proof
        </button>
      </div>
    </div>
  );
}

function ProofError({ error, onRetry, onClose }: { error: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div className="text-center py-8">
      <div className="text-6xl mb-6">⚠️</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        Proof Generation Failed
      </h2>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p className="text-sm text-red-800">{error}</p>
      </div>

      <div className="flex space-x-3">
        <button
          onClick={onClose}
          className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
        >
          Cancel
        </button>
        <button
          onClick={onRetry}
          className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Helper functions

async function loadCredentialData(proofType: ProofType): Promise<AadharData | null> {
  try {
    const aadharDataStr = localStorage.getItem('minaid_aadhar_data');
    if (!aadharDataStr) {
      throw new Error('No Aadhar credential found. Please upload your credential first.');
    }
    return JSON.parse(aadharDataStr) as AadharData;
  } catch (error) {
    console.error('[ProofGenerator] Failed to load credential:', error);
    throw error;
  }
}

async function generateAgeProofInternal(credentialData: AadharData, minimumAge: number, privateKey: PrivateKey) {
  // Use the actual proof generator from lib
  const { generateAgeProof: libGenerateAgeProof } = await import('../../lib/ProofGenerator');
  
  const proof = await libGenerateAgeProof(
    credentialData,
    minimumAge,
    privateKey
  );
  
  return {
    id: `age_proof_${Date.now()}`,
    type: 'age' as const,
    minimumAge,
    timestamp: Date.now(),
    proofData: JSON.stringify(proof),
  };
}

async function generateKYCProof(credentialData: AadharData, attributes: string[], privateKey: PrivateKey) {
  // TODO: Implement KYC proof generation with actual ZK program
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    id: `kyc_proof_${Date.now()}`,
    type: 'kyc' as const,
    attributes,
    timestamp: Date.now(),
    proofData: JSON.stringify({ attributes }),
  };
}

async function generateCompositeProof(credentialData: AadharData, config: any, privateKey: PrivateKey) {
  // TODO: Implement composite proof generation
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  return {
    id: `composite_proof_${Date.now()}`,
    type: 'composite' as const,
    timestamp: Date.now(),
    proofData: JSON.stringify(config),
  };
}

async function saveProofToStorage(proof: any, did: string) {
  ProofStorage.saveProof({
    type: proof.type,
    status: 'pending',
    metadata: {
      proofType: proof.type,
      minimumAge: proof.minimumAge,
      kycAttributes: proof.attributes,
    },
    proofData: proof.proofData,
    did,
  });
}
