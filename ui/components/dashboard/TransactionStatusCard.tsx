/**
 * TransactionStatusCard.tsx
 * 
 * Component to display blockchain transaction status and history
 * Shows transaction hashes, confirmation status, and links to explorer
 */

'use client';

import React, { useState, useEffect } from 'react';
import { getExplorerUrl } from '../../lib/ContractInterface';
import { getTransactionStatus, exportTransactionDetails } from '../../lib/BlockchainHelpers';

interface Transaction {
  hash: string;
  type: 'did_registration' | 'proof_generation' | 'proof_verification';
  timestamp: number;
  status: 'pending' | 'confirmed' | 'failed';
  did?: string;
  proofId?: string;
}

export default function TransactionStatusCard() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const txList: Transaction[] = [];

      // Load DID registration transactions
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        const parsed = JSON.parse(walletData);
        const didTxHash = localStorage.getItem(`minaid_did_tx_${parsed.did}`);
        if (didTxHash) {
          txList.push({
            hash: didTxHash,
            type: 'did_registration',
            timestamp: parsed.timestamp,
            status: 'confirmed',
            did: parsed.did,
          });
        }
      }

      // Load proof generation transactions
      const proofKeys = Object.keys(localStorage).filter(key => key.startsWith('minaid_proof_tx_'));
      for (const key of proofKeys) {
        const txHash = localStorage.getItem(key);
        const proofId = key.replace('minaid_proof_tx_', '');
        if (txHash) {
          txList.push({
            hash: txHash,
            type: 'proof_generation',
            timestamp: Date.now(), // Could store this properly
            status: 'confirmed',
            proofId,
          });
        }
      }

      // Sort by timestamp (newest first)
      txList.sort((a, b) => b.timestamp - a.timestamp);

      setTransactions(txList);
    } catch (error) {
      console.error('[TransactionStatusCard] Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeLabel = (type: Transaction['type']): string => {
    switch (type) {
      case 'did_registration':
        return 'DID Registration';
      case 'proof_generation':
        return 'Proof Generation';
      case 'proof_verification':
        return 'Proof Verification';
      default:
        return 'Transaction';
    }
  };

  const getTypeIcon = (type: Transaction['type']): JSX.Element => {
    switch (type) {
      case 'did_registration':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'proof_generation':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        );
      case 'proof_verification':
        return (
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
    }
  };

  const getStatusBadge = (status: Transaction['status']): JSX.Element => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Confirmed
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <svg className="w-3 h-3 mr-1 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Pending
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            Failed
          </span>
        );
    }
  };

  const handleExport = (tx: Transaction) => {
    exportTransactionDetails(tx.hash, 'devnet');
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-16 bg-gray-200 rounded"></div>
            <div className="h-16 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Blockchain Transactions</h3>
        <div className="text-center py-8">
          <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <p className="text-gray-500">No blockchain transactions yet</p>
          <p className="text-sm text-gray-400 mt-1">
            Your DID registrations and proof generations will appear here
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Blockchain Transactions</h3>
        <span className="text-sm text-gray-500">{transactions.length} total</span>
      </div>

      <div className="space-y-3">
        {transactions.map((tx, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="text-indigo-600">
                  {getTypeIcon(tx.type)}
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-900">
                    {getTypeLabel(tx.type)}
                  </h4>
                  <p className="text-xs text-gray-500">
                    {new Date(tx.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              {getStatusBadge(tx.status)}
            </div>

            <div className="mt-3">
              <p className="text-xs text-gray-500 mb-1">Transaction Hash:</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-gray-50 px-2 py-1 rounded font-mono flex-1 overflow-hidden text-ellipsis">
                  {tx.hash}
                </code>
                <button
                  onClick={() => navigator.clipboard.writeText(tx.hash)}
                  className="text-gray-400 hover:text-gray-600"
                  title="Copy hash"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex gap-2 mt-3">
              <a
                href={getExplorerUrl(tx.hash, 'devnet')}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-xs text-indigo-600 hover:text-indigo-800 font-medium"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on Explorer
              </a>
              <button
                onClick={() => handleExport(tx)}
                className="inline-flex items-center text-xs text-gray-600 hover:text-gray-800 font-medium"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
