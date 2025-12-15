/**
 * verifier/page.tsx
 * 
 * Verifier dashboard for requesting and verifying zero-knowledge proofs
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';

const VerifierDashboard = dynamic(
  () => import('../../components/VerifierDashboard').then((mod) => mod.VerifierDashboard),
  { ssr: false }
);

export default function VerifierPage() {
  return (
    <ProtectedRoute>
      <VerifierDashboard />
    </ProtectedRoute>
  );
}
