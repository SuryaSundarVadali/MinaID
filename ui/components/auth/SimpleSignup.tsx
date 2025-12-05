/**
 * SimpleSignup.tsx
 * 
 * Complete signup flow with passkey creation for secure proof generation
 * Steps: Name → Wallet → Passkey → Dashboard
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../context/WalletContext';
import { usePasskey } from '../../hooks/usePasskey';
import { PrivateKey, PublicKey } from 'o1js';
import GradientBG from '../GradientBG';
import { registerDIDOnChain } from '../../lib/BlockchainHelpers';

type WalletType = 'auro' | 'metamask';

interface SignupState {
  step: 'name' | 'wallet' | 'connecting' | 'passkey' | 'complete';
  name: string;
  selectedWallet?: WalletType;
  walletAddress?: string;
  did?: string;
  passkeyId?: string;
  error?: string;
}

export function SimpleSignup() {
  const router = useRouter();
  const { connectAuroWallet, connectMetamask, storePrivateKey, createSession } = useWallet();
  const { createPasskey, isSupported: isPasskeySupported } = usePasskey();
  
  const [state, setState] = useState<SignupState>({
    step: 'name',
    name: '',
  });

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!state.name.trim()) {
      setState(prev => ({ ...prev, error: 'Please enter your name' }));
      return;
    }

    if (state.name.trim().length < 2) {
      setState(prev => ({ ...prev, error: 'Name must be at least 2 characters' }));
      return;
    }

    setState(prev => ({ ...prev, step: 'wallet', error: undefined }));
  };

  const handleConnectWallet = async (walletType: WalletType) => {
    setState(prev => ({ 
      ...prev, 
      step: 'connecting',
      selectedWallet: walletType,
      error: undefined 
    }));

    try {
      let walletInfo;
      
      if (walletType === 'auro') {
        if (typeof window === 'undefined' || !(window as any).mina) {
          throw new Error('Auro Wallet not detected. Please install the Auro Wallet extension.');
        }
        walletInfo = await connectAuroWallet();
      } else {
        if (typeof window === 'undefined' || !(window as any).ethereum) {
          throw new Error('MetaMask not detected. Please install the MetaMask extension.');
        }
        walletInfo = await connectMetamask();
      }

      // Store name in localStorage
      localStorage.setItem('minaid_username', state.name.trim());

      // Generate DID from wallet address
      const did = `did:mina:${walletInfo.address}`;

      setState(prev => ({
        ...prev,
        step: 'passkey',
        walletAddress: walletInfo.address,
        did,
        error: undefined,
      }));

    } catch (error: any) {
      console.error('[SimpleSignup] Connection failed:', error);
      setState(prev => ({
        ...prev,
        step: 'wallet',
        error: error.message || 'Failed to connect wallet',
      }));
    }
  };

  const handleCreatePasskey = async () => {
    if (!state.did || !state.selectedWallet) {
      setState(prev => ({ ...prev, error: 'Missing wallet information' }));
      return;
    }

    if (!isPasskeySupported) {
      setState(prev => ({ ...prev, error: 'Passkeys not supported in this browser. Please use Chrome, Safari, or Edge.' }));
      return;
    }

    setState(prev => ({ ...prev, error: undefined }));

    try {
      // Check if we have a stored private key for this DID
      // This prevents generating a new address every time if the user refreshes
      let privateKey: PrivateKey | undefined;
      let publicKey: PublicKey;
      
      // If using Auro wallet, we use the wallet address as DID
      if (state.selectedWallet === 'auro' && state.walletAddress) {
        console.log('[SimpleSignup] Using Auro wallet address as DID:', state.walletAddress);
        publicKey = PublicKey.fromBase58(state.walletAddress);
        // No private key available for Auro wallet
      } else {
        const storedKey = localStorage.getItem(`minaid_temp_key_${state.did}`);
        if (storedKey) {
          console.log('[SimpleSignup] Using stored temporary key for DID:', state.did);
          privateKey = PrivateKey.fromBase58(storedKey);
          publicKey = privateKey.toPublicKey();
        } else {
          // Generate new Mina private/public key pair
          privateKey = PrivateKey.random();
          publicKey = privateKey.toPublicKey();
          
          // Store temporarily to survive refresh until passkey is created
          localStorage.setItem(`minaid_temp_key_${state.did}`, privateKey.toBase58());
        }
        console.log('[SimpleSignup] Generated keys for DID:', state.did);
      }

      // Create Passkey with biometric authentication
      const passkey = await createPasskey(
        state.name.trim(),
        state.did
      );

      console.log('[SimpleSignup] Passkey created:', passkey.id);

      // Encrypt and store private key with Passkey
      // If using Auro wallet, we store a marker string
      await storePrivateKey(
        state.selectedWallet, 
        privateKey ? privateKey.toBase58() : 'WALLET_MANAGED', 
        passkey.id, 
        state.did
      );

      console.log('[SimpleSignup] Private key stored securely');

      // Create session without authentication (user just created passkey)
      createSession(state.did, passkey.id, state.selectedWallet);

      console.log('[SimpleSignup] Session created');

      // Store complete signup data
      const signupData = {
        walletType: state.selectedWallet,
        address: state.walletAddress!,
        timestamp: Date.now(),
        username: state.name.trim(),
        did: state.did,
        passkeyId: passkey.id,
        publicKey: publicKey.toBase58(),
      };
      localStorage.setItem('minaid_wallet_connected', JSON.stringify(signupData));

      // Register DID on blockchain (async, don't block UI)
      registerDIDOnChain(state.did, publicKey.toBase58(), privateKey?.toBase58())
        .then((result: string | null) => {
          if (result === 'already-registered') {
            console.log('[SimpleSignup] DID already registered on blockchain (this is OK)');
          } else if (result) {
            console.log('[SimpleSignup] DID registered on blockchain:', result);
            // Store transaction hash
            localStorage.setItem(`minaid_did_tx_${state.did}`, result);
          } else {
            console.log('[SimpleSignup] DID registration skipped or failed (non-critical)');
          }
        })
        .catch((err: Error) => {
          console.warn('[SimpleSignup] DID registration failed (non-blocking):', err.message);
        });

      setState(prev => ({
        ...prev,
        step: 'complete',
        passkeyId: passkey.id,
      }));

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('[SimpleSignup] Passkey creation failed:', error);
      setState(prev => ({
        ...prev,
        error: error.message || 'Failed to create passkey. Please try again.',
      }));
    }
  };

  return (
    <GradientBG>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            {/* Logo/Title */}
            <div className="text-center mb-6 sm:mb-8">
              <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                Create Account
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Set up your MinaID in seconds
              </p>
            </div>

            {/* Error Display */}
            {state.error && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs sm:text-sm text-red-700">{state.error}</p>
              </div>
            )}

            {/* Step 1: Enter Name */}
            {state.step === 'name' && (
              <form onSubmit={handleNameSubmit} className="space-y-4 sm:space-y-6">
                <div>
                  <label 
                    htmlFor="name" 
                    className="block text-sm font-medium text-gray-700 mb-2"
                  >
                    Name or Username
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={state.name}
                    onChange={(e) => setState(prev => ({ ...prev, name: e.target.value, error: undefined }))}
                    placeholder="Enter your name"
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all text-gray-900"
                    autoFocus
                  />
                  <p className="mt-2 text-xs text-gray-500">
                    This will be displayed on your dashboard
                  </p>
                </div>

                <button
                  type="submit"
                  className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98]"
                >
                  Continue
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => router.push('/login')}
                    className="text-sm text-gray-600 hover:text-gray-900"
                  >
                    Already have an account? <span className="text-indigo-600 font-semibold">Login</span>
                  </button>
                </div>
              </form>
            )}

            {/* Step 2: Connect Wallet */}
            {state.step === 'wallet' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 rounded-full mb-3">
                    <span className="text-2xl">✓</span>
                  </div>
                  <p className="text-gray-700">
                    Welcome, <span className="font-bold text-gray-900">{state.name}</span>!
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Now connect your wallet to complete setup
                  </p>
                </div>

                <div className="space-y-3">
                  {/* Auro Wallet */}
                  <button
                    onClick={() => handleConnectWallet('auro')}
                    className="w-full flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 border-2 border-indigo-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-indigo-600 font-bold">A</span>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-gray-900 group-hover:text-indigo-600 text-sm sm:text-base truncate">
                          Connect with Auro Wallet
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Recommended for Mina Protocol
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* MetaMask */}
                  <button
                    onClick={() => handleConnectWallet('metamask')}
                    className="w-full flex items-center justify-center px-4 sm:px-6 py-3 sm:py-4 border-2 border-orange-200 rounded-xl hover:border-orange-400 hover:bg-orange-50 transition-all group active:scale-[0.98]"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-orange-600 font-bold">M</span>
                      </div>
                      <div className="text-left min-w-0">
                        <p className="font-semibold text-gray-900 group-hover:text-orange-600 text-sm sm:text-base truncate">
                          Connect with MetaMask
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          Multi-chain support
                        </p>
                      </div>
                    </div>
                  </button>
                </div>

                <button
                  onClick={() => setState(prev => ({ ...prev, step: 'name' }))}
                  className="w-full text-sm text-gray-600 hover:text-gray-900 py-2"
                >
                  ← Back to name
                </button>
              </div>
            )}

            {/* Step 3: Connecting */}
            {state.step === 'connecting' && (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-700 font-medium mb-2">Connecting wallet...</p>
                <p className="text-sm text-gray-500">
                  Please approve the connection in your wallet extension
                </p>
              </div>
            )}

            {/* Step 4: Create Passkey */}
            {state.step === 'passkey' && (
              <div className="space-y-4 sm:space-y-6">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                    <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Secure Your Account
                  </h2>
                  <p className="text-sm text-gray-600">
                    Create a passkey to securely sign and verify proofs
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <h3 className="font-semibold text-blue-900 text-sm">What is a Passkey?</h3>
                  <p className="text-xs text-blue-800">
                    A passkey uses biometric authentication (fingerprint, Face ID) to securely encrypt your private keys. This enables you to:
                  </p>
                  <ul className="space-y-2 text-xs text-blue-800">
                    <li className="flex items-start">
                      <svg className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Sign zero-knowledge proofs with your private key</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Verify credentials using your public key</span>
                    </li>
                    <li className="flex items-start">
                      <svg className="w-4 h-4 text-blue-600 mr-2 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span>Prevent unauthorized access to your keys</span>
                    </li>
                  </ul>
                </div>

                <button
                  onClick={handleCreatePasskey}
                  disabled={!isPasskeySupported}
                  className="w-full bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isPasskeySupported ? 'Create Passkey' : 'Passkeys Not Supported'}
                </button>

                {!isPasskeySupported && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-xs text-yellow-800">
                      Passkeys require Chrome, Safari, or Edge browser with biometric authentication enabled.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 5: Complete */}
            {state.step === 'complete' && (
              <div className="text-center py-8">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
                  <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Account Created Successfully!
                </h2>
                <p className="text-gray-600 mb-6">
                  Your account is now secured with passkey authentication
                </p>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="space-y-2 text-sm text-green-800">
                    <p className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Wallet Connected
                    </p>
                    <p className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Passkey Created
                    </p>
                    <p className="flex items-center justify-center">
                      <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Keys Encrypted
                    </p>
                  </div>
                </div>
                <p className="text-sm text-gray-500">
                  Redirecting to dashboard...
                </p>
              </div>
            )}

            {/* Security Notice */}
            <div className="mt-6 p-3 sm:p-4 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 text-center leading-relaxed">
                🔒 Your private keys are encrypted with your passkey and stored locally. Upload Aadhar to start generating proofs.
              </p>
            </div>
          </div>
        </div>
      </div>
    </GradientBG>
  );
}
