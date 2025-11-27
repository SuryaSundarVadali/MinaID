/**
 * WalletLogin.tsx
 * 
 * Wallet-based authentication component for MinaID.
 * Supports multiple wallet types (Auro for Mina, MetaMask for EVM).
 * 
 * Features:
 * - Wallet connection (Auro/MetaMask)
 * - Network selection
 * - Automatic reconnection
 * - Error handling with clear messages
 * - Passkey authentication flow
 * 
 * Flow:
 * 1. User selects wallet type
 * 2. Wallet extension prompts for permission
 * 3. On approval, check for existing DID/Passkey
 * 4. If exists: Trigger Passkey auth and login
 * 5. If not: Redirect to signup
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../context/WalletContext';

type WalletType = 'auro' | 'metamask';

interface WalletLoginState {
  selectedWallet?: WalletType;
  connecting: boolean;
  error?: string;
}

export function WalletLogin() {
  const router = useRouter();
  const { 
    connectAuroWallet, 
    connectMetamask, 
    isConnected,
    session,
    hasStoredKey 
  } = useWallet();

  const [state, setState] = useState<WalletLoginState>({
    connecting: false,
  });

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isConnected && session) {
      router.push('/dashboard');
    }
  }, [isConnected, session, router]);

  /**
   * Handle Auro Wallet connection
   */
  const handleConnectAuro = async () => {
    setState({ selectedWallet: 'auro', connecting: true, error: undefined });

    try {
      // Check if Auro Wallet is installed
      if (typeof window === 'undefined' || !(window as any).mina) {
        throw new Error(
          'Auro Wallet not detected. Please install the Auro Wallet browser extension.'
        );
      }

      // Connect to Auro Wallet
      const walletInfo = await connectAuroWallet();
      
      console.log('[WalletLogin] Connected to Auro:', walletInfo.address);

      // Check if user has registered DID (stored key)
      const hasKey = hasStoredKey('auro');

      if (hasKey) {
        // User has existing account - proceed to passkey auth in Login component
        router.push('/login');
      } else {
        // New user - create basic session and go to dashboard
        // User will complete profile setup (Aadhar, passkey, DID) from dashboard
        router.push('/dashboard');
      }

      setState({ connecting: false });

    } catch (error: any) {
      console.error('[WalletLogin] Auro connection failed:', error);
      setState({
        selectedWallet: 'auro',
        connecting: false,
        error: error.message || 'Failed to connect to Auro Wallet',
      });
    }
  };

  /**
   * Handle MetaMask connection
   */
  const handleConnectMetaMask = async () => {
    setState({ selectedWallet: 'metamask', connecting: true, error: undefined });

    try {
      // Check if MetaMask is installed
      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error(
          'MetaMask not detected. Please install the MetaMask browser extension.'
        );
      }

      // Connect to MetaMask
      const walletInfo = await connectMetamask();
      
      console.log('[WalletLogin] Connected to MetaMask:', walletInfo.address);

      // Check if user has registered DID
      const hasKey = hasStoredKey('metamask');

      if (hasKey) {
        router.push('/login');
      } else {
        // New user - go to dashboard to complete profile setup
        router.push('/dashboard');
      }

      setState({ connecting: false });

    } catch (error: any) {
      console.error('[WalletLogin] MetaMask connection failed:', error);
      setState({
        selectedWallet: 'metamask',
        connecting: false,
        error: error.message || 'Failed to connect to MetaMask',
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100 p-4">
      <div className="max-w-md w-full">
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
          {/* Logo/Title */}
          <div className="text-center mb-6 sm:mb-8">
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">MinaID</h1>
            <p className="text-sm sm:text-base text-gray-600">
              Zero-Knowledge Decentralized Identity
            </p>
          </div>

          {/* Error Display */}
          {state.error && (
            <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs sm:text-sm text-red-700">{state.error}</p>
            </div>
          )}

          {/* Wallet Options */}
          <div className="space-y-3 sm:space-y-4">
            {/* Auro Wallet Button */}
            <button
              onClick={handleConnectAuro}
              disabled={state.connecting}
              className="w-full flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 border-2 border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
            >
              <div className="flex items-center space-x-3">
                {/* Auro Icon Placeholder */}
                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-indigo-600 font-bold">A</span>
                </div>
                
                <div className="text-left min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-indigo-600 text-sm sm:text-base truncate">
                    {state.connecting && state.selectedWallet === 'auro'
                      ? 'Connecting...'
                      : 'Connect with Auro Wallet'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    Recommended for Mina Protocol
                  </p>
                </div>
              </div>
            </button>

            {/* MetaMask Button */}
            <button
              onClick={handleConnectMetaMask}
              disabled={state.connecting}
              className="w-full flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 border-2 border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group active:scale-[0.98]"
            >
              <div className="flex items-center space-x-3">
                {/* MetaMask Icon Placeholder */}
                <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-orange-600 font-bold">M</span>
                </div>
                
                <div className="text-left min-w-0">
                  <p className="font-semibold text-gray-900 group-hover:text-orange-600 text-sm sm:text-base truncate">
                    {state.connecting && state.selectedWallet === 'metamask'
                      ? 'Connecting...'
                      : 'Connect with MetaMask'}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    Multi-chain support
                  </p>
                </div>
              </div>
            </button>
          </div>

          {/* Info Text */}
          <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
            <p className="text-xs sm:text-sm text-gray-600 text-center">
              Don't have an account?{' '}
              <button
                onClick={() => router.push('/signup')}
                className="text-indigo-600 hover:text-indigo-700 font-semibold"
              >
                Sign up
              </button>
            </p>
          </div>

          {/* Security Notice */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 text-center leading-relaxed">
              🔒 Your private keys are encrypted and stored locally.
              <br />
              We never have access to your credentials.
            </p>
          </div>
        </div>

        {/* Help Text */}
        <div className="mt-4 sm:mt-6 text-center px-4">
          <p className="text-xs sm:text-sm text-gray-600">
            Need help?{' '}
            <a
              href="https://docs.minaprotocol.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              View Documentation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
