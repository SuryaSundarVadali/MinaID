/**
 * SettingsDashboard.tsx
 * 
 * Settings dashboard with account management and deletion
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { AccountSecurityCard } from './settings/AccountSecurityCard';
import { DataManagementCard } from './settings/DataManagementCard';
import { AccountDeletionCard } from './settings/AccountDeletionCard';

export function SettingsDashboard() {
  const router = useRouter();
  const { session, logout } = useWallet();
  const [activeSection, setActiveSection] = useState<'security' | 'data' | 'danger'>('security');
  const [isReady, setIsReady] = useState(false);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(null);

  // Check for authentication via session or localStorage
  useEffect(() => {
    let identifier = session?.did || null;
    
    // Also check localStorage for wallet connection
    if (!identifier) {
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        try {
          const parsed = JSON.parse(walletData);
          identifier = parsed.did || parsed.address;
        } catch (e) {
          console.error('[SettingsDashboard] Failed to parse wallet data:', e);
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

  // Show loading while checking auth
  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // Create effective session for components (use actual session or construct from localStorage)
  const effectiveSession = session || (userIdentifier ? {
    did: userIdentifier,
    passkeyId: '',
    wallets: [],
    primaryWallet: 'auro' as const,
    expiresAt: Date.now() + 3600000,
  } : null);

  if (!effectiveSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Please log in to access settings.</p>
        </div>
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
                <span className="text-white font-bold text-xl">⚙️</span>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
                <p className="text-xs text-gray-500">Account Management</p>
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
                className="text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
              >
                Verify
              </button>
              <button
                onClick={() => router.push('/settings')}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 transition-colors"
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
            Account Settings ⚙️
          </h2>
          <p className="text-indigo-100">
            Manage your security settings, data, and account preferences.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="mb-6 bg-white rounded-xl shadow-lg p-2 flex space-x-2">
          <button
            onClick={() => setActiveSection('security')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeSection === 'security'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">🔒</span>
            Security
          </button>
          <button
            onClick={() => setActiveSection('data')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeSection === 'data'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">💾</span>
            Data
          </button>
          <button
            onClick={() => setActiveSection('danger')}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
              activeSection === 'danger'
                ? 'bg-red-600 text-white shadow-md'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <span className="mr-2">⚠️</span>
            Danger Zone
          </button>
        </div>

        {/* Content Sections */}
        <div className="space-y-6">
          {activeSection === 'security' && (
            <AccountSecurityCard session={effectiveSession} />
          )}

          {activeSection === 'data' && (
            <DataManagementCard session={effectiveSession} />
          )}

          {activeSection === 'danger' && (
            <AccountDeletionCard session={effectiveSession} />
          )}
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            🔒 Your data is encrypted and stored locally. Changes are immediate and irreversible.
          </p>
        </div>
      </main>
    </div>
  );
}
