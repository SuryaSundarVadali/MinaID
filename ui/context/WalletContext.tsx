/**
 * WalletContext.tsx
 * 
 * React Context for multi-wallet management in MinaID.
 * Supports both Mina (Auro) and EVM (Metamask) wallets with Passkey encryption.
 * 
 * Features:
 * - Connect to Auro Wallet (Mina native)
 * - Connect to Metamask (EVM chains)
 * - Link multiple wallets to one DID
 * - Encrypt private keys with Passkeys
 * - Decrypt keys for proof generation
 * - Secure key storage in localStorage
 * 
 * Architecture:
 * - Keys never stored in plaintext
 * - Biometric authentication required for decryption
 * - Session-based temporary key loading
 * - Auto-cleanup on logout
 */

'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { PrivateKey, PublicKey } from 'o1js';
import { usePasskey } from '../hooks/usePasskey';
import {
  secureStore,
  secureRetrieve,
  secureDelete,
  secureExists,
  StorageKey,
} from '../lib/CryptoUtils';

// Types
export type WalletType = 'auro' | 'metamask';

export interface WalletInfo {
  type: WalletType;
  address: string;
  publicKey: string;
  isLinked: boolean;
  linkedAt?: number;
}

export interface WalletSession {
  did: string;
  passkeyId: string;
  wallets: WalletInfo[];
  primaryWallet: WalletType;
  expiresAt: number;
}

export interface WalletContextValue {
  // Session state
  session: WalletSession | null;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;

  // Wallet connection
  connectAuroWallet: () => Promise<WalletInfo>;
  connectMetamask: () => Promise<WalletInfo>;
  disconnectWallet: (type: WalletType) => Promise<void>;
  switchPrimaryWallet: (type: WalletType) => void;

  // Key management
  storePrivateKey: (type: WalletType, privateKey: string, passkeyId: string) => Promise<void>;
  loadPrivateKey: (type: WalletType, passkeyId: string) => Promise<string>;
  hasStoredKey: (type: WalletType) => boolean;

  // Session management
  login: (passkeyId: string) => Promise<void>;
  logout: () => void;
  refreshSession: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

// Session duration: 1 hour
const SESSION_DURATION = 60 * 60 * 1000;

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authenticateWithPasskey } = usePasskey();

  const isConnected = session !== null && session.expiresAt > Date.now();

  /**
   * Connect to Auro Wallet (Mina)
   */
  const connectAuroWallet = useCallback(async (): Promise<WalletInfo> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if Auro Wallet is installed
      const mina = (window as any).mina;
      if (!mina) {
        throw new Error('Auro Wallet not installed. Please install from https://www.aurowallet.com/');
      }

      // Request account access
      const accounts = await mina.requestAccounts();
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in Auro Wallet');
      }

      const address = accounts[0];

      // Get public key (Auro doesn't expose it directly, so we derive from address)
      // In production, you'd verify this through a signature
      const walletInfo: WalletInfo = {
        type: 'auro',
        address,
        publicKey: address, // Mina addresses are derived from public keys
        isLinked: false,
        linkedAt: Date.now(),
      };

      setIsLoading(false);
      return walletInfo;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect to Auro Wallet';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, []);

  /**
   * Connect to Metamask (EVM)
   */
  const connectMetamask = useCallback(async (): Promise<WalletInfo> => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if Metamask is installed
      const ethereum = (window as any).ethereum;
      if (!ethereum || !ethereum.isMetaMask) {
        throw new Error('Metamask not installed. Please install from https://metamask.io/');
      }

      // Request account access
      const accounts = await ethereum.request({
        method: 'eth_requestAccounts',
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found in Metamask');
      }

      const address = accounts[0];

      const walletInfo: WalletInfo = {
        type: 'metamask',
        address,
        publicKey: address, // EVM addresses are derived from public keys
        isLinked: false,
        linkedAt: Date.now(),
      };

      setIsLoading(false);
      return walletInfo;
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to connect to Metamask';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, []);

  /**
   * Disconnect a wallet
   */
  const disconnectWallet = useCallback(async (type: WalletType): Promise<void> => {
    if (!session) {
      throw new Error('No active session');
    }

    // Remove wallet from session
    const updatedWallets = session.wallets.filter(w => w.type !== type);
    
    // Delete stored private key
    const storageKey: StorageKey = {
      did: session.did,
      type: 'privateKey',
    };
    
    const keyStorageKey = `${storageKey.did}:${type}`;
    secureDelete({ ...storageKey, did: keyStorageKey });

    // Update session
    setSession({
      ...session,
      wallets: updatedWallets,
    });
  }, [session]);

  /**
   * Switch primary wallet
   */
  const switchPrimaryWallet = useCallback((type: WalletType): void => {
    if (!session) {
      throw new Error('No active session');
    }

    const hasWallet = session.wallets.some(w => w.type === type);
    if (!hasWallet) {
      throw new Error(`Wallet ${type} not connected`);
    }

    setSession({
      ...session,
      primaryWallet: type,
    });
  }, [session]);

  /**
   * Store encrypted private key
   */
  const storePrivateKey = useCallback(async (
    type: WalletType,
    privateKey: string,
    passkeyId: string
  ): Promise<void> => {
    if (!session) {
      throw new Error('No active session');
    }

    try {
      // Create unique storage key for this wallet type
      const storageKey: StorageKey = {
        did: `${session.did}:${type}`,
        type: 'privateKey',
      };

      // Encrypt and store
      await secureStore(storageKey, privateKey, passkeyId);
    } catch (err: any) {
      throw new Error(`Failed to store ${type} private key: ${err.message}`);
    }
  }, [session]);

  /**
   * Load and decrypt private key
   */
  const loadPrivateKey = useCallback(async (
    type: WalletType,
    passkeyId: string
  ): Promise<string> => {
    if (!session) {
      throw new Error('No active session');
    }

    try {
      // Create storage key
      const storageKey: StorageKey = {
        did: `${session.did}:${type}`,
        type: 'privateKey',
      };

      // Retrieve and decrypt
      const privateKey = await secureRetrieve(storageKey, passkeyId);
      
      if (!privateKey) {
        throw new Error(`No stored private key found for ${type}`);
      }

      return privateKey;
    } catch (err: any) {
      throw new Error(`Failed to load ${type} private key: ${err.message}`);
    }
  }, [session]);

  /**
   * Check if private key is stored
   */
  const hasStoredKey = useCallback((type: WalletType): boolean => {
    if (!session) {
      return false;
    }

    const storageKey: StorageKey = {
      did: `${session.did}:${type}`,
      type: 'privateKey',
    };

    return secureExists(storageKey);
  }, [session]);

  /**
   * Login with Passkey
   */
  const login = useCallback(async (passkeyId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Authenticate with Passkey
      const authResult = await authenticateWithPasskey(passkeyId);
      
      if (!authResult.userHandle) {
        throw new Error('No DID found in Passkey');
      }

      const did = authResult.userHandle;

      // Retrieve stored session data
      const sessionKey = `minaid:session:${did}`;
      const storedSession = localStorage.getItem(sessionKey);
      
      let wallets: WalletInfo[] = [];
      let primaryWallet: WalletType = 'auro';

      if (storedSession) {
        const parsed = JSON.parse(storedSession);
        wallets = parsed.wallets || [];
        primaryWallet = parsed.primaryWallet || 'auro';
      }

      // Create new session
      const newSession: WalletSession = {
        did,
        passkeyId,
        wallets,
        primaryWallet,
        expiresAt: Date.now() + SESSION_DURATION,
      };

      setSession(newSession);
      
      // Store session
      localStorage.setItem(sessionKey, JSON.stringify(newSession));
      
      setIsLoading(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to login';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [authenticateWithPasskey]);

  /**
   * Logout and clear session
   */
  const logout = useCallback((): void => {
    if (session) {
      // Clear session from storage
      const sessionKey = `minaid:session:${session.did}`;
      localStorage.removeItem(sessionKey);
    }

    setSession(null);
    setError(null);
  }, [session]);

  /**
   * Refresh session expiry
   */
  const refreshSession = useCallback((): void => {
    if (session) {
      const refreshedSession = {
        ...session,
        expiresAt: Date.now() + SESSION_DURATION,
      };
      
      setSession(refreshedSession);
      
      // Update storage
      const sessionKey = `minaid:session:${session.did}`;
      localStorage.setItem(sessionKey, JSON.stringify(refreshedSession));
    }
  }, [session]);

  // Auto-logout when session expires
  useEffect(() => {
    if (!session) return;

    const checkExpiry = setInterval(() => {
      if (session.expiresAt <= Date.now()) {
        logout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(checkExpiry);
  }, [session, logout]);

  const value: WalletContextValue = {
    session,
    isConnected,
    isLoading,
    error,
    connectAuroWallet,
    connectMetamask,
    disconnectWallet,
    switchPrimaryWallet,
    storePrivateKey,
    loadPrivateKey,
    hasStoredKey,
    login,
    logout,
    refreshSession,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

/**
 * Hook to use WalletContext
 */
export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within WalletProvider');
  }
  return context;
}
