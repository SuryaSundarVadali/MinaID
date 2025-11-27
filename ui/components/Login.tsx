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
import { rateLimiter, RateLimitConfigs, formatTimeRemaining } from '../lib/RateLimiter';
import { logSecurityEvent } from '../lib/SecurityUtils';
import { hasPasskey, validatePasskeyRequired } from '../lib/DataManagement';
import GradientBG from './GradientBG';
import LoadingSpinner from './LoadingSpinner';
import styles from '../styles/Home.module.css';

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

      // Rate limiting check
      const rateLimitKey = 'login:user';
      if (!rateLimiter.isAllowed(rateLimitKey, RateLimitConfigs.AUTH)) {
        const timeRemaining = rateLimiter.getTimeUntilUnblocked(rateLimitKey);
        throw new Error(
          `Too many login attempts. Please try again in ${formatTimeRemaining(timeRemaining)}.`
        );
      }

      // Authenticate with Passkey (triggers biometric prompt)
      const authResult = await authenticateWithPasskey(selectedPasskeyId);

      if (!authResult.userHandle) {
        throw new Error('No DID found in Passkey. Please sign up first.');
      }

      // ENFORCE: Validate passkey exists for this DID
      try {
        validatePasskeyRequired(authResult.userHandle);
      } catch (err: any) {
        throw new Error('Passkey registration required. Please complete signup first.');
      }

      // Login with wallet context (loads session)
      await login(authResult.id);

      // Log successful login
      logSecurityEvent('login_success', { 
        passkeyId: authResult.id,
        did: authResult.userHandle
      }, 'info');

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
      // Log failed login
      logSecurityEvent('login_failed', { error: error.message }, 'warning');
      
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
    <GradientBG>
      <div className={styles.main}>
        <div className={styles.center}>
          <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
            Welcome Back
          </h1>
          <p style={{ mixBlendMode: 'difference', filter: 'invert(0.7)', marginBottom: '2rem' }}>
            Login to MinaID with your biometric
          </p>
        </div>

        <div className={styles.stateContainer}>
          {/* Loading Indicator */}
          {state.loading && (
            <div className={styles.state} style={{ 
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '2px solid #8B5CF6',
              padding: '2rem',
              textAlign: 'center'
            }}>
              <LoadingSpinner size="medium" message="Authenticating with passkey..." />
            </div>
          )}

          {/* Success Message */}
          {state.success && !state.loading && (
            <div className={styles.state}>
              <p className={styles.bold}>Login Successful! ✓</p>
              <p>Redirecting to dashboard...</p>
            </div>
          )}

          {/* Error Message */}
          {state.error && !state.loading && (
            <div className={styles.state}>
              <p className={`${styles.bold} ${styles.error}`}>Login Failed</p>
              <p>{state.error}</p>
            </div>
          )}

          {/* Login Methods */}
          {!state.success && (
            <div className={styles.state}>
              <h2 className={styles.bold}>🔐 Biometric Login</h2>
              <button
                onClick={handleLogin}
                disabled={state.loading || !isSupported}
              >
                {state.loading ? 'Authenticating...' : 'Login with Passkey'}
              </button>
              
              <div style={{ marginTop: '1rem', fontSize: '0.875rem' }}>
                <p className={styles.bold}>What happens when you click?</p>
                <p>1️⃣ Device prompts for Face ID / Touch ID</p>
                <p>2️⃣ Private key decrypted (stays on device)</p>
                <p>3️⃣ You're logged in - no passwords</p>
              </div>
            </div>
          )}
        </div>

        {/* Browser Compatibility Warning */}
        {!isSupported && (
          <div className={styles.state}>
            <p className={styles.error}>
              ⚠️ Passkeys not supported in this browser. Use Chrome, Safari, or Edge.
            </p>
          </div>
        )}

        {/* Alternative: Sign Up Link */}
        {!state.success && (
          <div style={{ textAlign: 'center', marginTop: '2rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
            <p style={{ marginBottom: '0.5rem' }}>Don't have a MinaID yet?</p>
            <button
              onClick={() => router.push('/signup')}
              style={{ 
                background: 'none', 
                border: 'none', 
                textDecoration: 'underline', 
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Create Your Identity →
            </button>
          </div>
        )}

        {/* Security Notice */}
        <p className={styles.tagline} style={{ marginTop: '3rem' }}>
          🔒 YOUR PRIVATE KEYS NEVER LEAVE THIS DEVICE
        </p>
      </div>
    </GradientBG>
  );
}
