'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWallet } from '../context/WalletContext';
import { parseAadharXML, validateAadharFile, type AadharData } from '../lib/AadharParser';
import { IPFSUploader } from './IPFSUploader';
import { IPFSDownloader } from './IPFSDownloader';
import GradientBG from './GradientBG';

type UploadMode = 'device' | 'ipfs-upload' | 'ipfs-download' | 'ipfs-import';

export default function UploadAadharContent() {
  const router = useRouter();
  const { session } = useWallet();
  const [uploadMode, setUploadMode] = useState<UploadMode>('device');
  const [state, setState] = useState<{
    file: File | null;
    uploading: boolean;
    success: boolean;
    error?: string;
    aadharData?: AadharData;
    userIdentifier?: string;
    ipfsCID?: string;
    isLoading?: boolean;
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

  const handleIPFSUploadSuccess = (cid: string, metadata: any) => {
    // Store CID reference
    if (state.userIdentifier && state.aadharData) {
      localStorage.setItem(
        `aadhar_ipfs_${state.userIdentifier}`,
        JSON.stringify({ cid, timestamp: metadata.timestamp })
      );
      
      setState(prev => ({ ...prev, ipfsCID: cid }));
    }
  };

  const handleIPFSDownloadSuccess = (data: AadharData, cid: string) => {
    if (!state.userIdentifier) return;

    // Store downloaded data locally
    localStorage.setItem(`aadhar_${state.userIdentifier}`, JSON.stringify(data));
    localStorage.setItem(
      `aadhar_ipfs_${state.userIdentifier}`,
      JSON.stringify({ cid, timestamp: Date.now() })
    );

    setState(prev => ({ 
      ...prev, 
      success: true,
      aadharData: data,
      ipfsCID: cid
    }));

    // Redirect to dashboard
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);
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
                Upload from device or load from IPFS
              </p>
            </div>

            {/* Upload Mode Selector */}
            {!state.success && (
              <div className="mb-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 p-2 bg-gray-50 rounded-lg border border-gray-300">
                  <button
                    onClick={() => setUploadMode('device')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      uploadMode === 'device'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    📱 From Device
                  </button>
                  <button
                    onClick={() => setUploadMode('ipfs-upload')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      uploadMode === 'ipfs-upload'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    ☁️ Save to IPFS
                  </button>
                  <button
                    onClick={() => setUploadMode('ipfs-download')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      uploadMode === 'ipfs-download'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    🔗 MinaID IPFS
                  </button>
                  <button
                    onClick={() => setUploadMode('ipfs-import')}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      uploadMode === 'ipfs-import'
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    💾 IPFS Desktop
                  </button>
                </div>
              </div>
            )}

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
                {/* Device Upload Mode */}
                {uploadMode === 'device' && (
                  <>
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

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleUpload}
                        disabled={!state.file || state.uploading}
                        className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                      >
                        {state.uploading ? 'Processing...' : 'Upload & Save Locally'}
                      </button>
                      <button
                        onClick={() => router.push('/dashboard')}
                        className="flex-1 sm:flex-initial bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all active:scale-[0.98]"
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                )}

                {/* IPFS Upload Mode */}
                {uploadMode === 'ipfs-upload' && (
                  <>
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <h3 className="font-semibold text-purple-900 mb-2 text-sm sm:text-base">
                        🌐 Save to IPFS (Decentralized Storage)
                      </h3>
                      <p className="text-xs sm:text-sm text-purple-800 mb-2">
                        Upload your Aadhar XML to IPFS with end-to-end encryption. Your data will be encrypted before upload and only you can decrypt it.
                      </p>
                      <p className="text-xs sm:text-sm text-purple-800">
                        <strong>Benefits:</strong> Share credentials securely, access from anywhere, immutable storage
                      </p>
                    </div>

                    {/* File Input for IPFS Upload */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-3">
                        Select Aadhar XML File
                      </label>
                      <div className="flex items-center justify-center w-full">
                        <label className="w-full flex flex-col items-center px-4 py-8 bg-white border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-all">
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
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;

                              const validation = validateAadharFile(file);
                              if (!validation.valid) {
                                setState(prev => ({ ...prev, error: validation.error, file: null }));
                                return;
                              }

                              // Parse immediately
                              try {
                                const result = await parseAadharXML(file);
                                if (!result.isValid || !result.data) {
                                  throw new Error(result.error || 'Failed to parse Aadhar XML');
                                }
                                
                                setState(prev => ({ ...prev, file, aadharData: result.data, error: undefined }));
                              } catch (error: any) {
                                setState(prev => ({ ...prev, error: error.message, file: null }));
                              }
                            }}
                            disabled={state.uploading}
                          />
                        </label>
                      </div>
                    </div>

                    {/* IPFS Uploader Component */}
                    {state.aadharData && state.userIdentifier && (
                      <IPFSUploader
                        data={state.aadharData}
                        walletAddress={state.userIdentifier}
                        onUploadSuccess={(cid, metadata) => {
                          handleIPFSUploadSuccess(cid, metadata);
                          // Also save locally
                          localStorage.setItem(`aadhar_${state.userIdentifier}`, JSON.stringify(state.aadharData));
                          setState(prev => ({ ...prev, success: true }));
                          setTimeout(() => router.push('/dashboard'), 2000);
                        }}
                        onUploadError={(error) => {
                          setState(prev => ({ ...prev, error: error.message }));
                        }}
                        name={`aadhar-${state.userIdentifier}`}
                        metadata={{ type: 'aadhar-credential' }}
                        buttonText="🔐 Encrypt & Upload to IPFS"
                        buttonClassName="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg"
                      />
                    )}

                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* IPFS Download Mode */}
                {uploadMode === 'ipfs-download' && (
                  <>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <h3 className="font-semibold text-green-900 mb-2 text-sm sm:text-base">
                        🔗 Load from IPFS
                      </h3>
                      <p className="text-xs sm:text-sm text-green-800 mb-2">
                        Enter your IPFS CID to download and decrypt your previously uploaded Aadhar credential.
                      </p>
                      <p className="text-xs sm:text-sm text-green-800">
                        <strong>Note:</strong> You'll need the same wallet address used during upload to decrypt the data.
                      </p>
                    </div>

                    {/* IPFS Downloader Component */}
                    {state.userIdentifier && (
                      <IPFSDownloader
                        walletAddress={state.userIdentifier}
                        onDownloadSuccess={handleIPFSDownloadSuccess}
                        onDownloadError={(error) => {
                          setState(prev => ({ ...prev, error: error.message }));
                        }}
                        placeholder="Enter IPFS CID (e.g., QmXx...)"
                        buttonText="🔓 Download & Decrypt"
                      />
                    )}

                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                  </>
                )}

                {/* IPFS Import Mode (from IPFS Desktop) */}
                {uploadMode === 'ipfs-import' && (
                  <>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <h3 className="font-semibold text-amber-900 mb-2 text-sm sm:text-base">
                        💾 Import from IPFS Desktop
                      </h3>
                      <p className="text-xs sm:text-sm text-amber-800 mb-2">
                        Import unencrypted Aadhar XML data that you've uploaded to IPFS using IPFS Desktop or other IPFS tools.
                      </p>
                      <p className="text-xs sm:text-sm text-amber-800 font-semibold">
                        ⚠️ This option is for data uploaded via IPFS Desktop (not encrypted by MinaID)
                      </p>
                    </div>

                    {/* Simple CID Input */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        IPFS CID
                      </label>
                      <input
                        type="text"
                        placeholder="QmVfWCQSgB1cREyZgweMc6sVsSm7Xcrki5yHQrdWG9u9Jt"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                        onChange={(e) => setState(prev => ({ ...prev, ipfsCID: e.target.value }))}
                      />
                    </div>

                    <button
                      onClick={async () => {
                        if (!state.ipfsCID) {
                          setState(prev => ({ ...prev, error: 'Please enter a CID' }));
                          return;
                        }

                        setState(prev => ({ ...prev, isLoading: true, error: undefined }));

                        try {
                          const { getIPFSService } = await import('../lib/IPFSService');
                          const ipfsService = getIPFSService();
                          
                          // Download raw data (unencrypted)
                          const result = await ipfsService.downloadRaw(state.ipfsCID);
                          
                          // Assume it's XML text
                          let xmlContent: string;
                          if (result.data instanceof Blob) {
                            xmlContent = await result.data.text();
                          } else if (typeof result.data === 'string') {
                            xmlContent = result.data;
                          } else {
                            throw new Error('Unexpected data format');
                          }

                          // Parse XML
                          const { parseAadharXML } = await import('../lib/AadharParser');
                          const xmlBlob = new Blob([xmlContent], { type: 'text/xml' });
                          const xmlFile = new File([xmlBlob], 'aadhar.xml', { type: 'text/xml' });
                          const parsedData = await parseAadharXML(xmlFile);

                          // Store locally
                          if (!state.userIdentifier) {
                            throw new Error('No user identifier');
                          }

                          localStorage.setItem(
                            `aadhar_${state.userIdentifier}`,
                            JSON.stringify(parsedData.data)
                          );
                          
                          localStorage.setItem(
                            `aadhar_ipfs_${state.userIdentifier}`,
                            JSON.stringify({ cid: state.ipfsCID, timestamp: Date.now(), source: 'ipfs-desktop' })
                          );

                          setState(prev => ({ 
                            ...prev, 
                            success: true,
                            aadharData: parsedData.data,
                            isLoading: false
                          }));

                          setTimeout(() => router.push('/dashboard'), 2000);
                        } catch (error: any) {
                          console.error('[IPFS Import] Failed:', error);
                          setState(prev => ({ 
                            ...prev, 
                            error: `Failed to import: ${error.message}`,
                            isLoading: false
                          }));
                        }
                      }}
                      disabled={state.isLoading || !state.ipfsCID}
                      className="w-full bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg font-semibold transition-all shadow-md hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed"
                    >
                      {state.isLoading ? '⏳ Importing...' : '📥 Import from IPFS Desktop'}
                    </button>

                    <button
                      onClick={() => router.push('/dashboard')}
                      className="w-full bg-gray-200 text-gray-700 px-6 py-3 rounded-lg font-semibold hover:bg-gray-300 transition-all active:scale-[0.98]"
                    >
                      Cancel
                    </button>
                  </>
                )}
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
