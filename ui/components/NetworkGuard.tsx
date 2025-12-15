/**
 * NetworkGuard.tsx
 * 
 * Component that displays a warning banner when user is on the wrong network
 */

'use client';

import React, { useEffect, useState } from 'react';

export type ExpectedNetwork = 'devnet' | 'berkeley' | 'mainnet';

interface NetworkGuardProps {
  expectedNetwork: ExpectedNetwork;
  onNetworkMismatch?: (current: string, expected: string) => void;
}

const NETWORK_NAMES: Record<ExpectedNetwork, string> = {
  devnet: 'Mina Devnet',
  berkeley: 'Berkeley Testnet',
  mainnet: 'Mina Mainnet',
};

const NETWORK_CHAIN_IDS: Record<ExpectedNetwork, string> = {
  devnet: 'devnet',
  berkeley: 'berkeley',
  mainnet: 'mainnet',
};

export function NetworkGuard({ expectedNetwork, onNetworkMismatch }: NetworkGuardProps) {
  const [isWrongNetwork, setIsWrongNetwork] = useState(false);
  const [currentNetwork, setCurrentNetwork] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkNetwork = async () => {
      try {
        const mina = (window as any).mina;
        if (!mina) {
          return; // Wallet not installed
        }

        // Try to get network info from Auro Wallet
        // Note: Auro doesn't have a standard way to get network info
        // We can infer from the GraphQL endpoint or chainId if available
        
        // For now, we'll check if requestNetwork is available (newer Auro versions)
        if (mina.requestNetwork) {
          const network = await mina.requestNetwork();
          const networkId = network?.networkID || network?.chainId || '';
          
          setCurrentNetwork(networkId);
          
          const expectedChainId = NETWORK_CHAIN_IDS[expectedNetwork];
          if (networkId && networkId.toLowerCase() !== expectedChainId.toLowerCase()) {
            setIsWrongNetwork(true);
            onNetworkMismatch?.(networkId, expectedChainId);
          } else {
            setIsWrongNetwork(false);
          }
        } else {
          // Fallback: assume correct network if we can't check
          setIsWrongNetwork(false);
        }
      } catch (error) {
        console.warn('[NetworkGuard] Failed to check network:', error);
        setIsWrongNetwork(false);
      }
    };

    checkNetwork();

    // Listen for chain changes (if supported)
    const mina = (window as any).mina;
    if (mina && mina.on) {
      mina.on('chainChanged', checkNetwork);
      
      return () => {
        if (mina.removeListener) {
          mina.removeListener('chainChanged', checkNetwork);
        }
      };
    }
  }, [expectedNetwork, onNetworkMismatch]);

  if (!isWrongNetwork) {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'linear-gradient(90deg, #DC2626 0%, #EF4444 100%)',
        color: '#fff',
        padding: '1rem',
        textAlign: 'center',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        fontFamily: 'var(--font-monument)',
        fontSize: '0.875rem',
      }}
    >
      <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '1.5rem' }}>⚠️</span>
        <div>
          <strong>Wrong Network Detected</strong>
          <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', opacity: 0.9 }}>
            Please switch to <strong>{NETWORK_NAMES[expectedNetwork]}</strong> in your wallet.
            {currentNetwork && ` (Currently on: ${currentNetwork})`}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * Hook to check if user is on the correct network
 */
export function useNetworkCheck(expectedNetwork: ExpectedNetwork) {
  const [isCorrectNetwork, setIsCorrectNetwork] = useState(true);
  const [currentNetwork, setCurrentNetwork] = useState<string>('');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkNetwork = async () => {
      try {
        const mina = (window as any).mina;
        if (!mina || !mina.requestNetwork) {
          setIsCorrectNetwork(true); // Assume correct if can't check
          return;
        }

        const network = await mina.requestNetwork();
        const networkId = network?.networkID || network?.chainId || '';
        
        setCurrentNetwork(networkId);
        
        const expectedChainId = NETWORK_CHAIN_IDS[expectedNetwork];
        setIsCorrectNetwork(
          !networkId || networkId.toLowerCase() === expectedChainId.toLowerCase()
        );
      } catch (error) {
        console.warn('[useNetworkCheck] Failed to check network:', error);
        setIsCorrectNetwork(true);
      }
    };

    checkNetwork();

    const mina = (window as any).mina;
    if (mina && mina.on) {
      mina.on('chainChanged', checkNetwork);
      
      return () => {
        if (mina.removeListener) {
          mina.removeListener('chainChanged', checkNetwork);
        }
      };
    }
  }, [expectedNetwork]);

  return { isCorrectNetwork, currentNetwork };
}
