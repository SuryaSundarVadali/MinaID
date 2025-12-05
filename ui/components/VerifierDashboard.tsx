/**
 * VerifierDashboard.tsx
 * 
 * Dashboard for verifiers to request and verify zero-knowledge proofs
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { ProofRequestCard } from './verifier/ProofRequestCard';
import { ProofScannerCard } from './verifier/ProofScannerCard';
import { VerificationHistoryCard } from './verifier/VerificationHistoryCard';

export type ProofRequest = {
  id: string;
  type: 'age' | 'kyc' | 'composite';
  parameters: any;
  createdAt: number;
  status: 'pending' | 'fulfilled' | 'expired';
};

export type VerificationResult = {
  id: string;
  proofId: string;
  requestId?: string;
  status: 'verified' | 'failed' | 'invalid';
  timestamp: number;
  proofType: string;
  subjectDID?: string;
};

export function VerifierDashboard() {
  const router = useRouter();
  const { session, logout } = useWallet();
  const [activeTab, setActiveTab] = useState<'request' | 'scan' | 'history'>('request');
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(null);

  // Check for authentication via session or localStorage
  React.useEffect(() => {
    let identifier = session?.did || null;
    
    // Also check localStorage for wallet connection
    if (!identifier) {
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        try {
          const parsed = JSON.parse(walletData);
          identifier = parsed.did || parsed.address;
        } catch (e) {
          console.error('[VerifierDashboard] Failed to parse wallet data:', e);
        }
      }
    }
    
    setUserIdentifier(identifier);
    setIsReady(true);
  }, [session]);

  const handleLogout = () => {
    // Clear passkey verification on logout
    localStorage.removeItem('minaid_passkey_last_verified');
    localStorage.removeItem('minaid_passkey_verified_did');
    sessionStorage.removeItem('minaid_passkey_verified');
    
    logout();
    router.push('/');
  };

  const handleVerificationComplete = (result: VerificationResult) => {
    console.log('[VerifierDashboard] Verification complete:', result);
    setRefreshTrigger(prev => prev + 1);
  };

  // Show loading while checking auth
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            {/* Logo/Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">✓</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Verifier Portal</h1>
                <p className="text-xs text-gray-500">Request & Verify Proofs</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push('/verifier')}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Verify
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Settings
              </button>
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-4">
              <button
                onClick={handleLogout}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Banner */}
        <div className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Verification Portal 🔍
          </h2>
          <p className="text-purple-100">
            Request zero-knowledge proofs or scan QR codes to verify credentials without accessing private data.
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 bg-white rounded-xl shadow-lg p-2 flex space-x-2">
          <button
            onClick={() => setActiveTab('request')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'request'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">📋</span>
            Create Request
          </button>
          <button
            onClick={() => setActiveTab('scan')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'scan'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">📷</span>
            Scan Proof
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">📊</span>
            History
          </button>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'request' && (
            <ProofRequestCard />
          )}

          {activeTab === 'scan' && (
            <ProofScannerCard onVerificationComplete={handleVerificationComplete} />
          )}

          {activeTab === 'history' && (
            <VerificationHistoryCard key={refreshTrigger} />
          )}
        </div>

        {/* Info Banner */}
        <div className="mt-8 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl shadow-lg p-6 border border-blue-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">ℹ️</span> How Verification Works
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">1️⃣</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Create Request</h4>
              <p className="text-sm text-gray-600">
                Specify what you need to verify (e.g., age 18+, KYC status)
              </p>
            </div>

            <div>
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">2️⃣</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Share or Scan</h4>
              <p className="text-sm text-gray-600">
                Share QR code or scan user's proof to receive their ZK proof
              </p>
            </div>

            <div>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mb-3">
                <span className="text-2xl">3️⃣</span>
              </div>
              <h4 className="font-semibold text-gray-900 mb-1">Verify On-Chain</h4>
              <p className="text-sm text-gray-600">
                Cryptographically verify the proof without seeing private data
              </p>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            🔒 Zero-knowledge proofs allow verification without exposing sensitive information.
          </p>
        </div>
      </main>
    </div>
  );
}
