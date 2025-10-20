/**
 * SignupOrchestrator.tsx
 * 
 * Multi-step wizard for MinaID registration with biometric security.
 * Orchestrates the complete signup flow from wallet connection to DID registration.
 * 
 * Flow:
 * 1. Connect Wallet (Auro or Metamask)
 * 2. Upload Aadhar XML
 * 3. Create Passkey (biometric)
 * 4. Encrypt Private Key
 * 5. Register DID On-Chain
 * 
 * Security:
 * - Private key never stored in plaintext
 * - Biometric binding prevents credential theft
 * - All sensitive operations happen client-side
 */

'use client';

import React, { useState } from 'react';
import { PrivateKey, PublicKey, Field, Poseidon, MerkleMap } from 'o1js';
import { useWallet } from '../context/WalletContext';
import { usePasskey } from '../hooks/usePasskey';
import { parseAadharXML, validateAadharFile, type AadharData } from '../lib/AadharParser';
import { ContractInterface, createNetworkConfig } from '../lib/ContractInterface';
import { sha256Hash } from '../lib/CryptoUtils';

// Types
type SignupStep = 
  | 'welcome'
  | 'connect-wallet'
  | 'upload-aadhar'
  | 'create-passkey'
  | 'register-did'
  | 'complete';

interface SignupState {
  step: SignupStep;
  walletConnected: boolean;
  aadharData?: AadharData;
  passkeyId?: string;
  did?: string;
  error?: string;
  loading: boolean;
}

export function SignupOrchestrator() {
  const { connectAuroWallet, connectMetamask, storePrivateKey } = useWallet();
  const { createPasskey, isSupported: isPasskeySupported } = usePasskey();

  const [state, setState] = useState<SignupState>({
    step: 'welcome',
    walletConnected: false,
    loading: false,
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [minaPrivateKey, setMinaPrivateKey] = useState<PrivateKey | null>(null);

  /**
   * Step 1: Connect Wallet
   */
  const handleConnectAuro = async () => {
    setState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const walletInfo = await connectAuroWallet();
      
      // Generate or import Mina private key
      const privateKey = PrivateKey.random();
      const publicKey = privateKey.toPublicKey();
      const did = publicKey.toBase58();

      setMinaPrivateKey(privateKey);
      
      setState(prev => ({
        ...prev,
        walletConnected: true,
        did,
        loading: false,
        step: 'upload-aadhar',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to connect wallet',
      }));
    }
  };

  const handleConnectMetamask = async () => {
    setState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const walletInfo = await connectMetamask();
      
      // Generate Mina key pair
      const privateKey = PrivateKey.random();
      const publicKey = privateKey.toPublicKey();
      const did = publicKey.toBase58();

      setMinaPrivateKey(privateKey);
      
      setState(prev => ({
        ...prev,
        walletConnected: true,
        did,
        loading: false,
        step: 'upload-aadhar',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to connect wallet',
      }));
    }
  };

  /**
   * Step 2: Upload and Parse Aadhar
   */
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateAadharFile(file);
    if (!validation.valid) {
      setState(prev => ({ ...prev, error: validation.error }));
      return;
    }

    setSelectedFile(file);
    setState(prev => ({ ...prev, error: undefined }));
  };

  const handleParseAadhar = async () => {
    if (!selectedFile) {
      setState(prev => ({ ...prev, error: 'Please select an Aadhar XML file' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      const result = await parseAadharXML(selectedFile);
      
      if (!result.isValid || !result.data) {
        throw new Error(result.error || 'Invalid Aadhar XML');
      }

      setState(prev => ({
        ...prev,
        aadharData: result.data,
        loading: false,
        step: 'create-passkey',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to parse Aadhar XML',
      }));
    }
  };

  /**
   * Step 3: Create Passkey and Encrypt Private Key
   */
  const handleCreatePasskey = async () => {
    if (!state.did || !minaPrivateKey) {
      setState(prev => ({ ...prev, error: 'Invalid state - please restart signup' }));
      return;
    }

    if (!isPasskeySupported) {
      setState(prev => ({ ...prev, error: 'Passkeys not supported in this browser' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      // Create Passkey with biometric authentication
      const passkey = await createPasskey(
        state.did,
        `MinaID - ${state.aadharData?.name || 'User'}`
      );

      // Encrypt and store private key with Passkey
      await storePrivateKey('auro', minaPrivateKey.toBase58(), passkey.id);

      // Clear plaintext private key from memory
      setMinaPrivateKey(null);

      setState(prev => ({
        ...prev,
        passkeyId: passkey.id,
        loading: false,
        step: 'register-did',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to create Passkey',
      }));
    }
  };

  /**
   * Step 4: Register DID On-Chain
   */
  const handleRegisterDID = async () => {
    if (!state.did || !state.aadharData) {
      setState(prev => ({ ...prev, error: 'Invalid state' }));
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: undefined }));

    try {
      // Create DID document hash
      const didDocument = {
        did: state.did,
        name: state.aadharData.name,
        verifiedBy: 'UIDAI',
        verifiedAt: state.aadharData.verifiedAt,
      };

      const documentHash = await sha256Hash(JSON.stringify(didDocument));
      const documentHashField = Field.from(BigInt('0x' + Buffer.from(documentHash, 'base64').toString('hex').substring(0, 32)));

      // Initialize contract interface
      const networkConfig = createNetworkConfig(
        (process.env.NEXT_PUBLIC_NETWORK as any) || 'berkeley'
      );
      const contractInterface = new ContractInterface(networkConfig);
      await contractInterface.initialize();

      // Create Merkle witness for DID
      const merkleMap = new MerkleMap();
      const didKey = Poseidon.hash(PublicKey.fromBase58(state.did).toFields());
      const witness = merkleMap.getWitness(didKey);

      // Temporarily load private key for transaction signing
      // (In production, this would require Passkey authentication)
      const tempPrivateKey = PrivateKey.random(); // Placeholder

      // Register DID on-chain
      const result = await contractInterface.registerDID(
        PublicKey.fromBase58(state.did),
        documentHashField,
        tempPrivateKey,
        witness
      );

      if (!result.success) {
        throw new Error(result.error || 'DID registration failed');
      }

      setState(prev => ({
        ...prev,
        loading: false,
        step: 'complete',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || 'Failed to register DID',
      }));
    }
  };

  /**
   * Render current step
   */
  const renderStep = () => {
    switch (state.step) {
      case 'welcome':
        return (
          <div className="text-center space-y-6">
            <h1 className="text-4xl font-bold">Welcome to MinaID</h1>
            <p className="text-lg text-gray-600">
              Create your decentralized identity with biometric security
            </p>
            <button
              onClick={() => setState(prev => ({ ...prev, step: 'connect-wallet' }))}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Get Started
            </button>
          </div>
        );

      case 'connect-wallet':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Step 1: Connect Your Wallet</h2>
            <p className="text-gray-600">
              Choose a wallet to create your MinaID
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={handleConnectAuro}
                disabled={state.loading}
                className="p-6 border-2 border-blue-500 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
              >
                <h3 className="font-bold text-lg mb-2">Auro Wallet</h3>
                <p className="text-sm text-gray-600">Mina Protocol Native</p>
              </button>

              <button
                onClick={handleConnectMetamask}
                disabled={state.loading}
                className="p-6 border-2 border-orange-500 rounded-lg hover:bg-orange-50 transition disabled:opacity-50"
              >
                <h3 className="font-bold text-lg mb-2">Metamask</h3>
                <p className="text-sm text-gray-600">Ethereum & EVM Chains</p>
              </button>
            </div>
          </div>
        );

      case 'upload-aadhar':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Step 2: Upload Aadhar XML</h2>
            <p className="text-gray-600">
              Upload your eAadhaar XML file for KYC verification
            </p>

            <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".xml"
                onChange={handleFileSelect}
                className="hidden"
                id="aadhar-upload"
              />
              <label
                htmlFor="aadhar-upload"
                className="cursor-pointer inline-block px-6 py-3 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                {selectedFile ? selectedFile.name : 'Choose Aadhar XML File'}
              </label>
              
              <p className="mt-4 text-sm text-gray-500">
                Your Aadhar data stays on your device. We never send it to any server.
              </p>
            </div>

            {selectedFile && (
              <button
                onClick={handleParseAadhar}
                disabled={state.loading}
                className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              >
                {state.loading ? 'Parsing...' : 'Continue'}
              </button>
            )}
          </div>
        );

      case 'create-passkey':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Step 3: Create Biometric Passkey</h2>
            <p className="text-gray-600">
              Secure your identity with Face ID, Touch ID, or fingerprint
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-bold mb-2">🔐 Why Passkeys?</h3>
              <ul className="text-sm space-y-2 text-gray-700">
                <li>✓ Your private key is encrypted with your biometric</li>
                <li>✓ Only you can generate proofs - credential sharing impossible</li>
                <li>✓ Device-bound security - cannot be phished or stolen</li>
              </ul>
            </div>

            {state.aadharData && (
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-600">Creating Passkey for:</p>
                <p className="font-bold">{state.aadharData.name}</p>
              </div>
            )}

            <button
              onClick={handleCreatePasskey}
              disabled={state.loading || !isPasskeySupported}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {state.loading ? 'Creating Passkey...' : 'Create Passkey'}
            </button>

            {!isPasskeySupported && (
              <p className="text-red-500 text-sm text-center">
                Passkeys not supported in this browser. Please use Chrome, Safari, or Edge.
              </p>
            )}
          </div>
        );

      case 'register-did':
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Step 4: Register Your DID</h2>
            <p className="text-gray-600">
              Register your decentralized identifier on Mina blockchain
            </p>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div>
                <p className="text-sm text-gray-600">Your DID:</p>
                <p className="font-mono text-sm break-all">{state.did}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Name:</p>
                <p className="font-bold">{state.aadharData?.name}</p>
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-gray-700">
                ⚠️ This will create a transaction on Mina blockchain. Make sure you have enough MINA for gas fees.
              </p>
            </div>

            <button
              onClick={handleRegisterDID}
              disabled={state.loading}
              className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {state.loading ? 'Registering...' : 'Register DID'}
            </button>
          </div>
        );

      case 'complete':
        return (
          <div className="text-center space-y-6">
            <div className="text-6xl">🎉</div>
            <h2 className="text-3xl font-bold">Welcome to MinaID!</h2>
            <p className="text-lg text-gray-600">
              Your decentralized identity is ready
            </p>

            <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-left">
              <h3 className="font-bold mb-2">What's Next?</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li>✓ Use your Passkey to login securely</li>
                <li>✓ Generate zero-knowledge proofs of your credentials</li>
                <li>✓ Verify your identity anywhere without revealing data</li>
              </ul>
            </div>

            <button
              onClick={() => window.location.href = '/dashboard'}
              className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Go to Dashboard
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            {['welcome', 'connect-wallet', 'upload-aadhar', 'create-passkey', 'register-did', 'complete'].map((step, index) => (
              <div
                key={step}
                className={`h-2 flex-1 mx-1 rounded ${
                  ['welcome', 'connect-wallet', 'upload-aadhar', 'create-passkey', 'register-did', 'complete'].indexOf(state.step) >= index
                    ? 'bg-blue-600'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center mt-2">
            Step {['welcome', 'connect-wallet', 'upload-aadhar', 'create-passkey', 'register-did', 'complete'].indexOf(state.step) + 1} of 6
          </p>
        </div>

        {/* Error Display */}
        {state.error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            <p className="font-bold">Error</p>
            <p className="text-sm">{state.error}</p>
          </div>
        )}

        {/* Current Step Content */}
        {renderStep()}
      </div>
    </div>
  );
}
