'use client';

import { useState } from 'react';
import GradientBG from '../../components/GradientBG';

export default function TestWallet() {
  const [logs, setLogs] = useState<string[]>([]);
  const [walletDetected, setWalletDetected] = useState<boolean>(false);
  const [passkeySupported, setPasskeySupported] = useState<boolean>(false);

  const addLog = (message: string) => {
    console.log(message);
    setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testWalletDetection = async () => {
    addLog('🔍 Testing wallet detection...');
    
    try {
      // Check for Auro Wallet
      const mina = (window as any).mina;
      if (mina) {
        addLog('✅ Auro Wallet detected!');
        addLog(`   mina object: ${JSON.stringify(Object.keys(mina))}`);
        setWalletDetected(true);
      } else {
        addLog('❌ Auro Wallet NOT detected');
        addLog('   Please install from: https://www.aurowallet.com/');
        setWalletDetected(false);
      }

      // Check for MetaMask
      const ethereum = (window as any).ethereum;
      if (ethereum && ethereum.isMetaMask) {
        addLog('✅ MetaMask detected!');
      } else {
        addLog('❌ MetaMask NOT detected');
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    }
  };

  const testWalletConnection = async () => {
    addLog('🔗 Testing Auro Wallet connection...');
    
    try {
      const mina = (window as any).mina;
      if (!mina) {
        throw new Error('Auro Wallet not installed');
      }

      addLog('   Requesting accounts...');
      const accounts = await mina.requestAccounts();
      
      if (accounts && accounts.length > 0) {
        addLog(`✅ Connected! Address: ${accounts[0]}`);
        addLog(`   Total accounts: ${accounts.length}`);
      } else {
        addLog('❌ No accounts found');
      }
    } catch (error: any) {
      addLog(`❌ Connection error: ${error.message}`);
    }
  };

  const testPasskeySupport = async () => {
    addLog('🔐 Testing Passkey support...');
    
    try {
      if (typeof window === 'undefined') {
        addLog('❌ Window not available (SSR)');
        return;
      }

      if (!window.PublicKeyCredential) {
        addLog('❌ WebAuthn not supported in this browser');
        setPasskeySupported(false);
        return;
      }

      addLog('✅ WebAuthn API available');
      
      // Check for platform authenticator
      const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (available) {
        addLog('✅ Platform authenticator available (Face ID, Touch ID, Windows Hello, etc.)');
        setPasskeySupported(true);
      } else {
        addLog('⚠️  Platform authenticator NOT available');
        addLog('   You may need to use a security key instead');
        setPasskeySupported(false);
      }

      // Check for conditional mediation
      if (PublicKeyCredential.isConditionalMediationAvailable) {
        const conditional = await PublicKeyCredential.isConditionalMediationAvailable();
        if (conditional) {
          addLog('✅ Conditional UI (autofill) supported');
        } else {
          addLog('ℹ️  Conditional UI not supported (optional)');
        }
      }
    } catch (error: any) {
      addLog(`❌ Passkey test error: ${error.message}`);
    }
  };

  const testPasskeyCreation = async () => {
    addLog('🔐 Testing Passkey creation...');
    
    try {
      const challenge = new Uint8Array(32);
      crypto.getRandomValues(challenge);
      const challengeBase64 = btoa(String.fromCharCode(...challenge));
      
      addLog('   Creating registration options...');
      
      const options: PublicKeyCredentialCreationOptions = {
        challenge: challenge,
        rp: {
          name: 'MinaID Test',
          id: window.location.hostname,
        },
        user: {
          id: new TextEncoder().encode('test-user-123'),
          name: 'test@example.com',
          displayName: 'Test User',
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          requireResidentKey: true,
          residentKey: 'required',
          userVerification: 'required',
        },
        timeout: 60000,
        attestation: 'none',
      };

      addLog('   Waiting for biometric authentication...');
      const credential = await navigator.credentials.create({ publicKey: options }) as PublicKeyCredential;
      
      if (credential) {
        addLog(`✅ Passkey created successfully!`);
        addLog(`   Credential ID: ${credential.id.substring(0, 20)}...`);
        addLog(`   Type: ${credential.type}`);
      } else {
        addLog('❌ Credential creation returned null');
      }
    } catch (error: any) {
      addLog(`❌ Passkey creation error: ${error.name}: ${error.message}`);
      if (error.name === 'NotAllowedError') {
        addLog('   User cancelled or timeout occurred');
      } else if (error.name === 'InvalidStateError') {
        addLog('   Credential already exists for this user');
      }
    }
  };

  const clearLogs = () => {
    setLogs([]);
  };

  return (
    <GradientBG>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold mb-6 text-center">🧪 Wallet & Passkey Diagnostics</h1>
          
          <div className="bg-white/90 backdrop-blur-sm rounded-lg shadow-lg p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Test Suite</h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={testWalletDetection}
                className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition"
              >
                1️⃣ Test Wallet Detection
              </button>
              
              <button
                onClick={testWalletConnection}
                className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition"
                disabled={!walletDetected}
              >
                2️⃣ Test Wallet Connection
              </button>
              
              <button
                onClick={testPasskeySupport}
                className="bg-purple-500 hover:bg-purple-600 text-white font-semibold py-3 px-6 rounded-lg transition"
              >
                3️⃣ Test Passkey Support
              </button>
              
              <button
                onClick={testPasskeyCreation}
                className="bg-orange-500 hover:bg-orange-600 text-white font-semibold py-3 px-6 rounded-lg transition"
                disabled={!passkeySupported}
              >
                4️⃣ Create Test Passkey
              </button>
            </div>

            <button
              onClick={clearLogs}
              className="bg-gray-500 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded transition text-sm"
            >
              Clear Logs
            </button>
          </div>

          <div className="bg-black/90 backdrop-blur-sm rounded-lg shadow-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-white">Console Logs</h2>
            <div className="bg-gray-900 rounded p-4 h-96 overflow-y-auto font-mono text-sm">
              {logs.length === 0 ? (
                <div className="text-gray-500">No logs yet. Run tests above to see results.</div>
              ) : (
                logs.map((log, index) => (
                  <div key={index} className="text-green-400 mb-1">
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 text-center">
            <a
              href="/"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
    </GradientBG>
  );
}
