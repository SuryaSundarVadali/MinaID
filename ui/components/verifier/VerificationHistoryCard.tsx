/**
 * VerificationHistoryCard.tsx
 * 
 * Display history of proof verifications
 */

'use client';

import React, { useState, useEffect } from 'react';
import type { VerificationResult } from '../VerifierDashboard';

export function VerificationHistoryCard() {
  const [verifications, setVerifications] = useState<VerificationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadVerifications();
  }, []);

  const loadVerifications = () => {
    setIsLoading(true);
    try {
      const history = JSON.parse(localStorage.getItem('minaid_verification_history') || '[]');
      setVerifications(history);
    } catch (error) {
      console.error('[VerificationHistory] Failed to load:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: VerificationResult['status']) => {
    const styles = {
      verified: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      invalid: 'bg-yellow-100 text-yellow-700',
    };
    
    const icons = {
      verified: '✅',
      failed: '❌',
      invalid: '⚠️',
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        <span className="mr-1">{icons[status]}</span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getProofTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      age: '🎂',
      kyc: '✅',
      composite: '🔗',
      unknown: '📄',
    };
    return icons[type] || icons.unknown;
  };

  const handleClearHistory = () => {
    if (confirm('Are you sure you want to clear all verification history?')) {
      localStorage.removeItem('minaid_verification_history');
      setVerifications([]);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Verification History</h2>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-gray-500">{verifications.length} verifications</span>
          {verifications.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {verifications.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-600 mb-2">No verifications yet</p>
          <p className="text-sm text-gray-500">
            Verified proofs will appear here
          </p>
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="text-2xl font-bold text-green-700">
                {verifications.filter(v => v.status === 'verified').length}
              </div>
              <div className="text-sm text-green-600">Verified</div>
            </div>
            <div className="bg-red-50 rounded-lg p-4 border border-red-200">
              <div className="text-2xl font-bold text-red-700">
                {verifications.filter(v => v.status === 'failed').length}
              </div>
              <div className="text-sm text-red-600">Failed</div>
            </div>
            <div className="bg-yellow-50 rounded-lg p-4 border border-yellow-200">
              <div className="text-2xl font-bold text-yellow-700">
                {verifications.filter(v => v.status === 'invalid').length}
              </div>
              <div className="text-sm text-yellow-600">Invalid</div>
            </div>
          </div>

          {/* Verification List */}
          <div className="space-y-3">
            {verifications.map((verification) => (
              <div
                key={verification.id}
                className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:bg-gray-50 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className="text-3xl">{getProofTypeIcon(verification.proofType)}</div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-1">
                        <h3 className="font-semibold text-gray-900 capitalize">
                          {verification.proofType} Proof
                        </h3>
                        {getStatusBadge(verification.status)}
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-1">
                        Verified {new Date(verification.timestamp).toLocaleString()}
                      </p>
                      
                      <p className="text-xs text-gray-500 font-mono">
                        Proof ID: {verification.proofId}
                      </p>
                      
                      {verification.subjectDID && (
                        <p className="text-xs text-gray-500 font-mono mt-1">
                          Subject: {verification.subjectDID.substring(0, 30)}...
                        </p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      const data = JSON.stringify(verification, null, 2);
                      navigator.clipboard.writeText(data);
                      alert('Verification details copied!');
                    }}
                    className="ml-3 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
                  >
                    Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
