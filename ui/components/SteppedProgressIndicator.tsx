/**
 * SteppedProgressIndicator.tsx
 * 
 * Enhanced progress indicator with stepped visualization
 * Shows granular progress for proof generation and transaction submission
 */

'use client';

import React from 'react';
import { ProgressState, ProofStep } from '../hooks/useProofProgress';

interface SteppedProgressIndicatorProps {
  progress: ProgressState;
  className?: string;
}

const STEP_EMOJIS: Record<ProofStep, string> = {
  IDLE: '⏸️',
  INITIALIZING: '🔄',
  FETCHING_KEYS: '🔑',
  LOADING_CACHE: '💾',
  COMPILING_CIRCUIT: '⚙️',
  GENERATING_WITNESS: '🧮',
  PROVING: '🔐',
  SIGNING_TRANSACTION: '✍️',
  BROADCASTING: '📡',
  MONITORING: '👀',
  COMPLETE: '✅',
  ERROR: '❌',
};

export function SteppedProgressIndicator({ progress, className }: SteppedProgressIndicatorProps) {
  const { step, currentStepIndex, totalSteps, percentage, message, subMessage, error } = progress;

  const isError = step === 'ERROR';
  const isComplete = step === 'COMPLETE';
  const isActive = step !== 'IDLE' && !isError && !isComplete;

  return (
    <div
      className={className}
      style={{
        background: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        padding: '1.5rem',
        maxWidth: '600px',
        margin: '0 auto',
      }}
    >
      {/* Progress Bar */}
      <div style={{ marginBottom: '1rem' }}>
        <div
          style={{
            width: '100%',
            height: '8px',
            background: '#f3f4f6',
            borderRadius: '4px',
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              height: '100%',
              width: `${percentage}%`,
              background: isError 
                ? 'linear-gradient(90deg, #DC2626 0%, #EF4444 100%)'
                : isComplete
                ? 'linear-gradient(90deg, #10B981 0%, #34D399 100%)'
                : 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      </div>

      {/* Status Message */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <span style={{ fontSize: '1.5rem' }}>{STEP_EMOJIS[step]}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.875rem', color: '#1f2937' }}>
            {message}
          </div>
          {subMessage && (
            <div style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#6b7280', marginTop: '0.25rem' }}>
              {subMessage}
            </div>
          )}
          {error && (
            <div style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#DC2626', marginTop: '0.25rem' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Step Counter */}
      {isActive && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
          <span style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#6b7280' }}>
            Step {currentStepIndex} of {totalSteps}
          </span>
          <span style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.75rem', color: '#3B82F6' }}>
            {percentage}%
          </span>
        </div>
      )}

      {/* Loading Animation */}
      {isActive && (
        <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#3B82F6',
                animation: `pulse 1.5s ease-in-out ${i * 0.2}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 0.3;
            transform: scale(0.8);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Minimal progress indicator for small spaces
 */
export function MinimalProgressIndicator({ progress }: { progress: ProgressState }) {
  const { step, percentage, message } = progress;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <span style={{ fontSize: '1.25rem' }}>{STEP_EMOJIS[step]}</span>
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
          <span style={{ fontFamily: 'var(--font-monument)', fontSize: '0.75rem', color: '#6b7280' }}>
            {message}
          </span>
          <span style={{ fontFamily: 'var(--font-monument-bold)', fontSize: '0.7rem', color: '#3B82F6' }}>
            {percentage}%
          </span>
        </div>
        <div
          style={{
            width: '100%',
            height: '4px',
            background: '#f3f4f6',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${percentage}%`,
              background: 'linear-gradient(90deg, #3B82F6 0%, #60A5FA 100%)',
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      </div>
    </div>
  );
}
