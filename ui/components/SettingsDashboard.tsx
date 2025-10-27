/**
 * SettingsDashboard.tsx
 * 
 * Settings dashboard with account management and deletion
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { AccountSecurityCard } from './settings/AccountSecurityCard';
import { DataManagementCard } from './settings/DataManagementCard';
import { AccountDeletionCard } from './settings/AccountDeletionCard';

export function SettingsDashboard() {
  const router = useRouter();
  const { session, logout } = useWallet();
  const [activeSection, setActiveSection] = useState<'security' | 'data' | 'danger'>('security');

  const handleLogout = () => {
    logout();
    router.push('/');
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
            <AccountSecurityCard session={session} />
          )}

          {activeSection === 'data' && (
            <DataManagementCard session={session} />
          )}

          {activeSection === 'danger' && (
            <AccountDeletionCard session={session} />
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
