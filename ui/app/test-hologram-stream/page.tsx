/**
 * Real-Time Hologram Streaming Test Page
 * 
 * Advanced testing page showing frame-by-frame hologram detection
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';

const HologramStreamingTester = dynamic(
  () => import('../../components/HologramStreamingTester'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-900 to-purple-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading Streaming Tester...</p>
        </div>
      </div>
    )
  }
);

export default function TestHologramStreamPage() {
  return <HologramStreamingTester />;
}
