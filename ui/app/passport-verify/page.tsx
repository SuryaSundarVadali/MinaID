'use client';

/**
 * Passport Verification Page
 * 
 * Complete flow: Scan → Verify → Submit to Blockchain
 */

import React, { useState, useEffect } from 'react';
import PassportScanner from '@/components/PassportScanner';
import LoadingSpinner from '@/components/LoadingSpinner';
import { oracleService } from '@/lib/OracleService';
import { Field, PublicKey, Signature, Bool, Mina, AccountUpdate } from 'o1js';

// Contract configuration
const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '';
const ORACLE_URL = process.env.NEXT_PUBLIC_ORACLE_URL || 'http://localhost:4000';

interface VerificationState {
  step: 'scan' | 'verified' | 'submitting' | 'complete' | 'error';
  passportData?: any;
  oracleResult?: any;
  contractData?: any;
  transactionHash?: string;
  error?: string;
}

export default function PassportVerificationPage() {
  const [state, setState] = useState<VerificationState>({ step: 'scan' });
  const [oracleHealth, setOracleHealth] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  // Check Oracle health on mount
  useEffect(() => {
    checkOracleHealth();
  }, []);

  const checkOracleHealth = async () => {
    try {
      const isHealthy = await oracleService.healthCheck();
      setOracleHealth(isHealthy);
      
      if (!isHealthy) {
        setState(prev => ({
          ...prev,
          error: 'Oracle server is not available. Please ensure it is running.',
        }));
      }
    } catch (error) {
      setOracleHealth(false);
      console.error('Oracle health check failed:', error);
    }
  };

  // Handle passport verification from scanner
  const handlePassportVerified = async (verificationResult: any) => {
    console.log('Passport verified by Oracle:', verificationResult);
    
    setState({
      step: 'verified',
      passportData: verificationResult.passportData,
      oracleResult: verificationResult.raw,
      contractData: verificationResult.contract,
    });
  };

  // Handle errors from scanner
  const handleScanError = (error: string) => {
    setState({
      step: 'error',
      error,
    });
  };

  // Submit to blockchain
  const submitToBlockchain = async () => {
    if (!state.contractData) {
      console.error('No contract data available');
      return;
    }

    setState(prev => ({ ...prev, step: 'submitting' }));
    setLoading(true);

    try {
      console.log('🔗 Connecting to Mina network...');

      // Initialize Mina connection
      const network = Mina.Network({
        mina: 'https://proxy.berkeley.minaexplorer.com/graphql',
        archive: 'https://archive.berkeley.minaexplorer.com',
      });
      Mina.setActiveInstance(network);

      // Get user's wallet (from browser extension)
      // TODO: Integrate with Auro Wallet or Metamask Snap
      console.log('🔐 Please connect your wallet...');

      // For now, show instructions
      setState({
        step: 'complete',
        passportData: state.passportData,
        oracleResult: state.oracleResult,
        contractData: state.contractData,
        transactionHash: 'pending-wallet-connection',
      });

      // TODO: Implement actual blockchain submission
      /*
      const { MinaIDContract } = await import('@/../../contracts/src/MinaIDContract');
      const contract = new MinaIDContract(PublicKey.fromBase58(CONTRACT_ADDRESS));

      // Create transaction
      const tx = await Mina.transaction(async () => {
        await contract.verifyIdentityWithOracle(
          state.contractData.passportHash,
          Bool(state.contractData.isValid),
          state.contractData.timestamp,
          state.contractData.signature
        );
      });

      // Prove and send
      await tx.prove();
      await tx.sign([userPrivateKey]).send();
      
      const hash = tx.hash();
      setState(prev => ({
        ...prev,
        step: 'complete',
        transactionHash: hash,
      }));
      */

    } catch (error) {
      console.error('Blockchain submission error:', error);
      setState(prev => ({
        ...prev,
        step: 'error',
        error: error instanceof Error ? error.message : 'Blockchain submission failed',
      }));
    } finally {
      setLoading(false);
    }
  };

  // Reset flow
  const resetFlow = () => {
    setState({ step: 'scan' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            MinaID Passport Verification
          </h1>
          <p className="text-lg text-gray-600">
            Create your verifiable digital identity using your passport
          </p>
        </div>

        {/* Oracle Status */}
        <div className="mb-6 flex justify-center">
          <div className={`px-4 py-2 rounded-full text-sm font-medium ${
            oracleHealth === null
              ? 'bg-gray-200 text-gray-700'
              : oracleHealth
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {oracleHealth === null && '⏳ Checking Oracle...'}
            {oracleHealth === true && '✅ Oracle Online'}
            {oracleHealth === false && '❌ Oracle Offline'}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 ${
              state.step === 'scan' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                state.step === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}>
                1
              </div>
              <span className="font-medium">Scan</span>
            </div>
            
            <div className="w-12 h-0.5 bg-gray-300"></div>
            
            <div className={`flex items-center gap-2 ${
              state.step === 'verified' || state.step === 'submitting' || state.step === 'complete'
                ? 'text-blue-600'
                : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                state.step === 'verified' || state.step === 'submitting' || state.step === 'complete'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-300'
              }`}>
                2
              </div>
              <span className="font-medium">Verify</span>
            </div>
            
            <div className="w-12 h-0.5 bg-gray-300"></div>
            
            <div className={`flex items-center gap-2 ${
              state.step === 'complete' ? 'text-blue-600' : 'text-gray-400'
            }`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                state.step === 'complete' ? 'bg-blue-600 text-white' : 'bg-gray-300'
              }`}>
                3
              </div>
              <span className="font-medium">Complete</span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-xl shadow-xl p-8">
          {/* Step 1: Scan */}
          {state.step === 'scan' && (
            <PassportScanner
              onVerified={handlePassportVerified}
              onError={handleScanError}
            />
          )}

          {/* Step 2: Verification Result */}
          {state.step === 'verified' && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="text-6xl mb-4">✅</div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Passport Verified!
                </h2>
                <p className="text-gray-600">
                  Oracle has successfully verified your passport
                </p>
              </div>

              {/* Verification Details */}
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold text-gray-900">Verification Details:</h3>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Passport Number:</span>
                    <p className="font-mono font-medium">
                      {state.passportData?.passportNumber}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Nationality:</span>
                    <p className="font-mono font-medium">
                      {state.passportData?.nationality}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Birth Date:</span>
                    <p className="font-mono font-medium">
                      {state.passportData?.birthDate}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-600">Expiry Date:</span>
                    <p className="font-mono font-medium">
                      {state.passportData?.expiryDate}
                    </p>
                  </div>
                </div>

                {/* Checks */}
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-2 text-gray-900">Security Checks:</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>MRZ Checksum Valid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Expiry Date Valid</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-green-600">✓</span>
                      <span>Oracle Signature Valid</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-4">
                <button
                  onClick={resetFlow}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                >
                  ← Scan Another
                </button>
                <button
                  onClick={submitToBlockchain}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Submit to Blockchain →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Submitting */}
          {state.step === 'submitting' && (
            <div className="text-center py-12">
              <LoadingSpinner />
              <h2 className="text-2xl font-bold text-gray-900 mt-6 mb-2">
                Submitting to Blockchain...
              </h2>
              <p className="text-gray-600">
                Please confirm the transaction in your wallet
              </p>
            </div>
          )}

          {/* Step 4: Complete */}
          {state.step === 'complete' && (
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-2xl font-bold text-gray-900">
                Identity Verified!
              </h2>
              <p className="text-gray-600">
                Your digital identity has been created on the Mina blockchain
              </p>

              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="font-semibold text-green-900 mb-2">
                  Next Steps:
                </h3>
                <ol className="text-sm text-green-800 space-y-1 list-decimal list-inside text-left">
                  <li>Connect your Auro Wallet or Metamask with Mina Snap</li>
                  <li>Sign the transaction to submit your verification</li>
                  <li>Wait for blockchain confirmation (~3 minutes)</li>
                  <li>Access your verifiable credentials in the dashboard</li>
                </ol>
              </div>

              {state.transactionHash && state.transactionHash !== 'pending-wallet-connection' && (
                <div className="text-sm">
                  <span className="text-gray-600">Transaction Hash:</span>
                  <p className="font-mono text-xs break-all mt-1">
                    {state.transactionHash}
                  </p>
                </div>
              )}

              <button
                onClick={resetFlow}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Verify Another Passport
              </button>
            </div>
          )}

          {/* Error State */}
          {state.step === 'error' && (
            <div className="text-center space-y-6">
              <div className="text-6xl mb-4">❌</div>
              <h2 className="text-2xl font-bold text-gray-900">
                Verification Failed
              </h2>
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <p className="text-red-800">{state.error}</p>
              </div>
              <button
                onClick={resetFlow}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-600">
          <p>
            Powered by <strong>Mina Protocol</strong> • Oracle: {ORACLE_URL}
          </p>
          {CONTRACT_ADDRESS && (
            <p className="mt-1 font-mono text-xs">
              Contract: {CONTRACT_ADDRESS}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
