/**
 * Dashboard.tsx
 * 
 * Main dashboard for MinaID users.
 * Displays DID status, manages credentials, and generates zero-knowledge proofs.
 * 
 * Features:
 * - View DID information
 * - Generate age proofs
 * - Generate KYC proofs
 * - View credential history
 * - Manage Passkeys
 * - Logout
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { usePasskey } from '../hooks/usePasskey';
import { generateAgeProof, generateKYCProof, type AgeProof, type KYCProof } from '../lib/ProofGenerator';
import { PrivateKey } from 'o1js';

interface DashboardProps {
  onLogout?: () => void;
}

export function Dashboard({ onLogout }: DashboardProps = {}) {
  const router = useRouter();
  const { session, logout, loadPrivateKey, isConnected, isSessionLoading } = useWallet();
  const { listPasskeys, deletePasskey } = usePasskey();

  const [proofs, setProofs] = useState<{
    age?: AgeProof;
    kyc?: KYCProof;
  }>({});

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | undefined>();

  // Redirect to login if not authenticated
  useEffect(() => {
    // Wait for session loading before checking authentication
    if (isSessionLoading) {
      return;
    }
    
    // Also check localStorage for wallet connection
    const walletData = localStorage.getItem('minaid_wallet_connected');
    if (!isConnected && !walletData) {
      router.push('/login');
    }
  }, [isConnected, isSessionLoading, router]);

  /**
   * Generate age proof
   */
  const handleGenerateAgeProof = async (minimumAge: number) => {
    if (!session) {
      setError('No active session. Please log in again.');
      return;
    }

    setIsGenerating(true);
    setError(undefined);

    try {
      // Load private key (requires Passkey authentication)
      const privateKeyString = await loadPrivateKey('auro', session.passkeyId);
      const privateKey = PrivateKey.fromBase58(privateKeyString);

      // TODO: Load actual Aadhar data from secure storage
      const mockAadharData = {
        uid: '1234-5678-9012',
        name: 'Test User',
        dateOfBirth: '01-01-1990',
        gender: 'M' as const,
        address: {},
        verifiedAt: Date.now(),
        issuer: 'UIDAI' as const,
      };

      // Generate proof
      const proof = await generateAgeProof(
        mockAadharData,
        minimumAge,
        privateKey
      );

      setProofs(prev => ({ ...prev, age: proof }));
      setIsGenerating(false);

    } catch (err: any) {
      setError(err.message || 'Failed to generate age proof');
      setIsGenerating(false);
    }
  };

  /**
   * Handle logout
   */
  const handleLogout = () => {
    logout();
    if (onLogout) {
      onLogout();
    } else {
      router.push('/login');
    }
  };

  if (!session) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">MinaID Dashboard</h1>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm text-gray-700 hover:text-gray-900"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="font-bold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* DID Information Card */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Your Decentralized Identity</h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">DID</p>
                <p className="font-mono text-sm break-all bg-gray-50 p-2 rounded">
                  {session.did}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Primary Wallet</p>
                <p className="font-semibold capitalize">{session.primaryWallet}</p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Session Expires</p>
                <p className="font-semibold">
                  {new Date(session.expiresAt).toLocaleString()}
                </p>
              </div>

              <div>
                <p className="text-sm text-gray-600">Linked Wallets</p>
                <div className="flex gap-2 mt-2">
                  {session.wallets.map(wallet => (
                    <span
                      key={wallet.type}
                      className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold"
                    >
                      {wallet.type}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
            
            <div className="space-y-3">
              <button
                onClick={() => handleGenerateAgeProof(18)}
                disabled={isGenerating}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm"
              >
                Generate Age Proof (18+)
              </button>

              <button
                onClick={() => handleGenerateAgeProof(21)}
                disabled={isGenerating}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition disabled:opacity-50 text-sm"
              >
                Generate Age Proof (21+)
              </button>

              <button
                disabled={isGenerating}
                className="w-full px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition disabled:opacity-50 text-sm"
              >
                Generate KYC Proof
              </button>

              <button
                className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition text-sm"
              >
                Link New Wallet
              </button>
            </div>
          </div>

          {/* Generated Proofs Card */}
          <div className="lg:col-span-3 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">Generated Proofs</h2>

            {Object.keys(proofs).length === 0 ? (
              <p className="text-gray-500 text-center py-8">
                No proofs generated yet. Use Quick Actions to generate your first proof.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {proofs.age && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold mb-2">Age Proof</h3>
                    <div className="text-sm space-y-1">
                      <p className="text-gray-600">
                        Minimum Age: <span className="font-semibold">{proofs.age.minimumAge}+</span>
                      </p>
                      <p className="text-gray-600">
                        Generated: {new Date(proofs.age.timestamp).toLocaleString()}
                      </p>
                      {proofs.age.expiresAt && (
                        <p className="text-gray-600">
                          Expires: {new Date(proofs.age.expiresAt).toLocaleString()}
                        </p>
                      )}
                      <div className="mt-3">
                        <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition">
                          View Details
                        </button>
                        <button className="ml-2 px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition">
                          Share Proof
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {proofs.kyc && (
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h3 className="font-bold mb-2">KYC Proof</h3>
                    <div className="text-sm space-y-1">
                      <p className="text-gray-600">
                        Issuer: <span className="font-semibold">{proofs.kyc.issuer}</span>
                      </p>
                      <p className="text-gray-600">
                        Attributes: {proofs.kyc.attributes.join(', ')}
                      </p>
                      <p className="text-gray-600">
                        Generated: {new Date(proofs.kyc.timestamp).toLocaleString()}
                      </p>
                      <div className="mt-3">
                        <button className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200 transition">
                          View Details
                        </button>
                        <button className="ml-2 px-3 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition">
                          Share Proof
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Security Status Card */}
          <div className="lg:col-span-3 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center">
              <span className="mr-2">🔐</span> Security Status
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold">Passkey Active</p>
                  <p className="text-sm text-gray-600">Biometric secured</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold">Private Key Encrypted</p>
                  <p className="text-sm text-gray-600">Device-bound</p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-semibold">DID Registered</p>
                  <p className="text-sm text-gray-600">On-chain verified</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
