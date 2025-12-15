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
  isSessionLoading: boolean; // True while restoring session from localStorage
  error: string | null;

  // Wallet connection
  connectAuroWallet: () => Promise<WalletInfo>;
  connectMetamask: () => Promise<WalletInfo>;
  disconnectWallet: (type: WalletType) => Promise<void>;
  switchPrimaryWallet: (type: WalletType) => void;

  // Key management
  storePrivateKey: (type: WalletType, privateKey: string, passkeyId: string, did?: string) => Promise<void>;
  loadPrivateKey: (type: WalletType, passkeyId: string, did?: string) => Promise<string>;
  hasStoredKey: (type: WalletType, did?: string) => boolean;

  // Session management
  login: (passkeyId: string) => Promise<void>;
  createSession: (did: string, passkeyId: string, walletType: WalletType) => void;
  logout: () => void;
  refreshSession: () => void;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

// Session duration: 1 hour
const SESSION_DURATION = 60 * 60 * 1000;
// Inactivity timeout: 10 minutes
const INACTIVITY_TIMEOUT = 10 * 60 * 1000;

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true); // True until session restoration completes
  const [error, setError] = useState<string | null>(null);
  const [lastActivity, setLastActivity] = useState<number>(Date.now());
  const { authenticateWithPasskey } = usePasskey();

  const isConnected = session !== null && session.expiresAt > Date.now();

  // Restore session from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Try to find any existing session
    const keys = Object.keys(localStorage);
    const sessionKey = keys.find(key => key.startsWith('minaid:session:'));
    
    if (sessionKey) {
      try {
        const storedSession = localStorage.getItem(sessionKey);
        if (storedSession) {
          const parsed: WalletSession = JSON.parse(storedSession);
          
          // Check if session is still valid
          if (parsed.expiresAt > Date.now()) {
            setSession(parsed);
          } else {
            // Clean up expired session
            localStorage.removeItem(sessionKey);
          }
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
      }
    }
    
    // Mark session restoration as complete
    setIsSessionLoading(false);
  }, []);

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
   * @param type Wallet type
   * @param privateKey Private key to store
   * @param passkeyId Passkey ID for encryption
   * @param did Optional DID for signup (when no session exists yet)
   */
  const storePrivateKey = useCallback(async (
    type: WalletType,
    privateKey: string,
    passkeyId: string,
    did?: string
  ): Promise<void> => {
    // Use provided DID (for signup) or session DID
    const effectiveDid = did || session?.did;
    
    if (!effectiveDid) {
      throw new Error('No DID provided and no active session');
    }

    try {
      // Create unique storage key for this wallet type
      const storageKey: StorageKey = {
        did: `${effectiveDid}:${type}`,
        type: 'privateKey',
      };

      console.log('[WalletContext] Storing private key with:', {
        effectiveDid,
        type,
        storageKey: storageKey.did,
        passkeyId
      });

      // Encrypt and store
      await secureStore(storageKey, privateKey, passkeyId);
      
      console.log('[WalletContext] Private key stored successfully');
    } catch (err: any) {
      console.error('[WalletContext] Store failed:', err);
      throw new Error(`Failed to store ${type} private key: ${err.message}`);
    }
  }, [session]);

  /**
   * Load and decrypt private key
   * @param type Wallet type
   * @param passkeyId Passkey ID for decryption
   * @param did Optional DID (when no session exists yet)
   */
  const loadPrivateKey = useCallback(async (
    type: WalletType,
    passkeyId: string,
    did?: string
  ): Promise<string> => {
    // Use provided DID (for signup) or session DID
    const effectiveDid = did || session?.did;
    
    if (!effectiveDid) {
      throw new Error('No DID provided and no active session');
    }

    try {
      // Create storage key
      const storageKey: StorageKey = {
        did: `${effectiveDid}:${type}`,
        type: 'privateKey',
      };

      console.log('[WalletContext] Loading private key with:', {
        effectiveDid,
        type,
        storageKey: storageKey.did,
        passkeyId
      });

      // Retrieve and decrypt
      const privateKey = await secureRetrieve(storageKey, passkeyId);
      
      if (!privateKey) {
        console.error('[WalletContext] No private key found in storage');
        throw new Error(`No stored private key found for ${type}`);
      }

      console.log('[WalletContext] Private key loaded successfully');
      return privateKey;
    } catch (err: any) {
      console.error('[WalletContext] Load failed:', err);
      throw new Error(`Failed to load ${type} private key: ${err.message}`);
    }
  }, [session]);

  /**
   * Check if private key is stored
   * @param type Wallet type
   * @param did Optional DID (when no session exists yet)
   */
  const hasStoredKey = useCallback((type: WalletType, did?: string): boolean => {
    // Use provided DID (for signup) or session DID
    const effectiveDid = did || session?.did;
    
    if (!effectiveDid) {
      return false;
    }

    const storageKey: StorageKey = {
      did: `${effectiveDid}:${type}`,
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
      
      // Also store a simple marker for quick checks
      localStorage.setItem('minaid_session', 'active');
      
      setIsLoading(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to login';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [authenticateWithPasskey]);

  /**
   * Create a new session without authentication (for signup flow)
   * @param did User's DID
   * @param passkeyId Passkey credential ID
   * @param walletType Type of wallet connected
   */
  const createSession = useCallback((did: string, passkeyId: string, walletType: WalletType): void => {
    console.log('[WalletContext] Creating new session:', { did, passkeyId, walletType });

    const newSession: WalletSession = {
      did,
      passkeyId,
      wallets: [],
      primaryWallet: walletType,
      expiresAt: Date.now() + SESSION_DURATION,
    };

    setSession(newSession);
    
    // Store session
    const sessionKey = `minaid:session:${did}`;
    localStorage.setItem(sessionKey, JSON.stringify(newSession));
    
    // Also store a simple marker for quick checks
    localStorage.setItem('minaid_session', 'active');
    
    console.log('[WalletContext] Session created successfully');
  }, []);

  /**
   * Logout and clear session
   */
  const logout = useCallback((): void => {
    if (session) {
      // Clear session from storage
      const sessionKey = `minaid:session:${session.did}`;
      localStorage.removeItem(sessionKey);
    }

    // Clear session marker
    localStorage.removeItem('minaid_session');
    
    // Clear passkey verification
    localStorage.removeItem('minaid_passkey_last_verified');
    localStorage.removeItem('minaid_passkey_verified_did');
    
    // Clear wallet connection data
    localStorage.removeItem('minaid_wallet_connected');

    setSession(null);
    setError(null);
    
    console.log('[WalletContext] Logged out and cleared session data');
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

  // Inactivity timeout: logout after 10 minutes of inactivity
  useEffect(() => {
    if (!session) return;

    const handleActivity = () => {
      setLastActivity(Date.now());
    };

    // Track user activity
    const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity);
    });

    // Check for inactivity every 30 seconds
    const inactivityCheck = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivity;
      if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
        console.log('[WalletContext] Auto-logout due to inactivity');
        logout();
      }
    }, 30000);

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
      clearInterval(inactivityCheck);
    };
  }, [session, lastActivity, logout]);

  // Wallet event listeners: handle account/network changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mina = (window as any).mina;
    const ethereum = (window as any).ethereum;

    // Auro Wallet: listen for account changes
    const handleAuroAccountChange = (accounts: string[]) => {
      console.log('[WalletContext] Auro account changed:', accounts);
      if (!session) return;

      const currentAuroWallet = session.wallets.find(w => w.type === 'auro');
      if (currentAuroWallet && accounts[0] !== currentAuroWallet.address) {
        console.warn('[WalletContext] Account mismatch detected - logging out for security');
        logout();
      }
    };

    // Metamask: listen for account changes
    const handleMetamaskAccountChange = (accounts: string[]) => {
      console.log('[WalletContext] Metamask account changed:', accounts);
      if (!session) return;

      const currentMetamaskWallet = session.wallets.find(w => w.type === 'metamask');
      if (currentMetamaskWallet && accounts[0] !== currentMetamaskWallet.address) {
        console.warn('[WalletContext] Account mismatch detected - logging out for security');
        logout();
      }
    };

    // Metamask: listen for chain changes
    const handleChainChange = (chainId: string) => {
      console.log('[WalletContext] Chain changed:', chainId);
      // Could add logic here to verify user is on correct network
      // For now, just log it
    };

    // Attach listeners
    if (mina && mina.on) {
      mina.on('accountsChanged', handleAuroAccountChange);
    }

    if (ethereum && ethereum.on) {
      ethereum.on('accountsChanged', handleMetamaskAccountChange);
      ethereum.on('chainChanged', handleChainChange);
    }

    // Cleanup
    return () => {
      if (mina && mina.removeListener) {
        mina.removeListener('accountsChanged', handleAuroAccountChange);
      }
      if (ethereum && ethereum.removeListener) {
        ethereum.removeListener('accountsChanged', handleMetamaskAccountChange);
        ethereum.removeListener('chainChanged', handleChainChange);
      }
    };
  }, [session, logout]);

  const value: WalletContextValue = {
    session,
    isConnected,
    isLoading,
    isSessionLoading,
    error,
    connectAuroWallet,
    connectMetamask,
    disconnectWallet,
    switchPrimaryWallet,
    storePrivateKey,
    loadPrivateKey,
    hasStoredKey,
    login,
    createSession,
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
