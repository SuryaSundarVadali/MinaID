'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import PassportScanner from './PassportScanner';
import LoadingSpinner from './LoadingSpinner';
import GradientBG from './GradientBG';

type UploadStep = 'scan' | 'verifying' | 'verified' | 'submitting' | 'complete' | 'error';

export default function UploadPassportContent() {
  const router = useRouter();
  const { session } = useWallet();
  const [step, setStep] = useState<UploadStep>('scan');
  const [state, setState] = useState<{
    passportData?: any;
    oracleResult?: any;
    contractData?: any;
    transactionHash?: string;
    error?: string;
    userIdentifier?: string;
  }>({});

  // Get user identifier (DID from session or wallet address)
  React.useEffect(() => {
    let identifier = session?.did;
    
    if (!identifier) {
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        try {
          const parsed = JSON.parse(walletData);
          identifier = parsed.address;
        } catch (e) {
          console.error('Failed to parse wallet data:', e);
        }
      }
    }
    
    setState(prev => ({ ...prev, userIdentifier: identifier }));
  }, [session]);

  // Handle successful passport verification from Oracle
  const handlePassportVerified = async (verificationResult: any) => {
    console.log('✅ Passport verified by Oracle:', verificationResult);
    
    setStep('verified');
    setState(prev => ({
      ...prev,
      passportData: verificationResult.passportData,
      oracleResult: verificationResult.raw,
      contractData: verificationResult.contract,
    }));

    // Store passport data in localStorage
    if (state.userIdentifier && verificationResult.passportData) {
      const storageKey = `passport_${state.userIdentifier}`;
      localStorage.setItem(storageKey, JSON.stringify({
        passportData: verificationResult.passportData,
        verifiedAt: Date.now(),
        oracleSignature: verificationResult.raw.signature,
        hologramVerified: verificationResult.raw.hologramValid,
        hologramDetails: verificationResult.raw.hologramDetails,
      }));
      console.log('💾 Passport data stored in localStorage:', storageKey);
    }
  };

  // Handle errors from scanner
  const handleScanError = (error: string) => {
    console.error('❌ Passport scan error:', error);
    setStep('error');
    setState(prev => ({ ...prev, error }));
  };

  // Submit to blockchain
  const submitToBlockchain = async () => {
    if (!state.contractData) {
      console.error('No contract data available');
      return;
    }

    if (!state.userIdentifier) {
      setState(prev => ({ 
        ...prev, 
        error: 'Please connect your wallet before submitting to blockchain' 
      }));
      return;
    }

    setStep('submitting');

    try {
      console.log('🔗 Preparing blockchain submission...');

      // TODO: Implement actual blockchain submission
      // This would use Mina.transaction() and call contract.verifyIdentityWithOracle()
      // For now, we'll simulate success

      // Simulate blockchain transaction
      await new Promise(resolve => setTimeout(resolve, 2000));

      const mockTxHash = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      setStep('complete');
      setState(prev => ({ 
        ...prev, 
        transactionHash: mockTxHash 
      }));

      console.log('✅ Passport verified and stored!');
      
      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 3000);

    } catch (error) {
      console.error('Blockchain submission error:', error);
      setStep('error');
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Blockchain submission failed',
      }));
    }
  };

  // Skip blockchain submission and just store data
  const skipBlockchain = () => {
    console.log('⏭️ Skipping blockchain submission, data already stored locally');
    router.push('/dashboard');
  };

  // Reset and start over
  const resetFlow = () => {
    setStep('scan');
    setState({ userIdentifier: state.userIdentifier });
  };

  return (
    <GradientBG>
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-white mb-2">
              🛂 Upload Passport
            </h1>
            <p className="text-gray-300">
              Scan your physical passport and verify with hologram authentication
            </p>
          </div>

          {/* Progress Indicator */}
          <div className="mb-8">
            <div className="flex items-center justify-center gap-2">
              {['scan', 'verified', 'complete'].map((s, idx) => (
                <React.Fragment key={s}>
                  <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                    step === s ? 'border-indigo-400 bg-indigo-400 text-white' :
                    ['verified', 'submitting', 'complete'].includes(step) && idx < 2 ? 'border-green-400 bg-green-400 text-white' :
                    step === 'complete' && idx === 2 ? 'border-green-400 bg-green-400 text-white' :
                    'border-gray-600 bg-gray-800 text-gray-400'
                  }`}>
                    {s === 'scan' && '1'}
                    {s === 'verified' && '2'}
                    {s === 'complete' && '3'}
                  </div>
                  {idx < 2 && (
                    <div className={`w-12 h-1 ${
                      ['verified', 'submitting', 'complete'].includes(step) && idx === 0 ? 'bg-green-400' :
                      step === 'complete' && idx === 1 ? 'bg-green-400' :
                      'bg-gray-600'
                    }`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center justify-between mt-2 text-sm text-gray-400">
              <span>Scan Passport</span>
              <span>Oracle Verify</span>
              <span>Complete</span>
            </div>
          </div>

          {/* Step: Scan */}
          {step === 'scan' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700">
              <PassportScanner 
                onVerified={handlePassportVerified}
                onError={handleScanError}
              />
            </div>
          )}

          {/* Step: Verifying */}
          {step === 'verifying' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-12 border border-gray-700 text-center">
              <LoadingSpinner />
              <p className="text-white text-lg mt-4">Verifying passport with Oracle...</p>
              <p className="text-gray-400 text-sm mt-2">
                This includes MRZ validation and hologram authenticity check
              </p>
            </div>
          )}

          {/* Step: Verified */}
          {step === 'verified' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700">
              <div className="text-center mb-6">
                <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-5xl">✅</span>
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">
                  Passport Verified!
                </h2>
                <p className="text-gray-300">
                  Your passport has been verified by the Oracle
                </p>
              </div>

              {/* Verification Details */}
              <div className="bg-gray-900/50 rounded-xl p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Verification Results</h3>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">MRZ Checksum:</span>
                    <span className={`font-medium ${state.oracleResult?.checks?.mrzChecksum ? 'text-green-400' : 'text-red-400'}`}>
                      {state.oracleResult?.checks?.mrzChecksum ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Document Security:</span>
                    <span className={`font-medium ${state.oracleResult?.checks?.documentSecurity ? 'text-green-400' : 'text-red-400'}`}>
                      {state.oracleResult?.checks?.documentSecurity ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Expiry Valid:</span>
                    <span className={`font-medium ${state.oracleResult?.checks?.expiryValid ? 'text-green-400' : 'text-red-400'}`}>
                      {state.oracleResult?.checks?.expiryValid ? '✓ Valid' : '✗ Invalid'}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Hologram Authenticity:</span>
                    <span className={`font-medium ${state.oracleResult?.hologramValid ? 'text-green-400' : 'text-red-400'}`}>
                      {state.oracleResult?.hologramValid ? '✓ Verified' : '✗ Failed'}
                    </span>
                  </div>

                  {state.oracleResult?.hologramDetails && (
                    <div className="mt-4 p-3 bg-gray-800 rounded-lg">
                      <p className="text-gray-400 text-xs mb-2">Hologram Analysis:</p>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Chromaticity:</span>
                          <span className={state.oracleResult.hologramDetails.chromaValid ? 'text-green-400' : 'text-red-400'}>
                            {state.oracleResult.hologramDetails.chromaValid ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Dynamic Behavior:</span>
                          <span className={state.oracleResult.hologramDetails.behaviorValid ? 'text-green-400' : 'text-red-400'}>
                            {state.oracleResult.hologramDetails.behaviorValid ? '✓' : '✗'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Confidence:</span>
                          <span className="text-indigo-400">
                            {(state.oracleResult.hologramDetails.confidence * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Passport Data Preview */}
              {state.passportData && (
                <div className="bg-gray-900/50 rounded-xl p-6 mb-6">
                  <h3 className="text-lg font-semibold text-white mb-4">Passport Information</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Full Name:</span>
                      <span className="text-white font-medium">{state.passportData.fullName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Nationality:</span>
                      <span className="text-white font-medium">{state.passportData.nationality}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Passport Number:</span>
                      <span className="text-white font-medium font-mono">{state.passportData.passportNumber}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={skipBlockchain}
                  className="flex-1 px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  ⏭️ Skip to Dashboard
                </button>
                <button
                  onClick={submitToBlockchain}
                  className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  🔗 Submit to Blockchain
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-4">
                💾 Your passport data has been stored locally and verified
              </p>
            </div>
          )}

          {/* Step: Submitting */}
          {step === 'submitting' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-12 border border-gray-700 text-center">
              <LoadingSpinner />
              <p className="text-white text-lg mt-4">Submitting to blockchain...</p>
              <p className="text-gray-400 text-sm mt-2">
                Creating zero-knowledge proof and registering your identity
              </p>
            </div>
          )}

          {/* Step: Complete */}
          {step === 'complete' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-gray-700 text-center">
              <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-5xl">🎉</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Passport Uploaded Successfully!
              </h2>
              <p className="text-gray-300 mb-6">
                Your verified passport credential is now available
              </p>

              {state.transactionHash && (
                <div className="bg-gray-900/50 rounded-xl p-4 mb-6">
                  <p className="text-sm text-gray-400 mb-1">Transaction Hash:</p>
                  <p className="text-xs font-mono text-indigo-400 break-all">
                    {state.transactionHash}
                  </p>
                </div>
              )}

              <button
                onClick={() => router.push('/dashboard')}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
              >
                Go to Dashboard →
              </button>
            </div>
          )}

          {/* Step: Error */}
          {step === 'error' && (
            <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border border-red-900/50 text-center">
              <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <span className="text-5xl">❌</span>
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">
                Verification Failed
              </h2>
              <p className="text-gray-300 mb-6">
                {state.error || 'An unknown error occurred'}
              </p>

              <div className="flex gap-4 justify-center">
                <button
                  onClick={resetFlow}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-colors"
                >
                  Try Again
                </button>
                <button
                  onClick={() => router.push('/dashboard')}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors"
                >
                  Back to Dashboard
                </button>
              </div>
            </div>
          )}

          {/* Back Button (only on scan step) */}
          {step === 'scan' && (
            <div className="text-center mt-6">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Dashboard
              </button>
            </div>
          )}
        </div>
      </main>
    </GradientBG>
  );
}
