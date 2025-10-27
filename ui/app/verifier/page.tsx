/**
 * verifier/page.tsx
 * 
 * Verifier dashboard for requesting and verifying zero-knowledge proofs
 */

'use client';

import React from 'react';
import { VerifierDashboard } from '../../components/VerifierDashboard';
import { ProtectedRoute } from '../../components/auth/ProtectedRoute';

export default function VerifierPage() {
  return (
    <ProtectedRoute>
      <VerifierDashboard />
    </ProtectedRoute>
  );
}
