/**
 * ProofsHistoryCard.tsx
 * 
 * Display history of generated proofs
 */

'use client';

import React from 'react';

interface ProofHistoryItem {
  id: string;
  type: 'age' | 'kyc' | 'composite';
  createdAt: number;
  status: 'pending' | 'verified' | 'failed';
  verifier?: string;
  metadata?: Record<string, any>;
}

interface ProofsHistoryCardProps {
  proofs?: ProofHistoryItem[];
}

export function ProofsHistoryCard({ proofs = [] }: ProofsHistoryCardProps) {
  const getProofIcon = (type: string) => {
    const icons = {
      age: '🎂',
      kyc: '✅',
      composite: '🔗',
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const getStatusBadge = (status: ProofHistoryItem['status']) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      verified: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Proof History</h2>
        <span className="text-sm text-gray-500">{proofs.length} proofs generated</span>
      </div>

      {proofs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔐</div>
          <p className="text-gray-500 mb-2">No proofs generated yet</p>
          <p className="text-sm text-gray-400">
            Generate your first zero-knowledge proof from your credentials
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proofs.map(proof => (
            <div
              key={proof.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:bg-gray-50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3 flex-1">
                  <div className="text-2xl">{getProofIcon(proof.type)}</div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="font-semibold text-gray-900 capitalize">
                        {proof.type} Proof
                      </h3>
                      {getStatusBadge(proof.status)}
                    </div>
                    
                    <p className="text-sm text-gray-600">
                      Generated {new Date(proof.createdAt).toLocaleString()}
                    </p>
                    
                    {proof.verifier && (
                      <p className="text-xs text-gray-500 mt-1">
                        Verifier: {proof.verifier.substring(0, 20)}...
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex space-x-2">
                  <button className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors text-xs font-medium">
                    View
                  </button>
                  <button className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs font-medium">
                    Share
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
