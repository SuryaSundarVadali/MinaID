'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GradientBG from '../components/GradientBG.js';
import styles from '../styles/Home.module.css';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const isLoggedIn = typeof window !== 'undefined' && localStorage.getItem('minaid_session');
    
    // Redirect based on login status
    if (isLoggedIn) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  return (
    <>
      <GradientBG>
        <main className={styles.main}>
          <div className={styles.center}>
            <div className="flex flex-col items-center justify-center min-h-screen">
              <div className="animate-pulse">
                <h1 className="text-4xl font-bold text-white mb-4">MinaID</h1>
                <p className="text-gray-300">Loading...</p>
              </div>
            </div>
          </div>
        </main>
      </GradientBG>
    </>
  );
}
