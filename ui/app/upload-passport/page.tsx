/**
 * Upload Passport Page
 * Accessible from dashboard to scan and verify physical passports
 * 
 * Flow:
 * 1. Scan passport MRZ + Record hologram video
 * 2. Upload to Oracle (multipart/form-data)
 * 3. Oracle validates MRZ + hologram (calls Python CV service)
 * 4. Oracle signs the verification result
 * 5. Submit signed proof to smart contract
 * 6. Store verified passport data
 */

'use client';

import React from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the content with SSR disabled to avoid o1js issues
const UploadPassportContent = dynamic(
  () => import('../../components/UploadPassportContent'),
  { 
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-indigo-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-indigo-400 mx-auto mb-4"></div>
          <p className="text-gray-300">Loading Passport Scanner...</p>
        </div>
      </div>
    )
  }
);

export default function UploadPassportPage() {
  return <UploadPassportContent />;
}
