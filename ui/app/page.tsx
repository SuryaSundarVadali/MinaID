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
          Get started by connecting your wallet
        </p>

        <div className={styles.grid}>
          <button
            className={styles.card}
            onClick={() => router.push('/signup')}
          >
            <h2>
              <span>Connect Wallet</span>
              <span>→</span>
            </h2>
            <p>
              Create your decentralized identity with Face ID or Touch ID. Your keys, your control.
            </p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/login')}
          >
            <h2>
              <span>Login</span>
              <span>→</span>
            </h2>
            <p>
              Access your MinaID with biometric authentication. No passwords needed.
            </p>
          </button>

          <button
            className={styles.card}
            onClick={() => router.push('/verifier')}
          >
            <h2>
              <span>Verify Proofs</span>
              <span>→</span>
            </h2>
            <p>
              Verify zero-knowledge proofs without accessing private data. Built for privacy.
            </p>
          </button>

          <a
            className={styles.card}
            href="https://docs.minaprotocol.com"
            target="_blank"
            rel="noopener noreferrer"
          >
            <h2>
              <span>Docs</span>
              <span>→</span>
            </h2>
            <p>
              Learn how MinaID uses Mina Protocol for decentralized identity management.
            </p>
          </a>
        </div>
      </div>
    </GradientBG>
  );
}
