'use client';
import { useState } from 'react';
import Image from 'next/image';
import GradientBG from '../components/GradientBG.js';
import { Login } from '../components/Login';
import { SignupOrchestrator } from '../components/SignupOrchestrator';
import { Dashboard } from '../components/Dashboard';
import styles from '../styles/Home.module.css';
import heroMinaLogo from '../public/assets/hero-mina-logo.svg';
import arrowRightSmall from '../public/assets/arrow-right-small.svg';

type View = 'home' | 'login' | 'signup' | 'dashboard';

export default function Home() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Check if user is logged in on mount
  useState(() => {
    if (typeof window !== 'undefined') {
      const session = localStorage.getItem('minaid_session');
      if (session) {
        setIsLoggedIn(true);
        setCurrentView('dashboard');
      }
    }
  });

  const handleLoginSuccess = () => {
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  const handleSignupSuccess = () => {
    setIsLoggedIn(true);
    setCurrentView('dashboard');
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setCurrentView('home');
    if (typeof window !== 'undefined') {
      localStorage.removeItem('minaid_session');
    }
  };

  return (
    <>
      <GradientBG>
        <main className={styles.main}>
          {currentView === 'home' && (
            <div className={styles.center}>
              <div className="relative z-10 flex flex-col items-center justify-center min-h-[80vh]">
                <Image
                  src={heroMinaLogo}
                  alt="Mina Logo"
                  width={200}
                  height={200}
                  priority
                  className="mb-8"
                />
                
                <h1 className={styles.tagline + " text-white text-center mb-2"}>
                  DECENTRALIZED IDENTITY WITH
                </h1>
                
                <h2 className="text-6xl md:text-7xl font-bold text-white text-center mb-4" style={{ fontFamily: 'var(--font-monument-bold)' }}>
                  MinaID
                </h2>
                
                <p className="text-xl text-gray-300 text-center max-w-2xl mb-12" style={{ fontFamily: 'var(--font-monument-light)' }}>
                  The first biometric-bound zero-knowledge identity system.
                  <br />
                  Your credentials. Your biometric. Impossible to share.
                </p>

                <div className="flex gap-4 mb-16">
                  <button 
                    onClick={() => setCurrentView('signup')}
                    className="px-8 py-4 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-all transform hover:scale-105"
                    style={{ fontFamily: 'var(--font-monument-bold)' }}
                  >
                    GET STARTED
                  </button>
                  <button 
                    onClick={() => setCurrentView('login')}
                    className="px-8 py-4 border-2 border-white text-white font-bold rounded-lg hover:bg-white hover:text-black transition-all transform hover:scale-105"
                    style={{ fontFamily: 'var(--font-monument-bold)' }}
                  >
                    LOGIN
                  </button>
                </div>

                <div className={styles.grid + " mt-12"}>
                  <div className="text-center p-6">
                    <div className="text-5xl mb-2">🔒</div>
                    <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-monument-bold)' }}>
                      Biometric Security
                    </h3>
                    <p className="text-sm text-gray-300" style={{ fontFamily: 'var(--font-monument-light)' }}>
                      Private keys encrypted with Face ID / Touch ID
                    </p>
                  </div>

                  <div className="text-center p-6">
                    <div className="text-5xl mb-2">🔐</div>
                    <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-monument-bold)' }}>
                      Zero-Knowledge Proofs
                    </h3>
                    <p className="text-sm text-gray-300" style={{ fontFamily: 'var(--font-monument-light)' }}>
                      Prove credentials without revealing data
                    </p>
                  </div>

                  <div className="text-center p-6">
                    <div className="text-5xl mb-2">🌐</div>
                    <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-monument-bold)' }}>
                      Peer-to-Peer
                    </h3>
                    <p className="text-sm text-gray-300" style={{ fontFamily: 'var(--font-monument-light)' }}>
                      No servers. Full decentralization.
                    </p>
                  </div>

                  <div className="text-center p-6">
                    <div className="text-5xl mb-2">🇮🇳</div>
                    <h3 className="text-lg font-bold text-white mb-2" style={{ fontFamily: 'var(--font-monument-bold)' }}>
                      Aadhar Integration
                    </h3>
                    <p className="text-sm text-gray-300" style={{ fontFamily: 'var(--font-monument-light)' }}>
                      Government ID verification built-in
                    </p>
                  </div>
                </div>
              </div>

              {/* Resources Grid */}
              <div className={styles.grid + " mt-8"}>
                <a
                  href="https://docs.minaprotocol.com/zkapps"
                  className={styles.card}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <h2>
                    <span>DOCS</span>
                    <div>
                      <Image
                        src={arrowRightSmall}
                        alt="Arrow"
                        width={16}
                        height={16}
                        priority
                      />
                    </div>
                  </h2>
                  <p>Learn about MinaID architecture and ZK proofs</p>
                </a>

                <a
                  href="https://github.com/SuryaSundarVadali/MinaID"
                  className={styles.card}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <h2>
                    <span>GITHUB</span>
                    <div>
                      <Image
                        src={arrowRightSmall}
                        alt="Arrow"
                        width={16}
                        height={16}
                        priority
                      />
                    </div>
                  </h2>
                  <p>View source code and contribute</p>
                </a>

                <a
                  href="https://discord.gg/minaprotocol"
                  className={styles.card}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <h2>
                    <span>COMMUNITY</span>
                    <div>
                      <Image
                        src={arrowRightSmall}
                        alt="Arrow"
                        width={16}
                        height={16}
                        priority
                      />
                    </div>
                  </h2>
                  <p>Join the Mina community on Discord</p>
                </a>

                <a
                  href="https://minaprotocol.com"
                  className={styles.card}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <h2>
                    <span>MINA PROTOCOL</span>
                    <div>
                      <Image
                        src={arrowRightSmall}
                        alt="Arrow"
                        width={16}
                        height={16}
                        priority
                      />
                    </div>
                  </h2>
                  <p>Learn about the Mina blockchain</p>
                </a>
              </div>
            </div>
          )}

          {currentView === 'login' && (
            <div className="w-full max-w-4xl">
              <button 
                onClick={() => setCurrentView('home')}
                className="mb-6 px-6 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-black transition-all"
                style={{ fontFamily: 'var(--font-monument-bold)' }}
              >
                ← BACK TO HOME
              </button>
              <Login onSuccess={handleLoginSuccess} />
            </div>
          )}

          {currentView === 'signup' && (
            <div className="w-full max-w-4xl">
              <button 
                onClick={() => setCurrentView('home')}
                className="mb-6 px-6 py-3 border-2 border-white text-white rounded-lg hover:bg-white hover:text-black transition-all"
                style={{ fontFamily: 'var(--font-monument-bold)' }}
              >
                ← BACK TO HOME
              </button>
              <SignupOrchestrator onSuccess={handleSignupSuccess} />
            </div>
          )}

          {currentView === 'dashboard' && (
            <div className="w-full max-w-6xl">
              <Dashboard onLogout={handleLogout} />
            </div>
          )}
        </main>
      </GradientBG>
    </>
  );
}
