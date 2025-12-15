/**
 * useProofProgress.ts
 * 
 * Hook for managing granular progress state during proof generation.
 * Provides stepped progress tracking and user-friendly status messages.
 */

import { useState, useCallback } from 'react';

export type ProofStep = 
  | 'IDLE'
  | 'INITIALIZING'
  | 'FETCHING_KEYS'
  | 'LOADING_CACHE'
  | 'COMPILING_CIRCUIT'
  | 'GENERATING_WITNESS'
  | 'PROVING'
  | 'SIGNING_TRANSACTION'
  | 'BROADCASTING'
  | 'MONITORING'
  | 'COMPLETE'
  | 'ERROR';

export interface ProgressState {
  step: ProofStep;
  currentStepIndex: number;
  totalSteps: number;
  percentage: number;
  message: string;
  subMessage?: string;
  error?: string;
}

const STEP_MESSAGES: Record<ProofStep, string> = {
  IDLE: 'Ready to generate proof',
  INITIALIZING: 'Initializing...',
  FETCHING_KEYS: 'Fetching verification keys',
  LOADING_CACHE: 'Loading cached computations',
  COMPILING_CIRCUIT: 'Compiling zero-knowledge circuit',
  GENERATING_WITNESS: 'Computing private inputs',
  PROVING: 'Generating zero-knowledge proof',
  SIGNING_TRANSACTION: 'Waiting for wallet signature',
  BROADCASTING: 'Broadcasting transaction',
  MONITORING: 'Monitoring transaction status',
  COMPLETE: 'Proof generated successfully!',
  ERROR: 'An error occurred',
};

const STEP_ORDER: ProofStep[] = [
  'INITIALIZING',
  'FETCHING_KEYS',
  'LOADING_CACHE',
  'COMPILING_CIRCUIT',
  'GENERATING_WITNESS',
  'PROVING',
  'SIGNING_TRANSACTION',
  'BROADCASTING',
  'MONITORING',
  'COMPLETE',
];

export function useProofProgress() {
  const [progress, setProgress] = useState<ProgressState>({
    step: 'IDLE',
    currentStepIndex: 0,
    totalSteps: STEP_ORDER.length,
    percentage: 0,
    message: STEP_MESSAGES.IDLE,
  });

  const updateStep = useCallback((
    step: ProofStep, 
    subMessage?: string,
    customPercentage?: number
  ) => {
    const stepIndex = STEP_ORDER.indexOf(step);
    const percentage = customPercentage ?? Math.round((stepIndex / STEP_ORDER.length) * 100);

    setProgress({
      step,
      currentStepIndex: stepIndex + 1,
      totalSteps: STEP_ORDER.length,
      percentage,
      message: STEP_MESSAGES[step],
      subMessage,
    });
  }, []);

  const setError = useCallback((error: string) => {
    setProgress(prev => ({
      ...prev,
      step: 'ERROR',
      message: STEP_MESSAGES.ERROR,
      error,
    }));
  }, []);

  const reset = useCallback(() => {
    setProgress({
      step: 'IDLE',
      currentStepIndex: 0,
      totalSteps: STEP_ORDER.length,
      percentage: 0,
      message: STEP_MESSAGES.IDLE,
    });
  }, []);

  const updateSubMessage = useCallback((subMessage: string) => {
    setProgress(prev => ({
      ...prev,
      subMessage,
    }));
  }, []);

  return {
    progress,
    updateStep,
    setError,
    reset,
    updateSubMessage,
    isInProgress: progress.step !== 'IDLE' && progress.step !== 'COMPLETE' && progress.step !== 'ERROR',
  };
}
