/**
 * RobustProofGenerator.tsx
 * 
 * Complete example showing all error handling improvements:
 * - Web Worker with error handling
 * - Progress tracking
 * - Cache reset on errors
 * - Toast notifications
 * - Network guard
 * - Graceful fallback
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useProofProgress } from '../hooks/useProofProgress';
import { useCacheReset, CacheResetButton } from '../components/CacheResetButton';
import { SteppedProgressIndicator } from '../components/SteppedProgressIndicator';
import { NetworkGuard } from '../components/NetworkGuard';
import { notify } from '../lib/ToastNotifications';
import { wrap, Remote } from 'comlink';
import type { api as WorkerAPI } from '../app/ZkappWorker';

type ZkappWorkerAPI = typeof WorkerAPI;

export function RobustProofGenerator() {
  const { progress, updateStep, setError, reset } = useProofProgress();
  const { 
    recordFailure, 
    recordSuccess, 
    isCacheRelatedError, 
    resetPrompt,
    showResetPrompt 
  } = useCacheReset();
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [compilationAttempts, setCompilationAttempts] = useState(0);
  const workerRef = useRef<Worker | null>(null);
  const workerAPIRef = useRef<Remote<ZkappWorkerAPI> | null>(null);

  // Initialize Web Worker
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const worker = new Worker(new URL('../app/ZkappWorker.ts', import.meta.url));
      workerRef.current = worker;

      const api = wrap<ZkappWorkerAPI>(worker);
      workerAPIRef.current = api;

      // Set up progress callback with error detection
      api.setProgressCallback((step, percentage, message) => {
        console.log(`[Worker] ${step}: ${percentage}% - ${message || ''}`);
        
        if (step === 'ERROR') {
          // Worker reported an error
          const errorMsg = message || 'Unknown error';
          setError(errorMsg);
          
          // Check if it's a cache-related error
          if (isCacheRelatedError(errorMsg)) {
            recordFailure(errorMsg);
            notify.error('Cache error detected. Try resetting cache.', {
              duration: 6000,
            });
          } else {
            notify.error(errorMsg);
          }
        } else {
          updateStep(step as any, message, percentage);
        }
      });

      console.log('[RobustProofGenerator] Worker initialized');
    } catch (error: any) {
      console.error('[RobustProofGenerator] Worker initialization failed:', error);
      notify.error('Failed to initialize worker: ' + error.message);
    }

    return () => {
      workerRef.current?.terminate();
    };
  }, [updateStep, setError, isCacheRelatedError, recordFailure]);

  const handleGenerateProof = async () => {
    if (!workerAPIRef.current) {
      notify.error('Worker not initialized');
      return;
    }

    setIsGenerating(true);
    reset();
    setCompilationAttempts(prev => prev + 1);

    try {
      // Step 1: Initialize
      updateStep('INITIALIZING', 'Connecting to network...');
      await workerAPIRef.current.setActiveInstanceToDevnet();

      // Step 2: Load contracts
      updateStep('INITIALIZING', 'Loading contract modules...');
      await workerAPIRef.current.loadContracts();

      // Step 3: Compile DIDRegistry (this is where cache errors often occur)
      updateStep('COMPILING_CIRCUIT', 'Compiling DIDRegistry...');
      
      try {
        await workerAPIRef.current.compileDIDRegistry();
        
        // Success! Clear failure count
        recordSuccess();
        
        notify.success('Compilation successful!', {
          icon: '⚙️',
        });
      } catch (compileError: any) {
        // Compilation failed - check if cache-related
        if (isCacheRelatedError(compileError.message)) {
          recordFailure(compileError.message);
          
          // Provide helpful guidance
          if (compilationAttempts === 1) {
            notify.warning(
              'First compilation attempt failed. This might be due to cache issues. Check console for details.',
              { duration: 5000 }
            );
          }
        }
        
        throw compileError; // Re-throw to outer catch
      }

      // Step 4: Generate proof (example)
      updateStep('PROVING', 'Generating zero-knowledge proof...');
      
      // Simulate proof generation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Complete
      updateStep('COMPLETE', 'Proof generated successfully!');
      notify.proof.complete('DID Registration');
      
    } catch (error: any) {
      console.error('[RobustProofGenerator] Error:', error);
      
      // Set error in progress
      setError(error.message || 'Failed to generate proof');
      
      // Show appropriate notification
      if (error.message?.includes('cache')) {
        notify.error('Cache error: ' + error.message, {
          duration: 7000,
        });
      } else if (error.message?.includes('memory')) {
        notify.error('Out of memory. Try closing other tabs and reloading.', {
          duration: 7000,
        });
      } else {
        notify.error(error.message || 'Failed to generate proof');
      }
      
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      {/* Network Guard */}
      <NetworkGuard
        expectedNetwork="devnet"
        onNetworkMismatch={(current, expected) => {
          notify.warning(`Please switch to ${expected} network (currently on ${current})`);
        }}
      />

      {/* Cache Reset Banner (auto-shows after failures) */}
      {resetPrompt}

      <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '1.5rem', marginBottom: '0.5rem' }}>
          Robust Proof Generator
        </h2>
        <p style={{ fontFamily: 'var(--font-monument)', fontSize: '0.875rem', color: '#6b7280' }}>
          This example demonstrates all error handling improvements
        </p>
      </div>

      {/* Progress Indicator */}
      {progress.step !== 'IDLE' && (
        <div style={{ marginBottom: '2rem' }}>
          <SteppedProgressIndicator progress={progress} />
        </div>
      )}

      {/* Error Message with Manual Reset Option */}
      {progress.step === 'ERROR' && (
        <div style={{
          background: '#FEE2E2',
          border: '1px solid #FCA5A5',
          borderRadius: '8px',
          padding: '1rem',
          marginBottom: '1.5rem',
        }}>
          <div style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', color: '#DC2626', marginBottom: '0.5rem' }}>
            ❌ Error Occurred
          </div>
          <div style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#991B1B', marginBottom: '1rem' }}>
            {progress.error}
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <CacheResetButton variant="minimal" />
            <span style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#6b7280' }}>
              or try again
            </span>
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        onClick={handleGenerateProof}
        disabled={isGenerating}
        style={{
          width: '100%',
          padding: '1rem',
          background: isGenerating
            ? 'linear-gradient(90deg, #9CA3AF 0%, #D1D5DB 100%)'
            : 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)',
          color: '#fff',
          border: 'none',
          borderRadius: '8px',
          fontFamily: 'var(--font-monument-bold)',
          fontSize: '0.875rem',
          cursor: isGenerating ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}
      >
        {isGenerating ? 'GENERATING PROOF...' : 'GENERATE PROOF'}
      </button>

      {/* Info Box */}
      <div style={{
        marginTop: '2rem',
        padding: '1.5rem',
        background: '#F9FAFB',
        borderRadius: '8px',
        border: '1px solid #E5E7EB',
      }}>
        <h3 style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '1rem' }}>
          ✨ Error Handling Features
        </h3>
        <ul style={{
          fontFamily: 'var(--font-monument)',
          fontSize: '0.75rem',
          color: '#6b7280',
          paddingLeft: '1.5rem',
          lineHeight: '1.6',
        }}>
          <li>✅ Graceful cache server fallback</li>
          <li>✅ 10-second fetch timeout protection</li>
          <li>✅ Auto-detection of cache errors</li>
          <li>✅ One-click cache reset button</li>
          <li>✅ Categorized error messages</li>
          <li>✅ Progress updates from worker</li>
          <li>✅ Toast notifications for all states</li>
          <li>✅ Network mismatch warnings</li>
          <li>✅ Memory error handling</li>
          <li>✅ Multiple attempt tracking</li>
        </ul>
      </div>

      {/* Debug Info */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{
          marginTop: '1rem',
          padding: '1rem',
          background: '#FEF3C7',
          borderRadius: '8px',
          border: '1px solid #FCD34D',
        }}>
          <div style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.75rem', marginBottom: '0.5rem' }}>
            🐛 Debug Info
          </div>
          <div style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#92400E' }}>
            <div>Current Step: {progress.step}</div>
            <div>Progress: {progress.percentage}%</div>
            <div>Compilation Attempts: {compilationAttempts}</div>
            <div>Show Reset: {showResetPrompt ? 'Yes' : 'No'}</div>
            <div>Cache URL: {process.env.NEXT_PUBLIC_CACHE_URL || 'default (current origin)'}</div>
          </div>
        </div>
      )}
    </div>
  );
}
