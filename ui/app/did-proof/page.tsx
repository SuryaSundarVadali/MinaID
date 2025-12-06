/**
 * DID Proof Generation Page
 * 
 * Generates different types of proofs:
 * - citizenship: Proof of citizenship
 * - age18: Proof of being 18 or older
 * - age21: Proof of being 21 or older
 */

'use client';

import React, { Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';

// Dynamically import the component with SSR disabled to avoid o1js issues
const DIDProofGenerator = dynamic(
  () => import('../../components/proofs/DIDProofGenerator'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading proof generator...</p>
        </div>
      </div>
    )
  }
);

function DIDProofContent() {
  const searchParams = useSearchParams();
  const proofType = searchParams.get('type') || 'citizenship';

  return <DIDProofGenerator proofType={proofType as 'citizenship' | 'age18' | 'age21'} />;
}

export default function DIDProofPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <DIDProofContent />
    </Suspense>
  );
}
