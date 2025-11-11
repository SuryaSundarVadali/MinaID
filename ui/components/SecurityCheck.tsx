/**
 * SecurityCheck.tsx
 * 
 * Checks for required browser security features and displays warnings
 */

'use client';

import React, { useEffect, useState } from 'react';
import { checkSecurityFeatures } from '../lib/SecurityUtils';

interface SecurityCheckProps {
  children: React.ReactNode;
}

export function SecurityCheck({ children }: SecurityCheckProps) {
  const [securityCheck, setSecurityCheck] = useState<{
    supported: boolean;
    missing: string[];
  } | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Perform security check on mount
    const check = checkSecurityFeatures();
    setSecurityCheck(check);
    setIsChecking(false);

    if (!check.supported) {
      console.warn('[SecurityCheck] Missing required features:', check.missing);
    }
  }, []);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-teal-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-white border-t-transparent mb-4"></div>
          <p className="text-white text-lg">Checking security features...</p>
        </div>
      </div>
    );
  }

  if (securityCheck && !securityCheck.supported) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900 via-blue-900 to-teal-900 p-4">
        <div className="max-w-2xl w-full bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl border border-white/20 p-8">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 rounded-full mb-4">
              <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              Browser Security Requirements Not Met
            </h2>
            <p className="text-white/80 mb-6">
              Your browser is missing some required security features for MinaID to function properly.
            </p>
          </div>

          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 mb-6">
            <h3 className="text-white font-semibold mb-2 flex items-center">
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Missing Features:
            </h3>
            <ul className="list-disc list-inside text-white/90 space-y-1">
              {securityCheck.missing.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 text-white/80 text-sm">
            <div>
              <h4 className="font-semibold text-white mb-1">Required Features:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li><strong>Web Crypto API</strong> - For secure encryption and hashing</li>
                <li><strong>WebAuthn/Passkeys</strong> - For biometric authentication</li>
                <li><strong>SharedArrayBuffer</strong> - For zero-knowledge proof generation (o1js requirement)</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold text-white mb-1">Recommendations:</h4>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>Use a modern browser (Chrome 92+, Firefox 95+, Safari 15.2+, Edge 92+)</li>
                <li>Ensure you're accessing via HTTPS (required for WebAuthn)</li>
                <li>Enable required browser flags if testing locally:
                  <ul className="list-disc list-inside ml-4 mt-1 text-xs">
                    <li>Chrome: Enable "Experimental Web Platform features"</li>
                    <li>Ensure Cross-Origin-Opener-Policy and Cross-Origin-Embedder-Policy headers are set</li>
                  </ul>
                </li>
                <li>Check that your browser supports passkeys/security keys</li>
              </ul>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3">
              <p className="text-yellow-200 text-xs">
                <strong>Note:</strong> MinaID uses advanced browser security features to ensure your identity and credentials
                are protected with zero-knowledge cryptography. These features are essential for secure operation.
              </p>
            </div>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            >
              Retry Security Check
            </button>
          </div>
        </div>
      </div>
    );
  }

  // All security features supported - render the app
  return <>{children}</>;
}
