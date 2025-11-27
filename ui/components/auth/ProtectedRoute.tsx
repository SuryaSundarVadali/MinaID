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

import React, { useEffect, ReactNode } from 'react';
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
  const { isConnected, session } = useWallet();
  const router = useRouter();

  useEffect(() => {
    // Check if user is connected and has session
    if (!isConnected || (requireSession && !session)) {
      console.log('[ProtectedRoute] Redirecting to login - not authenticated');
      router.push(redirectTo);
      return;
    }

    // Check if verified proof is required (for dashboard)
    if (requireVerifiedProof && session?.did) {
      const proofs = ProofStorage.getProofsByDID(session.did);
      const hasVerifiedProof = proofs.some((p: any) => p.status === 'verified');
      
      if (!hasVerifiedProof) {
        console.log('[ProtectedRoute] Redirecting to DID proof - no verified proof');
        router.push('/did-proof');
        return;
      }
    }
  }, [isConnected, session, requireSession, requireVerifiedProof, redirectTo, router]);

  // Show loading state while checking auth
  if (!isConnected || (requireSession && !session)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
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
