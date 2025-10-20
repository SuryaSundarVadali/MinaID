/**
 * usePasskey.ts
 * 
 * React hook for WebAuthn/Passkey operations in MinaID.
 * Provides biometric authentication for device-bound security.
 * 
 * Features:
 * - Create new Passkeys (registration)
 * - Authenticate with existing Passkeys
 * - List available Passkeys for the user
 * - Conditional UI support (autofill)
 * 
 * Security:
 * - Uses WebAuthn Level 2 API
 * - Requires user verification (biometric/PIN)
 * - Device-bound credentials (cannot be exported)
 * - Resistant to phishing (origin-bound)
 */

'use client';

import { useState, useCallback } from 'react';
import {
  startRegistration,
  startAuthentication,
} from '@simplewebauthn/browser';
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/browser';
import { generateChallenge } from '../lib/CryptoUtils';

// Types
export interface PasskeyInfo {
  id: string;                    // Credential ID (base64url encoded)
  publicKey: string;             // Public key (base64url encoded)
  displayName: string;           // User-friendly name
  createdAt: number;             // Timestamp of creation
  lastUsed?: number;             // Last authentication timestamp
  authenticatorType: string;     // 'platform' or 'cross-platform'
}

export interface CreatePasskeyResult {
  id: string;                    // Credential ID
  publicKey: string;             // Public key
  attestation: RegistrationResponseJSON;  // Full attestation response
}

export interface AuthenticateResult {
  id: string;                    // Credential ID
  signature: string;             // Authentication signature
  authenticatorData: string;     // Authenticator data
  clientDataJSON: string;        // Client data JSON
  userHandle?: string;           // User handle (DID)
}

export interface UsePasskeyReturn {
  createPasskey: (did: string, displayName: string) => Promise<CreatePasskeyResult>;
  authenticateWithPasskey: (passkeyId?: string) => Promise<AuthenticateResult>;
  listPasskeys: (did: string) => PasskeyInfo[];
  deletePasskey: (passkeyId: string) => Promise<void>;
  isSupported: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * React hook for Passkey operations
 * @returns Passkey management functions and state
 */
export function usePasskey(): UsePasskeyReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if WebAuthn is supported
  const isSupported = typeof window !== 'undefined' && 
                     window.PublicKeyCredential !== undefined;

  /**
   * Create a new Passkey for the user
   * @param did The user's DID (used as user handle)
   * @param displayName Display name for the Passkey
   * @returns Passkey creation result with credential ID and public key
   */
  const createPasskey = useCallback(async (
    did: string,
    displayName: string
  ): Promise<CreatePasskeyResult> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isSupported) {
        throw new Error('Passkeys are not supported in this browser');
      }

      // Generate a cryptographically secure challenge
      const challenge = await generateChallenge(32);

      // Create registration options
      const options: PublicKeyCredentialCreationOptionsJSON = {
        challenge,
        rp: {
          name: 'MinaID',
          id: window.location.hostname,
        },
        user: {
          id: did,  // Use DID as user handle
          name: did,
          displayName,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },   // ES256 (ECDSA with SHA-256)
          { alg: -257, type: 'public-key' }, // RS256 (RSA with SHA-256)
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',  // Prefer platform authenticators (Face ID, Touch ID)
          requireResidentKey: true,             // Create discoverable credential
          residentKey: 'required',
          userVerification: 'required',         // Require biometric/PIN
        },
        timeout: 60000, // 60 seconds
        attestation: 'none', // No attestation needed for privacy
      };

      // Start WebAuthn registration
      const attestation = await startRegistration({ optionsJSON: options });

      // Extract credential ID and public key
      const credentialId = attestation.id;
      const publicKey = attestation.response.publicKey || '';

      // Store Passkey metadata in localStorage
      const passkeyInfo: PasskeyInfo = {
        id: credentialId,
        publicKey,
        displayName,
        createdAt: Date.now(),
        authenticatorType: 'platform',
      };

      const storageKey = `minaid:passkey:${did}:${credentialId}`;
      localStorage.setItem(storageKey, JSON.stringify(passkeyInfo));

      setIsLoading(false);
      return {
        id: credentialId,
        publicKey,
        attestation,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to create Passkey';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [isSupported]);

  /**
   * Authenticate with an existing Passkey
   * @param passkeyId Optional - specific Passkey ID to use (if not provided, shows picker)
   * @returns Authentication result with signature
   */
  const authenticateWithPasskey = useCallback(async (
    passkeyId?: string
  ): Promise<AuthenticateResult> => {
    setIsLoading(true);
    setError(null);

    try {
      if (!isSupported) {
        throw new Error('Passkeys are not supported in this browser');
      }

      // Generate a cryptographically secure challenge
      const challenge = await generateChallenge(32);

      // Create authentication options
      const options: PublicKeyCredentialRequestOptionsJSON = {
        challenge,
        timeout: 60000,
        userVerification: 'required', // Require biometric/PIN
        rpId: window.location.hostname,
      };

      // If specific Passkey ID provided, use it
      if (passkeyId) {
        options.allowCredentials = [{
          id: passkeyId,
          type: 'public-key',
          transports: ['internal'], // Platform authenticator
        }];
      }

      // Start WebAuthn authentication
      const assertion = await startAuthentication({ optionsJSON: options });

      // Update last used timestamp
      if (assertion.response.userHandle) {
        const did = assertion.response.userHandle;
        const storageKey = `minaid:passkey:${did}:${assertion.id}`;
        const stored = localStorage.getItem(storageKey);
        
        if (stored) {
          const passkeyInfo: PasskeyInfo = JSON.parse(stored);
          passkeyInfo.lastUsed = Date.now();
          localStorage.setItem(storageKey, JSON.stringify(passkeyInfo));
        }
      }

      setIsLoading(false);
      return {
        id: assertion.id,
        signature: assertion.response.signature,
        authenticatorData: assertion.response.authenticatorData,
        clientDataJSON: assertion.response.clientDataJSON,
        userHandle: assertion.response.userHandle,
      };
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to authenticate with Passkey';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, [isSupported]);

  /**
   * List all Passkeys for a specific DID
   * @param did The DID to list Passkeys for
   * @returns Array of Passkey information
   */
  const listPasskeys = useCallback((did: string): PasskeyInfo[] => {
    const prefix = `minaid:passkey:${did}:`;
    const passkeys: PasskeyInfo[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(prefix)) {
        try {
          const passkeyInfo: PasskeyInfo = JSON.parse(localStorage.getItem(key)!);
          passkeys.push(passkeyInfo);
        } catch (err) {
          console.error('Failed to parse Passkey info:', err);
        }
      }
    }

    // Sort by most recently used
    return passkeys.sort((a, b) => {
      const aTime = a.lastUsed || a.createdAt;
      const bTime = b.lastUsed || b.createdAt;
      return bTime - aTime;
    });
  }, []);

  /**
   * Delete a Passkey from storage
   * Note: This only removes metadata - the actual credential remains in the authenticator
   * @param passkeyId The Passkey credential ID to delete
   */
  const deletePasskey = useCallback(async (passkeyId: string): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Find and delete from localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.includes(passkeyId)) {
          localStorage.removeItem(key);
          break;
        }
      }

      setIsLoading(false);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to delete Passkey';
      setError(errorMessage);
      setIsLoading(false);
      throw new Error(errorMessage);
    }
  }, []);

  return {
    createPasskey,
    authenticateWithPasskey,
    listPasskeys,
    deletePasskey,
    isSupported,
    isLoading,
    error,
  };
}

/**
 * Check if Passkeys are available and supported
 * @returns True if Passkeys are supported
 */
export function isPasskeyAvailable(): boolean {
  return typeof window !== 'undefined' && 
         window.PublicKeyCredential !== undefined;
}

/**
 * Check if conditional mediation (autofill) is supported
 * @returns True if autofill UI is supported
 */
export async function isConditionalMediationAvailable(): Promise<boolean> {
  if (!isPasskeyAvailable()) {
    return false;
  }

  return await PublicKeyCredential.isConditionalMediationAvailable?.() || false;
}
