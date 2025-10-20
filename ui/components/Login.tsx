/**
 * Login.tsx
 * 
 * P2P biometric login component for MinaID.
 * Uses Passkey authentication to decrypt private keys and establish session.
 * 
 * Flow:
 * 1. User triggers login
 * 2. Passkey authentication (biometric)
 * 3. Retrieve and decrypt private key
 * 4. Load wallet session
 * 5. Redirect to dashboard
 * 
 * Security:
 * - No passwords needed
 * - Biometric authentication required
 * - Private key decrypted in memory only
 * - Session auto-expires after timeout
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { usePasskey } from '../hooks/usePasskey';

interface LoginState {
  loading: boolean;
  error?: string;
  success?: boolean;
}

interface LoginProps {
  onSuccess?: () => void;
}

export function Login({ onSuccess }: LoginProps = {}) {
  const router = useRouter();
  const { login } = useWallet();
  const { authenticateWithPasskey, listPasskeys, isSupported } = usePasskey();

  const [state, setState] = useState<LoginState>({
    loading: false,
  });

  const [selectedPasskeyId, setSelectedPasskeyId] = useState<string | undefined>();

  /**
   * Handle biometric login with Passkey
   */
  const handleLogin = async () => {
    setState({ loading: true, error: undefined });

    try {
      if (!isSupported) {
        throw new Error('Passkeys are not supported in this browser');
      }

      // Authenticate with Passkey (triggers biometric prompt)
      const authResult = await authenticateWithPasskey(selectedPasskeyId);

      if (!authResult.userHandle) {
        throw new Error('No DID found in Passkey. Please sign up first.');
      }

      // Login with wallet context (loads session)
      await login(authResult.id);

      setState({ loading: false, success: true });

      // Call success callback or redirect
      if (onSuccess) {
        setTimeout(() => {
          onSuccess();
        }, 1000);
      } else {
        setTimeout(() => {
          router.push('/dashboard');
        }, 1000);
      }

    } catch (error: any) {
      setState({
        loading: false,
        error: error.message || 'Login failed. Please try again.',
      });
    }
  };

  /**
   * Handle autofill/conditional UI login
   */
  const handleAutofillLogin = async () => {
    setState({ loading: true, error: undefined });

    try {
      // Use conditional UI (browser autofill)
      const authResult = await authenticateWithPasskey();

      if (!authResult.userHandle) {
        throw new Error('No DID found');
      }

      await login(authResult.id);

      setState({ loading: false, success: true });
      
      // Call success callback or redirect
      if (onSuccess) {
        onSuccess();
      } else {
        router.push('/dashboard');
      }

    } catch (error: any) {
      setState({
        loading: false,
        error: error.message || 'Autofill login failed',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome Back</h1>
          <p className="text-gray-600">
            Login to MinaID with your biometric
          </p>
        </div>

        {/* Success Message */}
        {state.success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
            <p className="font-bold">Login Successful! ✓</p>
            <p className="text-sm">Redirecting to dashboard...</p>
          </div>
        )}

        {/* Error Message */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="font-bold">Login Failed</p>
            <p className="text-sm">{state.error}</p>
          </div>
        )}

        {/* Login Methods */}
        {!state.success && (
          <div className="space-y-4">
            {/* Primary Login Button */}
            <button
              onClick={handleLogin}
              disabled={state.loading || !isSupported}
              className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center justify-center space-x-3"
            >
              <span className="text-2xl">🔐</span>
              <span className="font-bold">
                {state.loading ? 'Authenticating...' : 'Login with Passkey'}
              </span>
            </button>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-bold text-sm mb-2">What happens when you click?</h3>
              <ul className="text-xs space-y-1 text-gray-700">
                <li>1️⃣ Your device prompts for Face ID / Touch ID</li>
                <li>2️⃣ Your private key is decrypted (stays on device)</li>
                <li>3️⃣ You're logged in - no passwords needed</li>
              </ul>
            </div>

            {/* Divider */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Or</span>
              </div>
            </div>

            {/* Alternative: Sign Up Link */}
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-2">
                Don't have a MinaID yet?
              </p>
              <button
                onClick={() => router.push('/signup')}
                className="text-blue-600 hover:text-blue-700 font-semibold"
              >
                Create Your Identity →
              </button>
            </div>
          </div>
        )}

        {/* Browser Compatibility Warning */}
        {!isSupported && (
          <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-sm text-yellow-800">
              ⚠️ Passkeys are not supported in this browser. Please use Chrome, Safari, or Edge for the best experience.
            </p>
          </div>
        )}

        {/* Security Notice */}
        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            🔒 Your private keys never leave this device.<br />
            All authentication happens locally with your biometric.
          </p>
        </div>
      </div>
    </div>
  );
}
