'use client';

import React, { useEffect, useState } from 'react';
import { progressIndicator, ProgressOperation } from '../lib/ProgressIndicatorService';

interface ProgressIndicatorProps {
  operationId: string;
  onComplete?: () => void;
  onFail?: (error: string) => void;
  showSteps?: boolean;
  showTimeEstimate?: boolean;
}

export function ProgressIndicator({
  operationId,
  onComplete,
  onFail,
  showSteps = true,
  showTimeEstimate = true
}: ProgressIndicatorProps) {
  const [operation, setOperation] = useState<ProgressOperation | undefined>(
    progressIndicator.getOperation(operationId)
  );

  useEffect(() => {
    // Subscribe to updates
    const unsubscribe = progressIndicator.subscribe(operationId, (op) => {
      setOperation(op);

      // Call callbacks
      if (op.status === 'completed' && onComplete) {
        onComplete();
      } else if (op.status === 'failed' && onFail) {
        const failedStep = op.steps.find(s => s.status === 'failed');
        onFail(failedStep?.error || 'Operation failed');
      }
    });

    return () => unsubscribe();
  }, [operationId, onComplete, onFail]);

  if (!operation) {
    return null;
  }

  const timeRemaining = progressIndicator.getEstimatedTimeRemaining(operationId);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">
          {operation.title}
        </h3>
        
        {showTimeEstimate && timeRemaining !== null && operation.status === 'in-progress' && (
          <span className="text-sm text-gray-500">
            ~{Math.ceil(timeRemaining / 1000)}s remaining
          </span>
        )}

        {operation.status === 'completed' && (
          <span className="text-sm text-green-600 font-medium">
            ✓ Completed
          </span>
        )}

        {operation.status === 'failed' && (
          <span className="text-sm text-red-600 font-medium">
            ✗ Failed
          </span>
        )}
      </div>

      {/* Overall Progress Bar */}
      <div className="relative">
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              operation.status === 'completed'
                ? 'bg-green-500'
                : operation.status === 'failed'
                ? 'bg-red-500'
                : 'bg-purple-600'
            }`}
            style={{ width: `${operation.overallProgress}%` }}
          />
        </div>
        <div className="mt-1 text-right text-xs text-gray-500">
          {Math.round(operation.overallProgress)}%
        </div>
      </div>

      {/* Step Details */}
      {showSteps && (
        <div className="space-y-2">
          {operation.steps.map((step) => (
            <div
              key={step.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                step.status === 'completed'
                  ? 'bg-green-50 border-green-200'
                  : step.status === 'failed'
                  ? 'bg-red-50 border-red-200'
                  : step.status === 'in-progress'
                  ? 'bg-purple-50 border-purple-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 flex-1">
                {/* Status Icon */}
                <div className="flex-shrink-0">
                  {step.status === 'completed' && (
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                  
                  {step.status === 'failed' && (
                    <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  )}
                  
                  {step.status === 'in-progress' && (
                    <div className="w-5 h-5 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
                  )}
                  
                  {step.status === 'pending' && (
                    <div className="w-5 h-5 bg-gray-300 rounded-full" />
                  )}
                </div>

                {/* Step Name */}
                <span className={`text-sm font-medium ${
                  step.status === 'completed'
                    ? 'text-green-700'
                    : step.status === 'failed'
                    ? 'text-red-700'
                    : step.status === 'in-progress'
                    ? 'text-purple-700'
                    : 'text-gray-500'
                }`}>
                  {step.name}
                </span>

                {/* Error Message */}
                {step.status === 'failed' && step.error && (
                  <span className="text-xs text-red-600 ml-2">
                    ({step.error})
                  </span>
                )}
              </div>

              {/* Step Progress */}
              {step.status === 'in-progress' && step.progress > 0 && (
                <div className="text-xs text-gray-500">
                  {Math.round(step.progress)}%
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Duration */}
      {operation.endTime && (
        <div className="text-xs text-gray-500 text-center">
          Completed in {((operation.endTime - operation.startTime) / 1000).toFixed(1)}s
        </div>
      )}
    </div>
  );
}

// Compact progress bar (for inline display)
export function CompactProgressBar({ operationId }: { operationId: string }) {
  const [operation, setOperation] = useState<ProgressOperation | undefined>(
    progressIndicator.getOperation(operationId)
  );

  useEffect(() => {
    const unsubscribe = progressIndicator.subscribe(operationId, setOperation);
    return () => unsubscribe();
  }, [operationId]);

  if (!operation || operation.status === 'completed') {
    return null;
  }

  return (
    <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-300 ${
          operation.status === 'failed' ? 'bg-red-500' : 'bg-purple-600'
        }`}
        style={{ width: `${operation.overallProgress}%` }}
      />
    </div>
  );
}

// Progress badge (for status indication)
export function ProgressBadge({ operationId }: { operationId: string }) {
  const [operation, setOperation] = useState<ProgressOperation | undefined>(
    progressIndicator.getOperation(operationId)
  );

  useEffect(() => {
    const unsubscribe = progressIndicator.subscribe(operationId, setOperation);
    return () => unsubscribe();
  }, [operationId]);

  if (!operation) {
    return null;
  }

  const currentStep = operation.steps.find(s => s.status === 'in-progress');

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
      operation.status === 'completed'
        ? 'bg-green-100 text-green-700'
        : operation.status === 'failed'
        ? 'bg-red-100 text-red-700'
        : 'bg-purple-100 text-purple-700'
    }`}>
      {operation.status === 'in-progress' && (
        <div className="w-3 h-3 border-2 border-purple-600 border-t-transparent rounded-full animate-spin" />
      )}
      
      {operation.status === 'completed' && (
        <span>✓</span>
      )}
      
      {operation.status === 'failed' && (
        <span>✗</span>
      )}
      
      <span className="font-medium">
        {currentStep?.name || operation.title}
      </span>
      
      {operation.status === 'in-progress' && (
        <span className="text-xs">
          ({Math.round(operation.overallProgress)}%)
        </span>
      )}
    </div>
  );
}
