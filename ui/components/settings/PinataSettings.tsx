/**
 * PinataSettings.tsx
 * Component for connecting and managing Pinata IPFS credentials
 */

'use client';

import React, { useState, useEffect } from 'react';
import { generatePassphrase } from '../../lib/IPFSCrypto';
import CryptoJS from 'crypto-js';

interface PinataCredentials {
  apiKey: string;
  apiSecret: string;
  gateway?: string;
}

interface PinataSettingsProps {
  walletAddress?: string;
}

export function PinataSettings({ walletAddress }: PinataSettingsProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [gateway, setGateway] = useState('https://gateway.pinata.cloud');
  const [isLoading, setIsLoading] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  useEffect(() => {
    checkConnection();
  }, [walletAddress]);

  const checkConnection = () => {
    const stored = localStorage.getItem('pinata_credentials');
    if (stored && walletAddress) {
      try {
        const passphrase = generatePassphrase(walletAddress, 'pinata-creds');
        const decrypted = CryptoJS.AES.decrypt(stored, passphrase).toString(CryptoJS.enc.Utf8);
        const creds: PinataCredentials = JSON.parse(decrypted);
        setIsConnected(true);
        setGateway(creds.gateway || 'https://gateway.pinata.cloud');
      } catch (error) {
        console.error('Failed to load Pinata credentials:', error);
        setIsConnected(false);
      }
    }
  };

  const handleConnect = async () => {
    if (!apiKey || !apiSecret || !walletAddress) {
      alert('Please enter both API Key and API Secret');
      return;
    }

    setIsLoading(true);
    setTestStatus('testing');

    try {
      // Test credentials by attempting to authenticate
      const testResponse = await fetch('/api/ipfs/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey, apiSecret })
      });

      if (!testResponse.ok) {
        throw new Error('Invalid Pinata credentials');
      }

      // Encrypt and store credentials
      const passphrase = generatePassphrase(walletAddress, 'pinata-creds');
      const credentials: PinataCredentials = {
        apiKey,
        apiSecret,
        gateway
      };
      const encrypted = CryptoJS.AES.encrypt(
        JSON.stringify(credentials),
        passphrase
      ).toString();

      localStorage.setItem('pinata_credentials', encrypted);
      setIsConnected(true);
      setTestStatus('success');
      setShowCredentials(false);
      setApiKey('');
      setApiSecret('');
      
      alert('✅ Pinata account connected successfully!');
    } catch (error: any) {
      console.error('Failed to connect Pinata:', error);
      setTestStatus('error');
      alert(`Failed to connect: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = () => {
    if (confirm('Disconnect your Pinata account? You will need to reconnect to upload proofs.')) {
      localStorage.removeItem('pinata_credentials');
      setIsConnected(false);
      setApiKey('');
      setApiSecret('');
      setTestStatus('idle');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Pinata IPFS Storage</h3>
          <p className="text-sm text-gray-600 mt-1">
            Connect your Pinata account to store proofs on IPFS
          </p>
        </div>
        {isConnected && (
          <div className="flex items-center gap-2 bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-semibold">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Connected
          </div>
        )}
      </div>

      {!isConnected ? (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-blue-900 mb-2">🔐 Why Connect Pinata?</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Store your ZK proofs on decentralized IPFS</li>
              <li>• Share proof CIDs with verifiers securely</li>
              <li>• Keep full control of your data</li>
              <li>• Free tier: 1GB storage, 100GB bandwidth</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-yellow-900 mb-2">📝 How to Get Credentials</h4>
            <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
              <li>Sign up at <a href="https://pinata.cloud" target="_blank" rel="noopener" className="underline">pinata.cloud</a></li>
              <li>Go to Account → API Keys</li>
              <li>Create a new API key with admin permissions</li>
              <li>Copy the API Key and API Secret</li>
              <li>Paste them below</li>
            </ol>
          </div>

          {!showCredentials ? (
            <button
              onClick={() => setShowCredentials(true)}
              className="w-full bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 transition font-semibold"
            >
              🔗 Connect Pinata Account
            </button>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pinata API Key
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Enter your Pinata API Key"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Pinata API Secret
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="Enter your Pinata API Secret"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Gateway URL (Optional)
                </label>
                <input
                  type="text"
                  value={gateway}
                  onChange={(e) => setGateway(e.target.value)}
                  placeholder="https://gateway.pinata.cloud"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>

              {testStatus === 'error' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">
                    ❌ Failed to connect. Please check your credentials.
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleConnect}
                  disabled={isLoading || !apiKey || !apiSecret}
                  className="flex-1 bg-purple-600 text-white py-3 px-4 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition font-semibold flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      Testing...
                    </>
                  ) : (
                    <>✓ Connect & Test</>
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowCredentials(false);
                    setApiKey('');
                    setApiSecret('');
                    setTestStatus('idle');
                  }}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-2xl">
                ✓
              </div>
              <div>
                <p className="font-semibold text-green-900">Account Connected</p>
                <p className="text-sm text-green-700">Your proofs will be uploaded to your Pinata account</p>
              </div>
            </div>
            
            <div className="bg-white rounded-lg p-3 mt-3">
              <p className="text-xs text-gray-500 mb-1">Gateway URL:</p>
              <p className="text-sm font-mono text-gray-700">{gateway}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => window.open('https://app.pinata.cloud', '_blank')}
              className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition text-sm font-medium"
            >
              📊 View Dashboard
            </button>
            <button
              onClick={handleDisconnect}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition text-sm font-medium"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function getPinataCredentials(walletAddress: string): PinataCredentials | null {
  const stored = localStorage.getItem('pinata_credentials');
  if (stored && walletAddress) {
    try {
      const passphrase = generatePassphrase(walletAddress, 'pinata-creds');
      const decrypted = CryptoJS.AES.decrypt(stored, passphrase).toString(CryptoJS.enc.Utf8);
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Failed to decrypt Pinata credentials:', error);
      return null;
    }
  }
  return null;
}
