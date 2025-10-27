/**
 * EnhancedDashboard.tsx
 * 
 * Enhanced dashboard layout with modern UI and better organization
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { ProfileCard } from './dashboard/ProfileCard';
import { CredentialsCard } from './dashboard/CredentialsCard';
import { ProofsHistoryCard } from './dashboard/ProofsHistoryCard';
import { QuickActionsCard } from './dashboard/QuickActionsCard';
import { ProofGeneratorModal } from './proofs/ProofGeneratorModal';

export function EnhancedDashboard() {
  const router = useRouter();
  const { session, logout } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  const handleGenerateProof = () => {
    setIsModalOpen(true);
  };

  const handleProofGenerated = (proof: any) => {
    console.log('[Dashboard] Proof generated:', proof);
    // Trigger refresh of ProofsHistoryCard
    setRefreshTrigger(prev => prev + 1);
  };

  if (!session) {
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
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">MinaID</h1>
                <p className="text-xs text-gray-500">Zero-Knowledge Identity</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-6">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push('/verifier')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
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
        <div className="mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <h2 className="text-2xl font-bold mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-indigo-100">
            Manage your decentralized identity and generate zero-knowledge proofs securely.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Left Column - Profile */}
          <div className="lg:col-span-2">
            <ProfileCard session={session} />
          </div>

          {/* Right Column - Quick Actions */}
          <div>
            <QuickActionsCard 
              onGenerateProof={handleGenerateProof}
              isLoading={isLoading}
            />
          </div>
        </div>

        {/* Credentials Section */}
        <div className="mb-6">
          <CredentialsCard />
        </div>

        {/* Proofs History Section */}
        <div className="mb-6">
          <ProofsHistoryCard key={refreshTrigger} />
        </div>

        {/* Security Status Banner */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-lg p-6 border border-green-200">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🔐</span> Security Status
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Passkey Active</p>
                <p className="text-xs text-gray-600">Biometric secured</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Keys Encrypted</p>
                <p className="text-xs text-gray-600">Device-bound</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">DID Registered</p>
                <p className="text-xs text-gray-600">On-chain verified</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Privacy First</p>
                <p className="text-xs text-gray-600">Zero-knowledge</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            🔒 Your data is encrypted and stored locally. We never have access to your credentials.
          </p>
        </div>
      </main>

      {/* Proof Generator Modal */}
      <ProofGeneratorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onProofGenerated={handleProofGenerated}
      />
    </div>
  );
}
