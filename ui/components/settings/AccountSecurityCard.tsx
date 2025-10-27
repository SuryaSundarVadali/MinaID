/**
 * AccountSecurityCard.tsx
 * 
 * Security settings and passkey management
 */

'use client';

import React, { useState } from 'react';
import type { WalletSession } from '../../context/WalletContext';

interface AccountSecurityCardProps {
  session: WalletSession;
}

export function AccountSecurityCard({ session }: AccountSecurityCardProps) {
  const [isChangingPasskey, setIsChangingPasskey] = useState(false);

  const handleChangePasskey = async () => {
    setIsChangingPasskey(true);
    try {
      // TODO: Implement passkey change logic
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert('Passkey change functionality coming soon!');
    } catch (error) {
      console.error('[Security] Failed to change passkey:', error);
      alert('Failed to change passkey. Please try again.');
    } finally {
      setIsChangingPasskey(false);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Security Settings</h2>

      {/* Current Security Status */}
      <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
          <span className="mr-2">✅</span>
          Current Security Status
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Passkey Authentication</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Active
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Private Key Encryption</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              AES-256-GCM
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Device Binding</span>
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
              Enabled
            </span>
          </div>
        </div>
      </div>

      {/* Passkey Information */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Passkey Details</h3>
        <div className="space-y-3">
          <div className="p-4 border border-gray-200 rounded-lg">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="font-medium text-gray-900">Biometric Passkey</p>
                <p className="text-sm text-gray-600 mt-1">
                  Active and device-bound
                </p>
                <p className="text-xs text-gray-500 mt-1 font-mono">
                  ID: {session.passkeyId.substring(0, 20)}...
                </p>
              </div>
              <span className="text-2xl">🔐</span>
            </div>
          </div>
        </div>
      </div>

      {/* Security Actions */}
      <div className="space-y-3">
        <button
          onClick={handleChangePasskey}
          disabled={isChangingPasskey}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isChangingPasskey ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Updating...
            </>
          ) : (
            'Add New Passkey (Coming Soon)'
          )}
        </button>
      </div>

      {/* Security Tips */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h4 className="font-semibold text-gray-900 mb-2">🛡️ Security Best Practices</h4>
        <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
          <li>Never share your passkey or biometric data</li>
          <li>Your private keys are encrypted with your passkey</li>
          <li>Keep your device secure and up-to-date</li>
          <li>Enable device lock (PIN, password, biometric)</li>
        </ul>
      </div>
    </div>
  );
}
