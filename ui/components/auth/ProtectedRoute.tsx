/**
 * ProtectedRoute.tsx
 * 
 * Route protection component that ensures user is authenticated
 * before accessing protected pages. Redirects to login if not authenticated.
 * 
 * Usage:
 * ```tsx
 * <ProtectedRoute>
 *   <Dashboard />
 * </ProtectedRoute>
 * ```
 */

'use client';

import React, { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../../context/WalletContext';
import { ProofStorage } from '../../lib/ProofStorage';

interface ProtectedRouteProps {
  children: ReactNode;
  redirectTo?: string;
  requireSession?: boolean;
  requireVerifiedProof?: boolean; // New prop for dashboard protection
}

export function ProtectedRoute({ 
  children, 
  redirectTo = '/login',
  requireSession = true,
  requireVerifiedProof = false
}: ProtectedRouteProps) {
  const { isConnected, session, isSessionLoading } = useWallet();
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userIdentifier, setUserIdentifier] = useState<string | null>(null);

  useEffect(() => {
    // Wait for session restoration before checking authentication
    if (isSessionLoading) {
      return;
    }
    
    // Check authentication status
    let authenticated = isConnected;
    let identifier = session?.did || null;
    
    // Also check localStorage for wallet connection (for simpleSignup users without full session)
    if (!authenticated) {
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        try {
          const parsed = JSON.parse(walletData);
          // User has wallet connected - consider them authenticated
          authenticated = true;
          identifier = parsed.did || parsed.address;
          console.log('[ProtectedRoute] User authenticated via localStorage wallet data');
        } catch (e) {
          console.error('[ProtectedRoute] Failed to parse wallet data:', e);
        }
      }
    }

    // If session is required but we only have localStorage auth, that's still OK
    // The session requirement is really about having SOME form of authentication
    if (requireSession && !session && !authenticated) {
      console.log('[ProtectedRoute] Redirecting to login - no authentication found');
      router.push(redirectTo);
      setIsAuthenticated(false);
      return;
    }

    if (!authenticated) {
      console.log('[ProtectedRoute] Redirecting to login - not authenticated');
      router.push(redirectTo);
      setIsAuthenticated(false);
      return;
    }

    // Check if verified proof is required (for dashboard)
    if (requireVerifiedProof && identifier) {
      const proofs = ProofStorage.getProofsByDID(identifier);
      const hasVerifiedProof = proofs.some((p: any) => p.status === 'verified');
      
      if (!hasVerifiedProof) {
        console.log('[ProtectedRoute] Redirecting to DID proof - no verified proof');
        router.push('/did-proof');
        setIsAuthenticated(false);
        return;
      }
    }

    setIsAuthenticated(true);
    setUserIdentifier(identifier);
  }, [isConnected, session, isSessionLoading, requireSession, requireVerifiedProof, redirectTo, router]);

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show loading (redirect is happening)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting...</p>
        </div>
      </div>
    );
  }

  // Render protected content
  return <>{children}</>;
}

/**
 * Higher-order component version for wrapping page components
 */
export function withProtectedRoute<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<ProtectedRouteProps, 'children'>
) {
  return function ProtectedComponent(props: P) {
    return (
      <ProtectedRoute {...options}>
        <Component {...props} />
      </ProtectedRoute>
    );
  };
}
