/**
 * EnhancedProofExample.tsx
 * 
 * Example component demonstrating how to use the new progress tracking
 * and Web Worker integration for smooth proof generation
 */

'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useProofProgress } from '../hooks/useProofProgress';
import { SteppedProgressIndicator } from './SteppedProgressIndicator';
import { NetworkGuard } from './NetworkGuard';
import { notify } from '../lib/ToastNotifications';
import { wrap, Remote } from 'comlink';
import type { api as WorkerAPI } from '../app/ZkappWorker';

// Type for the worker API
type ZkappWorkerAPI = typeof WorkerAPI;

export function EnhancedProofExample() {
  const { progress, updateStep, setError, reset } = useProofProgress();
  const [isGenerating, setIsGenerating] = useState(false);
  const workerRef = useRef<Worker | null>(null);
  const workerAPIRef = useRef<Remote<ZkappWorkerAPI> | null>(null);

  // Initialize Web Worker on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Create worker
    const worker = new Worker(new URL('../app/ZkappWorker.ts', import.meta.url));
    workerRef.current = worker;

    // Wrap with comlink
    const api = wrap<ZkappWorkerAPI>(worker);
    workerAPIRef.current = api;

    // Set up progress callback
    api.setProgressCallback((step, percentage, message) => {
      console.log(`[Worker Progress] ${step}: ${percentage}% - ${message || ''}`);
      updateStep(step as any, message, percentage);
    });

    // Cleanup
    return () => {
      worker.terminate();
    };
  }, [updateStep]);

  const handleGenerateProof = async () => {
    if (!workerAPIRef.current) {
      notify.error('Worker not initialized');
      return;
    }

    setIsGenerating(true);
    reset();

    try {
      updateStep('INITIALIZING', 'Starting proof generation...');

      // Initialize network
      await workerAPIRef.current.setActiveInstanceToDevnet();

      // Load contracts
      updateStep('INITIALIZING', 'Loading contracts...');
      await workerAPIRef.current.loadContracts();

      // Compile circuits (this is the slow part)
      updateStep('COMPILING_CIRCUIT', 'Compiling circuits...');
      await workerAPIRef.current.compileDIDRegistry();

      // Generate proof
      updateStep('PROVING', 'Generating zero-knowledge proof...');
      // ... proof generation logic ...
      
      // Simulate proof generation for demo
      await new Promise(resolve => setTimeout(resolve, 2000));

      updateStep('COMPLETE', 'Proof generated successfully!');
      notify.success('Proof generated successfully!');
    } catch (error: any) {
      console.error('[ProofGeneration] Error:', error);
      setError(error.message || 'Failed to generate proof');
      notify.error(error.message || 'Failed to generate proof');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <NetworkGuard
        expectedNetwork="devnet"
        onNetworkMismatch={(current, expected) => {
          notify.warning(`Please switch to ${expected} network (currently on ${current})`);
        }}
      />

      <h2 style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '1.5rem', marginBottom: '1.5rem' }}>
        Enhanced Proof Generation
      </h2>

      <p style={{ fontFamily: 'var(--font-monument)', fontSize: '0.875rem', color: '#6b7280', marginBottom: '2rem' }}>
        This example demonstrates the new progress tracking system with Web Workers
        for smooth, non-blocking proof generation.
      </p>

      {/* Progress Indicator */}
      {progress.step !== 'IDLE' && (
        <div style={{ marginBottom: '2rem' }}>
          <SteppedProgressIndicator progress={progress} />
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

      {/* Technical Details */}
      <div style={{ marginTop: '2rem', padding: '1rem', background: '#f9fafb', borderRadius: '8px' }}>
        <h3 style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
          Technical Details
        </h3>
        <ul style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#6b7280', paddingLeft: '1.5rem' }}>
          <li>Web Worker isolates heavy computation from UI thread</li>
          <li>Granular progress updates keep user informed</li>
          <li>Toast notifications provide instant feedback</li>
          <li>Network guard prevents cross-network errors</li>
          <li>Session timeout ensures security after 10 mins inactivity</li>
        </ul>
      </div>
    </div>
  );
}
