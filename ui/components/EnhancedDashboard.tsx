/**
 * EnhancedDashboard.tsx
 * 
 * Enhanced dashboard layout with modern UI and better organization
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { ProfileCard } from './dashboard/ProfileCard';
import { CredentialsCard } from './dashboard/CredentialsCard';
import { ProofsHistoryCard } from './dashboard/ProofsHistoryCard';
import { QuickActionsCard } from './dashboard/QuickActionsCard';
import { ProofGeneratorModal } from './proofs/ProofGeneratorModal';
import TransactionStatusCard from './dashboard/TransactionStatusCard';
import { hasPasskey } from '../lib/DataManagement';
import { usePasskey } from '../hooks/usePasskey';

export function EnhancedDashboard() {
  const router = useRouter();
  const { session, logout, isConnected } = useWallet();
  const { authenticateWithPasskey, isSupported } = usePasskey();
  const [isLoading, setIsLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [showProfileSetup, setShowProfileSetup] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [username, setUsername] = useState<string>('');
  
  // Passkey authentication state
  const [passkeyVerified, setPasskeyVerified] = useState(false);
  const [passkeyRequired, setPasskeyRequired] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string>('');
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);

  // Check if passkey verification is needed
  useEffect(() => {
    const walletData = localStorage.getItem('minaid_wallet_connected');
    if (walletData) {
      const data = JSON.parse(walletData);
      const userDid = data.did || data.address;
      
      // Check if user has a passkey registered
      if (userDid && hasPasskey(userDid)) {
        // Check if already verified in this session
        const sessionVerified = sessionStorage.getItem('minaid_passkey_verified');
        if (sessionVerified === 'true') {
          setPasskeyVerified(true);
        } else {
          setPasskeyRequired(true);
        }
      } else {
        // No passkey registered, allow access
        setPasskeyVerified(true);
      }
    } else {
      // No wallet connected, redirect to login
      router.push('/login');
    }
  }, [router]);

  // Check if user needs to complete profile setup
  useEffect(() => {
    // Skip profile check until passkey is verified
    if (!passkeyVerified && passkeyRequired) return;
    
    // Check for basic wallet connection (from SimpleSignup)
    const walletConnectionData = localStorage.getItem('minaid_wallet_connected');
    let userIdentifier = session?.did;
    
    if (walletConnectionData) {
      setWalletConnected(true);
      const data = JSON.parse(walletConnectionData);
      if (data.username) {
        setUsername(data.username);
      }
      // If no session DID, use wallet address as identifier
      if (!userIdentifier && data.address) {
        userIdentifier = data.address;
      }
    }

    // Load username from localStorage if available
    const storedName = localStorage.getItem('minaid_username');
    if (storedName) {
      setUsername(storedName);
    }

    // Check if Aadhar data exists (using DID or wallet address)
    if (userIdentifier) {
      const aadharData = localStorage.getItem(`aadhar_${userIdentifier}`);
      setShowProfileSetup(!aadharData);
    } else if (walletConnected) {
      // Wallet connected but no identifier available
      setShowProfileSetup(true);
    }
  }, [session, walletConnected, passkeyVerified, passkeyRequired]);
  
  // Handle passkey verification
  const handlePasskeyVerify = async () => {
    setVerifyingPasskey(true);
    setPasskeyError('');
    
    try {
      if (!isSupported) {
        throw new Error('Passkeys are not supported in this browser');
      }
      
      const result = await authenticateWithPasskey();
      
      if (result.id) {
        setPasskeyVerified(true);
        setPasskeyRequired(false);
        // Store in session storage so user doesn't need to re-verify on refresh
        sessionStorage.setItem('minaid_passkey_verified', 'true');
      } else {
        throw new Error('Passkey verification failed');
      }
    } catch (error: any) {
      console.error('[Dashboard] Passkey verification failed:', error);
      setPasskeyError(error.message || 'Passkey verification failed. Please try again.');
    } finally {
      setVerifyingPasskey(false);
    }
  };

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

  const handleCompleteSetup = () => {
    router.push('/upload-aadhar');
  };

  // Show loading while checking wallet connection
  if (!isConnected && !session && !walletConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Show passkey verification screen if required
  if (passkeyRequired && !passkeyVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-6">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Verify Your Identity</h1>
            <p className="text-gray-600">
              Please verify with your passkey to access your dashboard
            </p>
          </div>
          
          {passkeyError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {passkeyError}
            </div>
          )}
          
          <button
            onClick={handlePasskeyVerify}
            disabled={verifyingPasskey}
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {verifyingPasskey ? (
              <>
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Verifying...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
                </svg>
                Verify with Passkey
              </>
            )}
          </button>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Use a different account
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-4">
            {/* Logo/Title */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg sm:text-xl">M</span>
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold text-gray-900">MinaID</h1>
                <p className="text-[10px] sm:text-xs text-gray-500 hidden xs:block">Zero-Knowledge Identity</p>
              </div>
            </div>

            {/* Navigation */}
            <nav className="hidden md:flex items-center space-x-4 lg:space-x-6">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors px-2 py-1"
              >
                Dashboard
              </button>
              <button
                onClick={() => router.push('/verifier')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-2 py-1"
              >
                Verify
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors px-2 py-1"
              >
                Settings
              </button>
            </nav>

            {/* User Menu */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <button
                onClick={handleLogout}
                className="px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Profile Setup Banner - Show if incomplete */}
        {showProfileSetup && (
          <div className="mb-6 sm:mb-8 bg-gradient-to-r from-yellow-500 to-orange-500 rounded-xl shadow-lg p-6 sm:p-8 text-white">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex-1">
                <h2 className="text-xl sm:text-2xl font-bold mb-2">
                  Complete Your Profile Setup 🚀
                </h2>
                <p className="text-yellow-100 text-sm sm:text-base">
                  Upload your Aadhar credential and create a passkey to start generating zero-knowledge proofs securely.
                </p>
              </div>
              <button
                onClick={handleCompleteSetup}
                className="w-full sm:w-auto whitespace-nowrap bg-white text-orange-600 px-6 py-3 rounded-lg font-semibold hover:bg-yellow-50 transition-all shadow-md hover:shadow-lg"
              >
                Complete Setup →
              </button>
            </div>
          </div>
        )}

        {/* Welcome Banner */}
        <div className="mb-6 sm:mb-8 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-xl shadow-lg p-6 sm:p-8 text-white">
          <h2 className="text-xl sm:text-2xl font-bold mb-2">
            Welcome back! 👋
          </h2>
          <p className="text-indigo-100 text-sm sm:text-base">
            Manage your decentralized identity and generate zero-knowledge proofs securely.
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6">
          {/* Left Column - Profile */}
          <div className="lg:col-span-2">
            <ProfileCard session={session || undefined} />
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
        <div className="mb-4 sm:mb-6">
          <CredentialsCard />
        </div>

        {/* Proofs History Section */}
        <div className="mb-4 sm:mb-6">
          <ProofsHistoryCard key={refreshTrigger} />
        </div>

        {/* Blockchain Transactions Section */}
        <div className="mb-4 sm:mb-6">
          <TransactionStatusCard />
        </div>

        {/* Security Status Banner */}
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl shadow-lg p-4 sm:p-6 border border-green-200">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center">
            <span className="mr-2">🔐</span> Security Status
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">Passkey Active</p>
                <p className="text-xs text-gray-600">Biometric secured</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">Keys Encrypted</p>
                <p className="text-xs text-gray-600">Device-bound</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">DID Registered</p>
                <p className="text-xs text-gray-600">On-chain verified</p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 bg-white rounded-lg">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 text-xl">✓</span>
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm sm:text-base truncate">Privacy First</p>
                <p className="text-xs text-gray-600">Zero-knowledge</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500 px-4">
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
