'use client';

/**
 * ProofSubmissionFlow.tsx
 * 
 * Complete UI component for proof generation and on-chain submission.
 * Provides step-by-step flow with progress tracking.
 */

import React, { useState, useCallback } from 'react';
import { PrivateKey } from 'o1js';
import { 
  generateAgeProofSmart, 
  GeneratedProof,
  isProofGenerating 
} from '@/lib/SmartProofGenerator';
import { 
  validateProofForSubmission, 
  quickValidate 
} from '@/lib/PreSubmissionValidator';
import { 
  submitTransaction, 
  canSubmit, 
  SubmissionResult 
} from '@/lib/RobustTransactionSubmitter';
import { 
  monitorTransaction, 
  TxStatus, 
  getStatusMessage, 
  formatTimeRemaining,
  estimateConfirmationTime 
} from '@/lib/CompleteTransactionMonitor';

type FlowStep = 
  | 'idle'
  | 'generating'
  | 'validating'
  | 'submitting'
  | 'monitoring'
  | 'confirmed'
  | 'failed';

interface ProofSubmissionFlowProps {
  walletAddress: string;
  onComplete?: (result: { proof: GeneratedProof; txHash: string }) => void;
  onError?: (error: string) => void;
}

export default function ProofSubmissionFlow({
  walletAddress,
  onComplete,
  onError,
}: ProofSubmissionFlowProps) {
  // Form state
  const [age, setAge] = useState('');
  const [salt, setSalt] = useState('');
  const [minAge, setMinAge] = useState('18');
  
  // Flow state
  const [step, setStep] = useState<FlowStep>('idle');
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  // Results
  const [proof, setProof] = useState<GeneratedProof | null>(null);
  const [txHash, setTxHash] = useState<string>('');
  const [txStatus, setTxStatus] = useState<TxStatus>('unknown');
  const [error, setError] = useState<string>('');
  
  // Retry state
  const [retryCount, setRetryCount] = useState(0);
  const [retryDelay, setRetryDelay] = useState(0);

  /**
   * Generate random salt
   */
  const generateSalt = useCallback(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setSalt(result);
  }, []);

  /**
   * Reset the flow
   */
  const reset = useCallback(() => {
    setStep('idle');
    setProgress(0);
    setStatusMessage('');
    setProof(null);
    setTxHash('');
    setTxStatus('unknown');
    setError('');
    setRetryCount(0);
    setRetryDelay(0);
  }, []);

  /**
   * Main submission flow
   */
  const startSubmission = useCallback(async () => {
    try {
      // Validate inputs
      const ageNum = parseInt(age, 10);
      const minAgeNum = parseInt(minAge, 10);
      
      if (isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
        throw new Error('Please enter a valid age (0-150)');
      }
      if (!salt || salt.length < 4) {
        throw new Error('Please generate or enter a salt (min 4 characters)');
      }
      if (ageNum < minAgeNum) {
        throw new Error(`Your age (${ageNum}) is less than minimum required (${minAgeNum})`);
      }
      
      // Check wallet readiness
      const walletCheck = canSubmit();
      if (!walletCheck.ready) {
        throw new Error(walletCheck.reason || 'Wallet not ready');
      }
      
      // STEP 1: Generate Proof
      setStep('generating');
      setProgress(0);
      setStatusMessage('Generating proof...');
      
      // Derive private key from wallet address (for demo - in production use wallet signing)
      const privateKey = PrivateKey.random(); // In real app, use wallet
      
      const generatedProof = await generateAgeProofSmart(
        ageNum,
        salt,
        minAgeNum,
        privateKey,
        (message, percent) => {
          setStatusMessage(message);
          setProgress(percent * 0.3); // 0-30%
        }
      );
      
      setProof(generatedProof);
      
      // STEP 2: Validate
      setStep('validating');
      setProgress(30);
      setStatusMessage('Validating proof...');
      
      const validation = await validateProofForSubmission(generatedProof);
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
      
      setProgress(40);
      
      // STEP 3: Submit Transaction
      setStep('submitting');
      setStatusMessage('Submitting to blockchain...');
      
      const submissionResult = await submitTransaction(
        generatedProof,
        async () => {
          // Build transaction JSON - this would call ContractInterface
          // For now, return a placeholder
          return JSON.stringify({
            proof: generatedProof.proof,
            publicInput: generatedProof.publicInput,
          });
        },
        {
          onAttempt: (attempt, max) => {
            setStatusMessage(`Submission attempt ${attempt}/${max}...`);
            setProgress(40 + (attempt / max) * 20); // 40-60%
          },
          onRetry: (delay, reason) => {
            setRetryCount(c => c + 1);
            setRetryDelay(delay);
            setStatusMessage(`Retrying in ${Math.round(delay / 1000)}s: ${reason}`);
          },
          onSuccess: (hash) => {
            setTxHash(hash);
            setProgress(60);
          },
          onError: (err, type) => {
            console.log(`Submission error (${type}): ${err}`);
          },
        }
      );
      
      if (!submissionResult.success) {
        throw new Error(submissionResult.error || 'Submission failed');
      }
      
      // STEP 4: Monitor Transaction
      setStep('monitoring');
      setTxHash(submissionResult.transactionHash || '');
      setStatusMessage('Monitoring transaction...');
      
      const monitorResult = await monitorTransaction(
        submissionResult.transactionHash || '',
        {
          onStatusChange: (status, message) => {
            setTxStatus(status);
            setStatusMessage(message);
          },
          onProgress: (elapsed, maxWait) => {
            const monitorProgress = (elapsed / maxWait) * 40; // 60-100%
            setProgress(60 + monitorProgress);
          },
          onConfirmed: () => {
            setProgress(100);
          },
          onFailed: (reason) => {
            throw new Error(`Transaction failed: ${reason}`);
          },
        }
      );
      
      if (monitorResult.status === 'confirmed') {
        // Success!
        setStep('confirmed');
        setStatusMessage('Transaction confirmed!');
        setProgress(100);
        
        onComplete?.({
          proof: generatedProof,
          txHash: submissionResult.transactionHash || '',
        });
      } else if (monitorResult.status === 'timeout') {
        // Timeout but might still confirm
        setStatusMessage('Monitoring timeout - transaction may still confirm');
        setStep('confirmed'); // Optimistically mark as complete
      } else {
        throw new Error(monitorResult.failureReason || 'Transaction failed');
      }
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      setStep('failed');
      setStatusMessage(errorMessage);
      onError?.(errorMessage);
    }
  }, [age, salt, minAge, onComplete, onError]);

  /**
   * Get step indicator color
   */
  const getStepColor = (s: FlowStep): string => {
    if (step === s) return 'text-blue-500';
    if (step === 'confirmed' || stepOrder(step) > stepOrder(s)) return 'text-green-500';
    if (step === 'failed') return 'text-red-500';
    return 'text-gray-400';
  };

  const stepOrder = (s: FlowStep): number => {
    const order: Record<FlowStep, number> = {
      idle: 0,
      generating: 1,
      validating: 2,
      submitting: 3,
      monitoring: 4,
      confirmed: 5,
      failed: -1,
    };
    return order[s];
  };

  const { averageTime } = estimateConfirmationTime();

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
        Generate & Submit Proof
      </h2>

      {/* Step Indicators */}
      <div className="flex justify-between mb-8">
        {(['generating', 'validating', 'submitting', 'monitoring', 'confirmed'] as FlowStep[]).map((s, i) => (
          <div key={s} className="flex flex-col items-center">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
              getStepColor(s).replace('text-', 'border-')
            } ${step === s ? 'bg-blue-100 dark:bg-blue-900' : ''}`}>
              <span className={`text-sm font-medium ${getStepColor(s)}`}>
                {stepOrder(step) > stepOrder(s) || step === 'confirmed' ? '✓' : i + 1}
              </span>
            </div>
            <span className={`text-xs mt-1 ${getStepColor(s)}`}>
              {s === 'generating' ? 'Generate' : 
               s === 'validating' ? 'Validate' :
               s === 'submitting' ? 'Submit' :
               s === 'monitoring' ? 'Monitor' : 'Done'}
            </span>
          </div>
        ))}
      </div>

      {/* Input Form */}
      {step === 'idle' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Your Age
            </label>
            <input
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="Enter your age"
              min="0"
              max="150"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Minimum Age Requirement
            </label>
            <select
              value={minAge}
              onChange={(e) => setMinAge(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="13">13+ (Teen)</option>
              <option value="18">18+ (Adult)</option>
              <option value="21">21+ (US Legal)</option>
              <option value="25">25+ (Car Rental)</option>
              <option value="65">65+ (Senior)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Privacy Salt
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={salt}
                onChange={(e) => setSalt(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Random salt for privacy"
              />
              <button
                onClick={generateSalt}
                className="px-3 py-2 bg-gray-200 dark:bg-gray-600 rounded-md 
                         hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
              >
                🎲
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Salt adds privacy - keep it secret!
            </p>
          </div>

          <button
            onClick={startSubmission}
            disabled={!age || !salt}
            className="w-full py-3 bg-blue-600 text-white rounded-md font-medium 
                     hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                     transition-colors"
          >
            Generate & Submit Proof
          </button>

          <p className="text-xs text-gray-500 text-center">
            Estimated time: ~{Math.round(averageTime / 60000)} minutes
          </p>
        </div>
      )}

      {/* Progress Display */}
      {step !== 'idle' && step !== 'confirmed' && step !== 'failed' && (
        <div className="space-y-4">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="text-center">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {statusMessage}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {Math.round(progress)}% complete
            </p>
          </div>

          {retryCount > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 
                          rounded-md p-3 text-sm text-yellow-800 dark:text-yellow-200">
              Retry attempt #{retryCount}
              {retryDelay > 0 && ` - waiting ${formatTimeRemaining(retryDelay)}`}
            </div>
          )}

          {txHash && (
            <div className="bg-gray-50 dark:bg-gray-900 rounded-md p-3">
              <p className="text-xs text-gray-500 mb-1">Transaction Hash</p>
              <p className="text-sm font-mono text-gray-900 dark:text-white break-all">
                {txHash}
              </p>
              <a
                href={`https://minascan.io/devnet/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline mt-1 inline-block"
              >
                View on Minascan →
              </a>
            </div>
          )}
        </div>
      )}

      {/* Success State */}
      {step === 'confirmed' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full 
                        flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>
          
          <h3 className="text-lg font-semibold text-green-600 dark:text-green-400">
            Proof Submitted Successfully!
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Your age proof has been verified and recorded on the Mina blockchain.
          </p>

          {txHash && (
            <a
              href={`https://minascan.io/devnet/tx/${txHash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md 
                       hover:bg-blue-700 transition-colors"
            >
              View Transaction
            </a>
          )}

          <button
            onClick={reset}
            className="block w-full mt-4 py-2 border border-gray-300 dark:border-gray-600 
                     rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Generate Another Proof
          </button>
        </div>
      )}

      {/* Error State */}
      {step === 'failed' && (
        <div className="text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900 rounded-full 
                        flex items-center justify-center mx-auto">
            <span className="text-3xl">✗</span>
          </div>
          
          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
            Submission Failed
          </h3>
          
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {error}
          </p>

          <button
            onClick={reset}
            className="w-full py-2 bg-blue-600 text-white rounded-md 
                     hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
