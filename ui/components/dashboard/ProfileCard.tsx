/**
 * ProfileCard.tsx
 * 
 * Display user's DID profile information with enhanced UI
 */

'use client';

import React, { useState } from 'react';
import { WalletSession } from '../../context/WalletContext';

interface ProfileCardProps {
  session: WalletSession;
}

export function ProfileCard({ session }: ProfileCardProps) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateDID = (did: string) => {
    return `${did.substring(0, 20)}...${did.substring(did.length - 20)}`;
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg p-6 border border-indigo-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Your Identity</h2>
        <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
          Active
        </div>
      </div>

      {/* DID Display */}
      <div className="mb-6">
        <label className="text-sm font-medium text-gray-600 mb-2 block">
          Decentralized Identifier (DID)
        </label>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-white rounded-lg p-3 font-mono text-sm break-all border border-gray-200">
            {truncateDID(session.did)}
          </div>
          <button
            onClick={() => copyToClipboard(session.did)}
            className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center"
            title="Copy full DID"
          >
            {copied ? (
              <span className="text-sm">✓</span>
            ) : (
              <span className="text-sm">📋</span>
            )}
          </button>
        </div>
        {copied && (
          <p className="text-sm text-green-600 mt-1">Copied to clipboard!</p>
        )}
      </div>

      {/* Wallet Information */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">
            Primary Wallet
          </label>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <p className="font-semibold text-gray-900 capitalize">
              {session.primaryWallet}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium text-gray-600 mb-1 block">
            Linked Wallets
          </label>
          <div className="bg-white rounded-lg p-3 border border-gray-200">
            <div className="flex flex-wrap gap-1">
              {session.wallets.map(wallet => (
                <span
                  key={wallet.type}
                  className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium"
                >
                  {wallet.type}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Session Info */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Session Expires</span>
          <span className="font-semibold text-gray-900">
            {new Date(session.expiresAt).toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
