// components/IPFSDownloader.tsx - Component for downloading and decrypting data from IPFS
'use client';

import React, { useState } from 'react';
import { getIPFSService } from '../lib/IPFSService';
import { generatePassphrase } from '../lib/IPFSCrypto';
import toast from 'react-hot-toast';

interface IPFSDownloaderProps {
  walletAddress: string; // User's wallet address for passphrase generation
  userPassword?: string; // Optional user password for decryption
  onDownloadSuccess?: (data: any, cid: string) => void;
  onDownloadError?: (error: Error) => void;
  placeholder?: string;
  buttonText?: string;
  autoLoad?: boolean; // Auto-load on CID input
  initialCID?: string; // Pre-filled CID
}

export function IPFSDownloader({
  walletAddress,
  userPassword,
  onDownloadSuccess,
  onDownloadError,
  placeholder = 'Enter IPFS CID (e.g., Qm...)',
  buttonText = 'Download from IPFS',
  autoLoad = false,
  initialCID = '',
}: IPFSDownloaderProps) {
  const [cid, setCid] = useState(initialCID);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [downloadedData, setDownloadedData] = useState<any>(null);
  const [error, setError] = useState<string>('');

  const handleDownload = async (cidToDownload?: string) => {
    const targetCID = cidToDownload || cid;
    
    if (!targetCID) {
      toast.error('Please enter an IPFS CID');
      return;
    }

    if (!walletAddress) {
      toast.error('Wallet address required for decryption');
      return;
    }

    setIsDownloading(true);
    setDownloadProgress('Initializing IPFS service...');
    setError('');
    setDownloadedData(null);

    try {
      // Get IPFS service
      const ipfsService = getIPFSService();

      // Generate passphrase from wallet address + password
      setDownloadProgress('Generating decryption key...');
      const passphrase = generatePassphrase(
        walletAddress,
        userPassword || 'default-password'
      );

      // Download and decrypt data
      setDownloadProgress('Downloading from IPFS...');
      const result = await ipfsService.downloadDecrypted(targetCID, passphrase);

      setDownloadProgress('Decrypting data...');
      setDownloadedData(result.data);
      setDownloadProgress('');

      toast.success(
        <div>
          <div className="font-bold">Download Successful!</div>
          <div className="text-sm mt-1">Data decrypted and loaded</div>
        </div>
      );

      // Call success callback
      if (onDownloadSuccess) {
        onDownloadSuccess(result.data, result.cid);
      }
    } catch (error) {
      console.error('[IPFSDownloader] Download failed:', error);
      const errorMessage = (error as Error).message || 'Download failed';
      
      // Check if it's an IPFS Desktop upload
      if (errorMessage.includes('IPFS_DESKTOP_UPLOAD')) {
        const cleanMessage = errorMessage.replace('IPFS_DESKTOP_UPLOAD: ', '');
        setError(cleanMessage);
        toast.error(
          <div>
            <div className="font-bold">⚠️ Unencrypted IPFS Data</div>
            <div className="text-sm mt-1 whitespace-pre-line">{cleanMessage}</div>
            <div className="text-sm mt-2 font-semibold">
              Try using "Import from IPFS Desktop" mode
            </div>
          </div>,
          { duration: 8000 }
        );
      } else {
        // Add helpful tips based on error type
        let displayMessage = errorMessage;
        if (errorMessage.includes('error page')) {
          displayMessage += '\n\n💡 Tip: Make sure you copied the complete CID from a valid upload.';
        } else if (errorMessage.includes('not in the expected format')) {
          displayMessage += '\n\n💡 Tip: This CID may contain unencrypted data. Only CIDs from MinaID\'s encrypted uploads can be decrypted.';
        } else if (errorMessage.includes('missing required encryption fields')) {
          displayMessage += '\n\n💡 Tip: Use the "Save to IPFS" feature in the upload page to create encrypted uploads.';
        }
        
        setError(displayMessage);
        toast.error(
          <div>
            <div className="font-bold">Download Failed</div>
            <div className="text-sm mt-1 whitespace-pre-line">{displayMessage}</div>
          </div>,
          { duration: 6000 }
        );
      }

      setDownloadProgress('');
      
      if (onDownloadError) {
        onDownloadError(error as Error);
      }
    } finally {
      setIsDownloading(false);
    }
  };

  // Auto-load when CID is provided
  React.useEffect(() => {
    if (autoLoad && initialCID && !downloadedData && !isDownloading) {
      handleDownload(initialCID);
    }
  }, [autoLoad, initialCID]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          type="text"
          value={cid}
          onChange={(e) => setCid(e.target.value)}
          placeholder={placeholder}
          disabled={isDownloading}
          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
        <button
          onClick={() => handleDownload()}
          disabled={isDownloading || !cid}
          className={`bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors ${
            isDownloading || !cid ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isDownloading ? (
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
              Downloading...
            </span>
          ) : (
            buttonText
          )}
        </button>
      </div>

      {downloadProgress && (
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {downloadProgress}
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <div>
              <p className="font-semibold text-red-900 dark:text-red-100">
                Download Failed
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {downloadedData && (
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
                Successfully Downloaded from IPFS
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Data decrypted and ready to use
              </p>
              <details className="mt-3">
                <summary className="text-sm text-blue-600 dark:text-blue-400 cursor-pointer hover:underline">
                  View Data (Debug)
                </summary>
                <pre className="mt-2 bg-white dark:bg-gray-800 p-3 rounded text-xs overflow-auto max-h-64">
                  {JSON.stringify(downloadedData, null, 2)}
                </pre>
              </details>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface CompactIPFSDownloaderProps {
  onDataLoaded: (data: any) => void;
  walletAddress: string;
  label?: string;
}

/**
 * Compact IPFS downloader for inline use
 */
export function CompactIPFSDownloader({
  onDataLoaded,
  walletAddress,
  label = 'Load from IPFS',
}: CompactIPFSDownloaderProps) {
  const [showDownloader, setShowDownloader] = useState(false);

  return (
    <div className="inline-block">
      <button
        onClick={() => setShowDownloader(!showDownloader)}
        className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
      >
        {label}
      </button>

      {showDownloader && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Load from IPFS</h3>
              <button
                onClick={() => setShowDownloader(false)}
                className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Enter the IPFS CID to download and decrypt your data.
            </p>
            
            <IPFSDownloader
              walletAddress={walletAddress}
              onDownloadSuccess={(data) => {
                onDataLoaded(data);
                setShowDownloader(false);
              }}
              buttonText="Load Data"
            />
          </div>
        </div>
      )}
    </div>
  );
}
