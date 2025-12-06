/**
 * ProfileCard.tsx
 * 
 * Display user's DID profile information with enhanced UI
 */

'use client';

import React, { useState } from 'react';
import { WalletSession } from '../../context/WalletContext';

interface ProfileCardProps {
  session?: WalletSession;
}

export function ProfileCard({ session }: ProfileCardProps) {
  const [copied, setCopied] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [walletInfo, setWalletInfo] = useState<any>(null);

  // Load username and wallet info from localStorage
  React.useEffect(() => {
    const storedName = localStorage.getItem('minaid_username');
    if (storedName) {
      setUsername(storedName);
    }

    // Check for wallet connection data
    const walletData = localStorage.getItem('minaid_wallet_connected');
    if (walletData) {
      const parsed = JSON.parse(walletData);
      setWalletInfo(parsed);
      if (parsed.username && !storedName) {
        setUsername(parsed.username);
      }
    }
  }, []);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const truncateDID = (did: string) => {
    return `${did.substring(0, 20)}...${did.substring(did.length - 20)}`;
  };

  const truncateAddress = (address: string) => {
    return `${address.substring(0, 10)}...${address.substring(address.length - 8)}`;
  };

  // Show wallet-connected profile if no session but wallet is connected
  if (!session && walletInfo) {
    return (
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg p-4 sm:p-6 border border-indigo-100">
        <div className="flex items-center justify-between mb-4 sm:mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {username || 'Welcome!'}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Wallet Connected</p>
          </div>
          <div className="px-2 sm:px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-semibold flex items-center">
            <span className="w-2 h-2 bg-blue-500 rounded-full mr-1 sm:mr-2 animate-pulse"></span>
            Connected
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <label className="text-xs sm:text-sm font-medium text-gray-600 mb-2 block">
            Wallet Address
          </label>
          <div className="flex items-center space-x-2">
            <div className="flex-1 bg-white rounded-lg p-2 sm:p-3 font-mono text-xs sm:text-sm break-all border border-gray-200">
              {truncateAddress(walletInfo.address)}
            </div>
            <button
              onClick={() => copyToClipboard(walletInfo.address)}
              className="px-3 sm:px-4 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center flex-shrink-0"
              title="Copy address"
            >
              {copied ? (
                <span className="text-sm">✓</span>
              ) : (
                <span className="text-sm">📋</span>
              )}
            </button>
          </div>
          {copied && (
            <p className="text-xs sm:text-sm text-green-600 mt-1">Copied to clipboard!</p>
          )}
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-xs sm:text-sm text-yellow-800">
            <strong>⚠️ Setup Incomplete:</strong> Upload your Aadhar credential to generate proofs and complete your profile.
          </p>
        </div>
      </div>
    );
  }

  // Show incomplete profile message if no session
  if (!session) {
    return (
      <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl shadow-lg p-6 sm:p-8 border border-gray-200">
        <div className="text-center py-8">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">👤</span>
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">Profile Incomplete</h3>
          <p className="text-gray-600 text-sm">
            Connect your wallet and complete setup to view your profile
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-lg p-4 sm:p-6 border border-indigo-100">
      {/* Header with Username */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
            {username || 'Your Identity'}
          </h2>
          {username && (
            <p className="text-xs sm:text-sm text-gray-600 mt-1">Welcome back!</p>
          )}
        </div>
        <div className="px-2 sm:px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs sm:text-sm font-semibold flex items-center">
          <span className="w-2 h-2 bg-green-500 rounded-full mr-1 sm:mr-2 animate-pulse"></span>
          Active
        </div>
      </div>

      {/* DID Display */}
      <div className="mb-4 sm:mb-6">
        <label className="text-xs sm:text-sm font-medium text-gray-600 mb-2 block">
          Decentralized Identifier (DID)
        </label>
        <div className="flex items-center space-x-2">
          <div className="flex-1 bg-white rounded-lg p-2 sm:p-3 font-mono text-xs sm:text-sm break-all border border-gray-200">
            {truncateDID(session.did)}
          </div>
          <button
            onClick={() => copyToClipboard(session.did)}
            className="px-3 sm:px-4 py-2 sm:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center flex-shrink-0"
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
          <p className="text-xs sm:text-sm text-green-600 mt-1">Copied to clipboard!</p>
        )}
      </div>

      {/* Wallet Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div>
          <label className="text-xs sm:text-sm font-medium text-gray-600 mb-1 block">
            Primary Wallet
          </label>
          <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200">
            <p className="font-semibold text-gray-900 capitalize text-sm sm:text-base">
              {session.primaryWallet}
            </p>
            {walletInfo?.address && (
              <p className="font-mono text-xs text-gray-500 mt-1">
                {truncateAddress(walletInfo.address)}
              </p>
            )}
          </div>
        </div>

        <div className="col-span-1 sm:col-span-2">
          <label className="text-xs sm:text-sm font-medium text-gray-600 mb-1 block">
            Linked Wallets
          </label>
          <div className="bg-white rounded-lg p-2 sm:p-3 border border-gray-200">
            <div className="space-y-2">
              {session.wallets.map(wallet => (
                <div
                  key={wallet.type}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      {wallet.type}
                    </span>
                    {wallet.isLinked && (
                      <span className="w-2 h-2 bg-green-500 rounded-full" title="Linked"></span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600">
                      {wallet.address ? truncateAddress(wallet.address) : 'Not connected'}
                    </span>
                    {wallet.address && (
                      <button
                        onClick={() => copyToClipboard(wallet.address)}
                        className="p-1 hover:bg-gray-200 rounded transition-colors"
                        title="Copy address"
                      >
                        <span className="text-xs">{copied ? '✓' : '📋'}</span>
                      </button>
                    )}
                  </div>
                </div>
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
