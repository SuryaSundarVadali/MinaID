'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { clearAllData, getDataSummary } from '../../lib/DataManagement';
import styles from '../../styles/Home.module.css';
import GradientBG from '../../components/GradientBG';

export default function AdminPage() {
  const router = useRouter();
  const [dataSummary, setDataSummary] = useState(getDataSummary());
  const [cleared, setCleared] = useState(false);

  const handleClearAllData = () => {
    if (confirm('⚠️ This will delete ALL data including wallets, passkeys, and proofs. Continue?')) {
      clearAllData();
      setDataSummary(getDataSummary());
      setCleared(true);
      
      setTimeout(() => {
        router.push('/');
      }, 2000);
    }
  };

  const handleRefreshSummary = () => {
    setDataSummary(getDataSummary());
    setCleared(false);
  };

  return (
    <GradientBG>
      <div className={styles.main}>
        <div className={styles.center}>
          <h1 style={{ fontSize: '2rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
            🔧 Admin & Testing
          </h1>
          <p style={{ mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
            Data management and testing utilities
          </p>
        </div>

        <div className={styles.stateContainer}>
          {/* Data Summary */}
          <div className={styles.state}>
            <h2 className={styles.bold}>📊 Data Summary</h2>
            <div style={{ textAlign: 'left', marginTop: '1rem' }}>
              <p><strong>Total Keys:</strong> {dataSummary.totalKeys}</p>
              <p><strong>Wallets:</strong> {dataSummary.wallets}</p>
              <p><strong>Passkeys:</strong> {dataSummary.passkeys}</p>
              <p><strong>Proofs:</strong> {dataSummary.proofs}</p>
              <p><strong>Aadhar Data:</strong> {dataSummary.aadharData}</p>
            </div>
            <button onClick={handleRefreshSummary} style={{ marginTop: '1rem' }}>
              🔄 Refresh Summary
            </button>
          </div>

          {/* Clear Data */}
          <div className={styles.state}>
            <h2 className={styles.bold}>🗑️ Clear All Data</h2>
            <p>This will remove all localStorage data including:</p>
            <ul style={{ textAlign: 'left', marginLeft: '1.5rem' }}>
              <li>Wallet connections</li>
              <li>Passkeys</li>
              <li>Aadhar data</li>
              <li>Generated proofs</li>
              <li>Session data</li>
            </ul>
            <button 
              onClick={handleClearAllData}
              style={{ 
                backgroundColor: '#ff4444',
                marginTop: '1rem'
              }}
            >
              ⚠️ Clear All Data
            </button>
            
            {cleared && (
              <p style={{ color: '#00ff00', marginTop: '1rem', fontWeight: 'bold' }}>
                ✓ All data cleared! Redirecting...
              </p>
            )}
          </div>

          {/* Testing Links */}
          <div className={styles.state}>
            <h2 className={styles.bold}>🧪 Testing</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <button onClick={() => router.push('/signup')}>
                Test Signup Flow
              </button>
              <button onClick={() => router.push('/login')}>
                Test Login Flow
              </button>
              <button onClick={() => router.push('/verifier')}>
                Test Citizenship Verification
              </button>
              <button onClick={() => router.push('/did-proof')}>
                Test Proof Generation
              </button>
            </div>
          </div>

          {/* Passkey Requirements */}
          <div className={styles.state}>
            <h2 className={styles.bold}>🔐 Passkey Policy</h2>
            <div style={{ textAlign: 'left', marginTop: '1rem' }}>
              <p>✓ <strong>Mandatory:</strong> Every account MUST have a passkey</p>
              <p>✓ <strong>One per wallet:</strong> Only 1 passkey allowed per wallet</p>
              <p>✓ <strong>No login without passkey:</strong> Login blocked if no passkey</p>
              <p>✓ <strong>Auto-enforcement:</strong> Duplicates automatically removed</p>
            </div>
          </div>

          {/* Back Button */}
          <button 
            onClick={() => router.push('/')}
            style={{ marginTop: '2rem' }}
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </GradientBG>
  );
}
