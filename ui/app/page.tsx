'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useWallet } from '../context/WalletContext';
import GradientBG from '../components/GradientBG';
import heroMinaLogo from '../public/assets/hero-mina-logo.svg';
import styles from '../styles/Home.module.css';

export default function Home() {
  const router = useRouter();
  const { session, isConnected } = useWallet();

  // Redirect to dashboard if already logged in with valid session
  useEffect(() => {
    if (isConnected && session) {
      router.push('/dashboard');
    }
  }, [isConnected, session, router]);

  return (
    <GradientBG>
      <div className={styles.main}>
        <div className={styles.center}>
          <Image
            className={styles.logo}
            src={heroMinaLogo}
            alt="Mina Logo"
            width={300}
            height={300}
            priority
          />
        </div>

        <p className={styles.tagline}>
          BIOMETRIC-BOUND ZERO-KNOWLEDGE IDENTITY
        </p>

        <p className={styles.start}>
          Choose an option to get started
        </p>

        <div className={styles.grid}>
          <button
            className={styles.card}
            onClick={() => router.push('/login')}
          >
            <h2>
              <span>Login</span>
              <span>→</span>
            </h2>
            <p>
              Access your MinaID with wallet authentication. Connect and go.
            </p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/signup')}
          >
            <h2>
              <span>Sign Up</span>
              <span>→</span>
            </h2>
            <p>
              Create your decentralized identity. Connect wallet and set up your profile.
            </p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/test-proofs')}
            style={{ borderColor: '#00ff00' }}
          >
            <h2>
              <span>🧪 Test Proofs</span>
              <span>→</span>
            </h2>
            <p>
              Test citizenship ZK proofs, age verification, and blockchain integration.
            </p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/test-wallet')}
            style={{ borderColor: '#ff0099' }}
          >
            <h2>
              <span>🔍 Diagnostics</span>
              <span>→</span>
            </h2>
            <p>
              Test wallet detection, connection, and passkey functionality.
            </p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/admin')}
            style={{ borderColor: '#ff9900' }}
          >
            <h2>
              <span>🔧 Admin</span>
              <span>→</span>
            </h2>
            <p>
              Manage data, clear storage, and view system status.
            </p>
          </button>
        </div>
      </div>
    </GradientBG>
  );
}
