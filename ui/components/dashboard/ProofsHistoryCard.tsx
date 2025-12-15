/**
 * ProofsHistoryCard.tsx
 * 
 * Display history of generated proofs
 */

'use client';

import React, { useState, useEffect } from 'react';
import { ProofStorage, type StoredProof } from '../../lib/ProofStorage';

export function ProofsHistoryCard() {
  const [proofs, setProofs] = useState<StoredProof[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadProofs();
  }, []);

  const loadProofs = () => {
    setIsLoading(true);
    try {
      const storedProofs = ProofStorage.getProofs();
      setProofs(storedProofs);
    } catch (error) {
      console.error('[ProofsHistoryCard] Failed to load proofs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getProofIcon = (type: string) => {
    const icons = {
      age: '🎂',
      kyc: '✅',
      composite: '🔗',
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const getStatusBadge = (status: StoredProof['status']) => {
    const styles = {
      pending: 'bg-yellow-100 text-yellow-700',
      verified: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getExplorerUrl = (hash: string) => {
    return `https://minascan.io/devnet/tx/${hash}?type=zk-tx`;
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-gray-200 rounded"></div>
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
        <span className="text-sm text-gray-500">{proofs.length} proofs generated</span>
      </div>

      {proofs.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">�</div>
          <p className="text-gray-600 mb-2">No proofs generated yet</p>
          <p className="text-sm text-gray-500">
            Generate your first zero-knowledge proof to get started!
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {proofs.map((proof) => (
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
                      Generated {new Date(proof.timestamp).toLocaleString()}
                    </p>
                    
                    {proof.txHash && (
                      <div className="mt-1">
                        <a 
                          href={getExplorerUrl(proof.txHash)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                        >
                          <span>Tx: {proof.txHash.substring(0, 10)}...{proof.txHash.substring(proof.txHash.length - 8)}</span>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                        </a>
                      </div>
                    )}
                    
                    {proof.metadata.verifierAddress && !proof.txHash && (
                      <p className="text-xs text-gray-500 mt-1">
                        Verifier: {proof.metadata.verifierAddress.substring(0, 20)}...
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
