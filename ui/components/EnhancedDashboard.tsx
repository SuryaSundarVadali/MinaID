/**
 * EnhancedDashboard.tsx
 * 
 * Dashboard with homepage-style UI using Monument Grotesk font and gradient background
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWallet } from '../context/WalletContext';
import GradientBG from './GradientBG';
import heroMinaLogo from '../public/assets/hero-mina-logo.svg';
import styles from '../styles/Home.module.css';
import { CredentialsCard } from './dashboard/CredentialsCard';
import { ProofsHistoryCard } from './dashboard/ProofsHistoryCard';
import { hasPasskey } from '../lib/DataManagement';
import { usePasskey } from '../hooks/usePasskey';

export function EnhancedDashboard() {
  const router = useRouter();
  const { session, logout, isConnected, isSessionLoading } = useWallet();
  const { authenticateWithPasskey, isSupported } = usePasskey();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [walletConnected, setWalletConnected] = useState(false);
  const [username, setUsername] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [userDid, setUserDid] = useState<string>('');
  
  // Passkey authentication state
  const [passkeyVerified, setPasskeyVerified] = useState(false);
  const [passkeyRequired, setPasskeyRequired] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string>('');
  const [verifyingPasskey, setVerifyingPasskey] = useState(false);

  // Check if passkey verification is needed
  useEffect(() => {
    if (isSessionLoading) return;
    
    const walletData = localStorage.getItem('minaid_wallet_connected');
    if (walletData) {
      const data = JSON.parse(walletData);
      const identifier = data.did || data.address;
      const isSimpleSignup = data.simpleSignup === true;
      const hasStoredPasskeyId = !!data.passkeyId;
      
      setWalletAddress(data.address || '');
      setUserDid(data.did || '');
      if (data.username) setUsername(data.username);
      
      // For simpleSignup users, skip passkey verification
      if (isSimpleSignup && !hasStoredPasskeyId) {
        setPasskeyVerified(true);
        return;
      }
      
      // Check if user has a passkey registered
      if (identifier && hasPasskey(identifier)) {
        const lastVerified = localStorage.getItem('minaid_passkey_last_verified');
        const verifiedDid = localStorage.getItem('minaid_passkey_verified_did');
        
        const verificationValid = lastVerified && 
          verifiedDid === identifier &&
          (Date.now() - parseInt(lastVerified)) < 24 * 60 * 60 * 1000;
        
        if (verificationValid) {
          setPasskeyVerified(true);
        } else {
          const sessionVerified = sessionStorage.getItem('minaid_passkey_verified');
          if (sessionVerified === 'true') {
            setPasskeyVerified(true);
            localStorage.setItem('minaid_passkey_last_verified', Date.now().toString());
            localStorage.setItem('minaid_passkey_verified_did', identifier);
          } else {
            setPasskeyRequired(true);
          }
        }
      } else {
        setPasskeyVerified(true);
      }
    } else if (!isConnected) {
      router.push('/login');
    }
  }, [router, isSessionLoading, isConnected]);

  // Load user data
  useEffect(() => {
    if (!passkeyVerified && passkeyRequired) return;
    
    const walletConnectionData = localStorage.getItem('minaid_wallet_connected');
    if (walletConnectionData) {
      setWalletConnected(true);
      const data = JSON.parse(walletConnectionData);
      if (data.username) setUsername(data.username);
      if (data.address) setWalletAddress(data.address);
      if (data.did) setUserDid(data.did);
    }

    const storedName = localStorage.getItem('minaid_username');
    if (storedName) setUsername(storedName);
  }, [session, walletConnected, passkeyVerified, passkeyRequired]);
  
  const handlePasskeyVerify = async () => {
    setVerifyingPasskey(true);
    setPasskeyError('');
    
    try {
      if (!isSupported) {
        throw new Error('Passkeys are not supported in this browser');
      }
      
      const result = await authenticateWithPasskey();
      
      if (result.id) {
        setPasskeyVerified(true);
        setPasskeyRequired(false);
        sessionStorage.setItem('minaid_passkey_verified', 'true');
        
        const walletData = localStorage.getItem('minaid_wallet_connected');
        if (walletData) {
          const data = JSON.parse(walletData);
          const identifier = data.did || data.address;
          localStorage.setItem('minaid_passkey_last_verified', Date.now().toString());
          localStorage.setItem('minaid_passkey_verified_did', identifier);
        }
      } else {
        throw new Error('Passkey verification failed');
      }
    } catch (error: any) {
      console.error('[Dashboard] Passkey verification failed:', error);
      setPasskeyError(error.message || 'Passkey verification failed. Please try again.');
    } finally {
      setVerifyingPasskey(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('minaid_passkey_last_verified');
    localStorage.removeItem('minaid_passkey_verified_did');
    sessionStorage.removeItem('minaid_passkey_verified');
    logout();
    router.push('/');
  };

  const truncateAddress = (address: string) => {
    if (!address) return '';
    return `${address.substring(0, 8)}...${address.substring(address.length - 6)}`;
  };

  // Show loading
  if (isSessionLoading || (!isConnected && !session && !walletConnected)) {
    return (
      <GradientBG>
        <div className={styles.main} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-white mx-auto mb-4"></div>
            <p style={{ color: 'white', marginTop: '1rem', fontFamily: 'var(--font-monument)' }}>Loading...</p>
          </div>
        </div>
      </GradientBG>
    );
  }
  
  // Passkey verification screen
  if (passkeyRequired && !passkeyVerified) {
    return (
      <GradientBG>
        <div className={styles.main}>
          <div className={styles.center}>
            <Image
              className={styles.logo}
              src={heroMinaLogo}
              alt="Mina Logo"
              width={150}
              height={150}
              priority
            />
          </div>
          
          <p className={styles.tagline}>VERIFY YOUR IDENTITY</p>
          
          <div style={{ 
            background: 'rgba(255,255,255,0.95)', 
            borderRadius: '8px', 
            padding: '2rem',
            maxWidth: '400px',
            width: '100%',
            border: '1px solid #2d2d2d'
          }}>
            {passkeyError && (
              <div style={{ 
                padding: '0.75rem', 
                background: '#FEE2E2', 
                border: '1px solid #FCA5A5',
                borderRadius: '4px',
                color: '#DC2626',
                marginBottom: '1rem',
                fontSize: '0.875rem'
              }}>
                {passkeyError}
              </div>
            )}
            
            <button
              onClick={handlePasskeyVerify}
              disabled={verifyingPasskey}
              className={styles.card}
              style={{ width: '100%', margin: 0, cursor: verifyingPasskey ? 'wait' : 'pointer' }}
            >
              <h2>
                <span>{verifyingPasskey ? '⏳ Verifying...' : '🔐 Verify with Passkey'}</span>
                <span>→</span>
              </h2>
              <p>Use your biometric authentication to access the dashboard</p>
            </button>
            
            <button
              onClick={() => { logout(); router.push('/'); }}
              style={{ 
                marginTop: '1rem', 
                background: 'none', 
                border: 'none', 
                color: '#666',
                cursor: 'pointer',
                fontSize: '0.875rem',
                width: '100%',
                textAlign: 'center'
              }}
            >
              Use a different account
            </button>
          </div>
        </div>
      </GradientBG>
    );
  }

  return (
    <GradientBG>
      <div className={styles.main} style={{ padding: '2rem', minHeight: '100vh' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          width: '100%',
          maxWidth: '1200px',
          marginBottom: '2rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <Image
              src={heroMinaLogo}
              alt="Mina Logo"
              width={50}
              height={50}
              style={{ filter: 'invert(0.7)', mixBlendMode: 'difference' }}
            />
            <div>
              <h1 style={{ 
                fontFamily: 'var(--font-monument-bold)', 
                fontSize: '1.5rem',
                color: '#fff',
                textShadow: '0 2px 4px rgba(0,0,0,0.1)'
              }}>
                MinaID
              </h1>
              <p style={{ 
                fontFamily: 'var(--font-monument-light)', 
                fontSize: '0.75rem',
                color: 'rgba(255,255,255,0.8)',
                letterSpacing: '0.05rem'
              }}>
                Zero-Knowledge Identity
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => router.push('/verifier')}
              className={styles.card}
              style={{ 
                padding: '0.5rem 1rem', 
                minHeight: 'auto',
                width: 'auto'
              }}
            >
              <h2 style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                <span>Verify</span>
              </h2>
            </button>
            <button
              onClick={handleLogout}
              className={styles.card}
              style={{ 
                padding: '0.5rem 1rem', 
                minHeight: 'auto',
                width: 'auto'
              }}
            >
              <h2 style={{ marginBottom: 0, fontSize: '0.875rem' }}>
                <span>Logout</span>
              </h2>
            </button>
          </div>
        </div>

        {/* Welcome Section */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <p className={styles.tagline}>
            WELCOME BACK, {username?.toUpperCase() || 'USER'}
          </p>
          <p className={styles.start}>
            Manage your identity and generate proofs
          </p>
        </div>

        {/* Profile Card */}
        <div style={{
          background: 'rgba(255,255,255,0.95)',
          borderRadius: '4px',
          border: '1px solid #2d2d2d',
          padding: '1.5rem',
          width: '100%',
          maxWidth: '800px',
          marginBottom: '2rem'
        }}>
          <h3 style={{ 
            fontFamily: 'var(--font-monument-bold)', 
            marginBottom: '1rem',
            fontSize: '1rem',
            letterSpacing: '0.1rem'
          }}>
            YOUR PROFILE
          </h3>
          
          <div style={{ display: 'grid', gap: '1rem' }}>
            {walletAddress && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                background: '#f5f5f5',
                borderRadius: '4px'
              }}>
                <span style={{ fontFamily: 'var(--font-monument-light)', fontSize: '0.875rem' }}>
                  Wallet Address
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {truncateAddress(walletAddress)}
                </span>
              </div>
            )}
            
            {userDid && (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '0.75rem',
                background: '#f5f5f5',
                borderRadius: '4px'
              }}>
                <span style={{ fontFamily: 'var(--font-monument-light)', fontSize: '0.875rem' }}>
                  DID
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {truncateAddress(userDid)}
                </span>
              </div>
            )}
            
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '0.75rem',
              background: '#e8f5e9',
              borderRadius: '4px'
            }}>
              <span style={{ fontFamily: 'var(--font-monument-light)', fontSize: '0.875rem' }}>
                Status
              </span>
              <span style={{ 
                fontFamily: 'var(--font-monument-bold)', 
                fontSize: '0.875rem',
                color: '#2e7d32'
              }}>
                ● Active
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className={styles.grid} style={{ marginBottom: '2rem' }}>
          <button
            className={styles.card}
            onClick={() => router.push('/upload-document')}
          >
            <h2>
              <span>📋 Upload Document</span>
              <span>→</span>
            </h2>
            <p>Choose and upload your identity document (Aadhar or Passport)</p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/verifier')}
          >
            <h2>
              <span>✓ Verify Proofs</span>
              <span>→</span>
            </h2>
            <p>Upload and verify ZK proofs from others</p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/settings')}
          >
            <h2>
              <span>⚙️ Settings</span>
              <span>→</span>
            </h2>
            <p>Manage your account and security settings</p>
          </button>
        </div>

        {/* Credentials Section */}
        <div style={{ width: '100%', maxWidth: '1000px', marginBottom: '2rem' }}>
          <CredentialsCard userDid={userDid || walletAddress} />
        </div>

        {/* Proofs History */}
        <div style={{ width: '100%', maxWidth: '1000px' }}>
          <ProofsHistoryCard key={refreshTrigger} />
        </div>

        {/* Footer */}
        <div style={{ 
          marginTop: '3rem', 
          textAlign: 'center',
          fontFamily: 'var(--font-monument-light)',
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.7)'
        }}>
          🔒 Your data is encrypted and stored locally. We never have access to your credentials.
        </div>
      </div>
    </GradientBG>
  );
}
