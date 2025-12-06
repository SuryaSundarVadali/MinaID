'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the test content with SSR disabled to avoid o1js issues
const TestProofsContent = dynamic(
  () => import('../../components/TestProofsContent'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-indigo-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading test suite...</p>
        </div>
      </div>
    )
  }
);

export default function TestProofsPage() {
  return <TestProofsContent />;
}
