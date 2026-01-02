/**
 * Hologram Testing Page
 * 
 * Development tool for testing the hologram verification system
 * with live camera preview and real-time feedback
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the testing tool with SSR disabled
const HologramTestingTool = dynamic(
  () => import('../../components/HologramTestingTool'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 to-indigo-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading Hologram Testing Tool...</p>
        </div>
      </div>
    )
  }
);

export default function TestHologramPage() {
  return <HologramTestingTool />;
}
