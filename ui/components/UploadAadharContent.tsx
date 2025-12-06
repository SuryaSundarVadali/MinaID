'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { parseAadharXML, validateAadharFile, type AadharData } from '../lib/AadharParser';
import GradientBG from './GradientBG';

export default function UploadAadharContent() {
  const router = useRouter();
  const { session } = useWallet();
  const [state, setState] = useState<{
    file: File | null;
    uploading: boolean;
    success: boolean;
    error?: string;
    aadharData?: AadharData;
    userIdentifier?: string;
  }>({
    file: null,
    uploading: false,
    success: false,
  });

  // Get user identifier (DID from session or wallet address from localStorage)
  React.useEffect(() => {
    let identifier = session?.did;
    
    // If no session, check for wallet connection data
    if (!identifier) {
      const walletData = localStorage.getItem('minaid_wallet_connected');
      if (walletData) {
        try {
          const parsed = JSON.parse(walletData);
          identifier = parsed.address;
        } catch (e) {
          console.error('Failed to parse wallet data:', e);
        }
      }
    }
    
    setState(prev => ({ ...prev, userIdentifier: identifier }));
  }, [session]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateAadharFile(file);
    if (!validation.valid) {
      setState(prev => ({ ...prev, error: validation.error, file: null }));
      return;
    }

    setState(prev => ({ ...prev, file, error: undefined }));
  };

  const handleUpload = async () => {
    if (!state.file) {
      setState(prev => ({ ...prev, error: 'Please select a file' }));
      return;
    }

    if (!state.userIdentifier) {
      setState(prev => ({ ...prev, error: 'Please connect your wallet first' }));
      return;
    }

    setState(prev => ({ ...prev, uploading: true, error: undefined }));

    try {
      // Parse Aadhar XML
      const result = await parseAadharXML(state.file);
      
      if (!result.isValid || !result.data) {
        throw new Error(result.error || 'Failed to parse Aadhar XML');
      }

      // Store in localStorage using userIdentifier (DID or wallet address)
      localStorage.setItem(`aadhar_${state.userIdentifier}`, JSON.stringify(result.data));

      setState(prev => ({ 
        ...prev, 
        uploading: false, 
        success: true,
        aadharData: result.data
      }));

      // Redirect to dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);

    } catch (error: any) {
      console.error('[UploadAadhar] Error:', error);
      setState(prev => ({
        ...prev,
        uploading: false,
        error: error.message || 'Failed to upload Aadhar XML',
      }));
    }
  };

  return (
    <GradientBG>
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-2xl w-full">
          <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
            {/* Header */}
            <div className="text-center mb-6 sm:mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <span className="text-3xl">📄</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                Upload Aadhar XML
              </h1>
              <p className="text-sm sm:text-base text-gray-600">
                Upload your Aadhar XML file to generate zero-knowledge proofs
              </p>
            </div>

            {/* Error Display */}
            {state.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700">{state.error}</p>
              </div>
            )}

            {/* Success Display */}
            {state.success && state.aadharData && (
              <div className="mb-6 p-6 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                    <span className="text-3xl">✓</span>
                  </div>
                  <h3 className="text-lg font-bold text-green-900 mb-2">Upload Successful!</h3>
                  <p className="text-sm text-green-700 mb-4">
                    Your Aadhar credential has been securely stored locally
                  </p>
                  <div className="bg-white rounded-lg p-4 text-left">
                    <p className="text-sm text-gray-700">
                      <span className="font-semibold">Name:</span> {state.aadharData.name}
                    </p>
                    <p className="text-sm text-gray-700 mt-1">
                      <span className="font-semibold">DOB:</span> {state.aadharData.dateOfBirth}
                    </p>
                  </div>
                  <p className="text-sm text-green-600 mt-4">
                    Redirecting to dashboard...
                  </p>
                </div>
              </div>
            )}

            {/* Upload Form */}
            {!state.success && (
              <div className="space-y-6">
                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2 text-sm sm:text-base">What is Aadhar XML?</h3>
                  <p className="text-xs sm:text-sm text-blue-800 mb-2">
                    Aadhar XML is a digitally signed document issued by UIDAI containing your demographic information.
                  </p>
                  <p className="text-xs sm:text-sm text-blue-800">
                    <strong>Note:</strong> Your data is processed locally and never leaves your device.
                  </p>
                </div>

                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Select Aadhar XML File
                  </label>
                  <div className="flex items-center justify-center w-full">
                    <label className="w-full flex flex-col items-center px-4 py-8 bg-white border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-all">
                      <svg className="w-12 h-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                      <span className="text-sm text-gray-600 mb-2">
                        {state.file ? state.file.name : 'Click to select file'}
                      </span>
                      <span className="text-xs text-gray-500">XML files only (max 5MB)</span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".xml"
                        onChange={handleFileSelect}
                        disabled={state.uploading}
                      />
                    </label>
                  </div>
                </div>

                {/* Requirements */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-2 text-sm">Requirements:</h4>
                  <ul className="space-y-1 text-xs sm:text-sm text-gray-700">
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>Valid Aadhar XML file from UIDAI</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>File size under 5MB</span>
                    </li>
                    <li className="flex items-start">
                      <span className="text-green-500 mr-2">✓</span>
                      <span>XML format with digital signature</span>
                    </li>
                  </ul>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleUpload}
                    disabled={!state.file || state.uploading}
                    className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {state.uploading ? 'Processing...' : 'Upload & Save'}
                  </button>
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="flex-1 sm:flex-initial bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>

                {/* Security Notice */}
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-xs sm:text-sm text-yellow-800">
                    <strong>🔒 Privacy:</strong> Your Aadhar data is encrypted and stored only in your browser's local storage. It never leaves your device.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Help Link */}
          <div className="mt-6 text-center">
            <a
              href="https://resident.uidai.gov.in/offline-kyc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              How to download Aadhar XML? →
            </a>
          </div>
        </div>
      </div>
    </GradientBG>
  );
}
