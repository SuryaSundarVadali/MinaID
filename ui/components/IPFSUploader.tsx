// components/IPFSUploader.tsx - Component for uploading encrypted data to IPFS
'use client';

import React, { useState } from 'react';
import { getIPFSService } from '../lib/IPFSService';
import { generatePassphrase } from '../lib/IPFSCrypto';
import toast from 'react-hot-toast';

interface IPFSUploaderProps {
  data: any; // Data to upload (Aadhar, proof, etc.)
  walletAddress: string; // User's wallet address for passphrase generation
  userPassword?: string; // Optional user password for encryption
  onUploadSuccess?: (cid: string, metadata: any) => void;
  onUploadError?: (error: Error) => void;
  name?: string; // Name for the upload
  metadata?: any; // Additional metadata
  buttonText?: string;
  buttonClassName?: string;
}

export function IPFSUploader({
  data,
  walletAddress,
  userPassword,
  onUploadSuccess,
  onUploadError,
  name,
  metadata,
  buttonText = 'Upload to IPFS',
  buttonClassName = 'bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors',
}: IPFSUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [uploadedCID, setUploadedCID] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!data) {
      toast.error('No data to upload');
      return;
    }

    if (!walletAddress) {
      toast.error('Wallet address required for encryption');
      return;
    }

    setIsUploading(true);
    setUploadProgress('Initializing IPFS service...');

    try {
      // Get IPFS service
      const ipfsService = getIPFSService();

      // Generate passphrase from wallet address + password
      setUploadProgress('Generating encryption key...');
      const passphrase = generatePassphrase(
        walletAddress,
        userPassword || 'default-password'
      );

      // Upload encrypted data
      setUploadProgress('Encrypting and uploading to IPFS...');
      const result = await ipfsService.uploadEncrypted(data, passphrase, {
        name: name || `minaid-data-${Date.now()}`,
        metadata: {
          walletAddress,
          timestamp: Date.now(),
          type: 'encrypted-credential',
          ...metadata,
        },
      });

      setUploadedCID(result.cid);
      setUploadProgress('');
      
      toast.success(
        <div>
          <div className="font-bold">Upload Successful!</div>
          <div className="text-sm mt-1">CID: {result.cid.substring(0, 12)}...</div>
        </div>
      );

      // Call success callback
      if (onUploadSuccess) {
        onUploadSuccess(result.cid, {
          size: result.size,
          timestamp: result.timestamp,
          encryptionMetadata: result.encryptionMetadata,
        });
      }
    } catch (error) {
      console.error('[IPFSUploader] Upload failed:', error);
      const errorMessage = (error as Error).message || 'Upload failed';
      
      toast.error(
        <div>
          <div className="font-bold">Upload Failed</div>
          <div className="text-sm mt-1">{errorMessage}</div>
        </div>
      );

      setUploadProgress('');
      
      if (onUploadError) {
        onUploadError(error as Error);
      }
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={handleUpload}
        disabled={isUploading || !data}
        className={`${buttonClassName} ${
          isUploading || !data ? 'opacity-50 cursor-not-allowed' : ''
        }`}
      >
        {isUploading ? (
          <span className="flex items-center gap-2">
            <svg
              className="animate-spin h-5 w-5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Uploading...
          </span>
        ) : (
          buttonText
        )}
      </button>

      {uploadProgress && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {uploadProgress}
        </div>
      )}

      {uploadedCID && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <div className="flex-1">
              <p className="font-semibold text-green-900 dark:text-green-100">
                Successfully Uploaded to IPFS
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Content ID (CID):
              </p>
              <code className="block bg-white dark:bg-gray-800 px-3 py-2 rounded mt-2 text-xs break-all">
                {uploadedCID}
              </code>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(uploadedCID);
                    toast.success('CID copied to clipboard');
                  }}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Copy CID
                </button>
                <a
                  href={`https://gateway.pinata.cloud/ipfs/${uploadedCID}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View on IPFS Gateway
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface QuickIPFSUploaderProps {
  onCIDGenerated: (cid: string) => void;
  walletAddress: string;
  label?: string;
}

/**
 * Compact IPFS uploader for inline use
 */
export function QuickIPFSUploader({
  onCIDGenerated,
  walletAddress,
  label = 'Save to IPFS',
}: QuickIPFSUploaderProps) {
  const [showUploader, setShowUploader] = useState(false);

  return (
    <div className="inline-block">
      <button
        onClick={() => setShowUploader(!showUploader)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {label}
      </button>

      {showUploader && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Upload to IPFS</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Your data will be encrypted before uploading to IPFS. Only you can decrypt it using your wallet address.
            </p>
            {/* Uploader implementation */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setShowUploader(false)}
                className="flex-1 bg-gray-200 dark:bg-gray-700 px-4 py-2 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
