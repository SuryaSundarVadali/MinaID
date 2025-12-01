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
import { enforceOnePasskeyPerWallet, countPasskeys } from '../lib/DataManagement';
import GradientBG from './GradientBG';
import LoadingSpinner from './LoadingSpinner';
import styles from '../styles/Home.module.css';

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
  loadingMessage?: string;
}

interface SignupOrchestratorProps {
  onSuccess?: () => void;
}

export function SignupOrchestrator({ onSuccess }: SignupOrchestratorProps = {}) {
  const { connectAuroWallet, connectMetamask, storePrivateKey, loadPrivateKey } = useWallet();
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
    setState(prev => ({ ...prev, loading: true, error: undefined, loadingMessage: 'Connecting to Auro Wallet...' }));

    try {
      const walletInfo = await connectAuroWallet();
      
      setState(prev => ({ ...prev, loadingMessage: 'Generating Mina key pair...' }));
      
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
        loadingMessage: undefined,
        step: 'upload-aadhar',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        loadingMessage: undefined,
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

    setState(prev => ({ ...prev, loading: true, error: undefined, loadingMessage: 'Parsing Aadhar XML...' }));

    try {
      const result = await parseAadharXML(selectedFile);
      
      if (!result.isValid || !result.data) {
        throw new Error(result.error || 'Invalid Aadhar XML');
      }

      setState(prev => ({
        ...prev,
        aadharData: result.data,
        loading: false,
        loadingMessage: undefined,
        step: 'create-passkey',
      }));
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        loadingMessage: undefined,
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

    setState(prev => ({ ...prev, loading: true, error: undefined, loadingMessage: 'Preparing passkey creation...' }));

    try {
      console.log('[Signup] Step 1: Checking existing passkeys...');
      setState(prev => ({ ...prev, loadingMessage: 'Checking existing passkeys...' }));
      
      // ENFORCE: Check if wallet already has a passkey
      const existingPasskeys = countPasskeys(state.did);
      if (existingPasskeys > 0) {
        console.log(`[Signup] Wallet already has ${existingPasskeys} passkey(s). Enforcing one-passkey-per-wallet...`);
        enforceOnePasskeyPerWallet(state.did);
      }

      console.log('[Signup] Step 2: Creating new passkey...');
      setState(prev => ({ ...prev, loadingMessage: 'Waiting for biometric authentication...' }));
      
      // Create Passkey with biometric authentication
      const passkey = await createPasskey(
        state.did,
        `MinaID - ${state.aadharData?.name || 'User'}`
      );

      console.log('[Signup] ✓ Passkey created:', passkey.id);

      console.log('[Signup] Step 3: Enforcing one-passkey-per-wallet...');
      setState(prev => ({ ...prev, loadingMessage: 'Enforcing passkey policy...' }));
      
      // ENFORCE: Remove any duplicate passkeys created during this session
      enforceOnePasskeyPerWallet(state.did);

      // Verify only one passkey exists
      const finalCount = countPasskeys(state.did);
      console.log(`[Signup] Final passkey count: ${finalCount}`);
      
      if (finalCount !== 1) {
        throw new Error(`Passkey enforcement failed. Expected 1, found ${finalCount}`);
      }

      console.log('[Signup] Step 4: Storing encrypted private key...');
      setState(prev => ({ ...prev, loadingMessage: 'Encrypting and storing private key...' }));
      
      // Encrypt and store private key with Passkey (pass DID since no session exists during signup)
      await storePrivateKey('auro', minaPrivateKey.toBase58(), passkey.id, state.did);

      // Clear plaintext private key from memory
      setMinaPrivateKey(null);

      console.log('[Signup] ✓ Private key encrypted and stored');
      console.log('[Signup] ✓ One-passkey-per-wallet policy enforced');

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

    setState(prev => ({ ...prev, loading: true, error: undefined, loadingMessage: 'Preparing DID registration...' }));

    try {
      setState(prev => ({ ...prev, loadingMessage: 'Creating DID document...' }));
      
      // Create DID document hash
      const didDocument = {
        did: state.did,
        name: state.aadharData.name,
        verifiedBy: 'UIDAI',
        verifiedAt: state.aadharData.verifiedAt,
      };

      const documentHash = await sha256Hash(JSON.stringify(didDocument));
      
      setState(prev => ({ ...prev, loadingMessage: 'Processing cryptographic hashes...' }));
      
      // Convert base64 hash to hex using browser-compatible method
      // sha256Hash returns base64, decode it to bytes then convert to hex
      const { base64ToBytes } = await import('../lib/SecurityUtils');
      const hashBytes = base64ToBytes(documentHash);
      const hashHex = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
      const documentHashField = Field.from(BigInt('0x' + hashHex));

      setState(prev => ({ ...prev, loadingMessage: 'Initializing blockchain connection...' }));
      
      // Initialize contract interface
      const networkConfig = createNetworkConfig(
        (process.env.NEXT_PUBLIC_NETWORK as any) || 'berkeley'
      );
      const contractInterface = new ContractInterface(networkConfig);
      await contractInterface.initialize();

      // Import the global Merkle map handler to maintain consistent state
      const { default: BlockchainHelpers } = await import('../lib/BlockchainHelpers');
      
      // Create Merkle witness for DID using persistent state
      // Note: For initial implementation, we need to sync with on-chain state
      const { MerkleMap: LocalMerkleMap } = await import('o1js');
      
      // Get MerkleMap key for this DID
      const didKey = Poseidon.hash(PublicKey.fromBase58(state.did).toFields());
      
      // Create a fresh MerkleMap for witness generation
      // TODO: In production, this should sync with on-chain state
      const merkleMap = new LocalMerkleMap();
      const witness = merkleMap.getWitness(didKey);

      // Load actual private key using Passkey authentication
      if (!state.passkeyId) {
        throw new Error('Passkey ID not found. Please complete Step 4 first.');
      }

      console.log('Loading private key with Passkey...');
      const privateKeyBase58 = await loadPrivateKey('auro', state.passkeyId, state.did);
      
      if (!privateKeyBase58) {
        throw new Error('Failed to load private key. Please try Step 4 again.');
      }

      const actualPrivateKey = PrivateKey.fromBase58(privateKeyBase58);
      console.log('Private key loaded successfully');

      // Register DID on-chain
      const result = await contractInterface.registerDID(
        PublicKey.fromBase58(state.did),
        documentHashField,
        actualPrivateKey,
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
          <div className={styles.center}>
            <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
              Welcome to MinaID
            </h1>
            <p className={styles.tagline} style={{ marginBottom: '2rem' }}>
              CREATE YOUR DECENTRALIZED IDENTITY WITH BIOMETRIC SECURITY
            </p>
            <button
              onClick={() => setState(prev => ({ ...prev, step: 'connect-wallet' }))}
              className={styles.card}
              style={{ margin: '2rem auto' }}
            >
              <h2>
                <span>Get Started</span>
                <span>→</span>
              </h2>
              <p>Begin your journey to sovereign digital identity</p>
            </button>
          </div>
        );

      case 'connect-wallet':
        return (
          <div>
            <div className={styles.center}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Step 1: Connect Your Wallet
              </h2>
              <p style={{ marginBottom: '2rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Choose a wallet to create your MinaID
              </p>
            </div>
            
            <div className={styles.grid}>
              <button
                onClick={handleConnectAuro}
                disabled={state.loading}
                className={styles.card}
              >
                <h2>
                  <span>Auro Wallet</span>
                  <span>→</span>
                </h2>
                <p>Mina Protocol Native</p>
              </button>

              <button
                onClick={handleConnectMetamask}
                disabled={state.loading}
                className={styles.card}
              >
                <h2>
                  <span>Metamask</span>
                  <span>→</span>
                </h2>
                <p>Ethereum & EVM Chains</p>
              </button>
            </div>
          </div>
        );

      case 'upload-aadhar':
        return (
          <div>
            <div className={styles.center}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Step 2: Upload Aadhar XML
              </h2>
              <p style={{ marginBottom: '2rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Upload your eAadhaar XML file for KYC verification
              </p>
            </div>

            <div className={styles.stateContainer}>
              <div className={styles.state} style={{ maxWidth: '600px', margin: '0 auto' }}>
                <input
                  type="file"
                  accept=".xml"
                  onChange={handleFileSelect}
                  className="hidden"
                  id="aadhar-upload"
                  style={{ display: 'none' }}
                />
                <label
                  htmlFor="aadhar-upload"
                  style={{ cursor: 'pointer' }}
                >
                  <button
                    type="button"
                    style={{ 
                      width: '100%',
                      whiteSpace: 'normal',
                      wordWrap: 'break-word',
                      padding: '0.75rem',
                      lineHeight: '1.4'
                    }}
                  >
                    {selectedFile ? selectedFile.name : 'Choose Aadhar XML File'}
                  </button>
                </label>
                
                <p style={{ 
                  marginTop: '1rem', 
                  fontSize: '0.875rem',
                  lineHeight: '1.4',
                  textAlign: 'center'
                }}>
                  🔒 Your Aadhar data stays on your device.<br />
                  We never send it to any server.
                </p>

                {selectedFile && (
                  <button
                    onClick={handleParseAadhar}
                    disabled={state.loading}
                    style={{ marginTop: '1rem', width: '100%' }}
                  >
                    {state.loading ? 'Parsing...' : 'Continue'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );

      case 'create-passkey':
        return (
          <div>
            <div className={styles.center}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Step 3: Create Biometric Passkey
              </h2>
              <p style={{ marginBottom: '2rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Secure your identity with Face ID, Touch ID, or fingerprint
              </p>
            </div>

            <div className={styles.stateContainer}>
              <div className={styles.state} style={{ maxWidth: '600px', margin: '0 auto' }}>
                <h3 className={styles.bold} style={{ marginBottom: '0.75rem' }}>🔐 Why Passkeys?</h3>
                <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                  ✓ Your private key is encrypted with your biometric
                </p>
                <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', lineHeight: '1.4' }}>
                  ✓ Only you can generate proofs - credential sharing impossible
                </p>
                <p style={{ fontSize: '0.875rem', marginBottom: '1rem', lineHeight: '1.4' }}>
                  ✓ Device-bound security - cannot be phished or stolen
                </p>
                
                {state.aadharData && (
                  <div style={{ 
                    marginTop: '1rem', 
                    padding: '0.75rem', 
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    borderRadius: '4px'
                  }}>
                    <p style={{ fontSize: '0.875rem', marginBottom: '0.25rem' }}>Creating Passkey for:</p>
                    <p className={styles.bold}>{state.aadharData.name}</p>
                  </div>
                )}

                <button
                  onClick={handleCreatePasskey}
                  disabled={state.loading || !isPasskeySupported}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  {state.loading ? 'Creating Passkey...' : 'Create Passkey'}
                </button>

                {!isPasskeySupported && (
                  <p 
                    className={styles.error} 
                    style={{ 
                      fontSize: '0.875rem', 
                      textAlign: 'center', 
                      marginTop: '1rem',
                      lineHeight: '1.4'
                    }}
                  >
                    Passkeys not supported in this browser.<br />
                    Use Chrome, Safari, or Edge.
                  </p>
                )}
              </div>
            </div>
          </div>
        );

      case 'register-did':
        return (
          <div>
            <div className={styles.center}>
              <h2 style={{ fontSize: '2rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Step 4: Register Your DID
              </h2>
              <p style={{ marginBottom: '2rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
                Register your decentralized identifier on Mina blockchain
              </p>
            </div>

            <div className={styles.stateContainer}>
              <div className={styles.state} style={{ maxWidth: '600px', margin: '0 auto' }}>
                <div style={{ marginBottom: '1rem', wordWrap: 'break-word', overflowWrap: 'break-word' }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Your DID:</p>
                  <p 
                    className={styles.code} 
                    style={{ 
                      fontSize: '0.625rem', 
                      wordBreak: 'break-all',
                      overflowWrap: 'anywhere',
                      lineHeight: '1.2',
                      padding: '0.5rem',
                      backgroundColor: 'rgba(0,0,0,0.05)',
                      borderRadius: '4px'
                    }}
                  >
                    {state.did}
                  </p>
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>Name:</p>
                  <p className={styles.bold}>{state.aadharData?.name}</p>
                </div>

                <div style={{ 
                  fontSize: '0.875rem', 
                  marginTop: '1rem', 
                  marginBottom: '1rem',
                  padding: '0.75rem',
                  backgroundColor: 'rgba(255, 193, 7, 0.1)',
                  border: '1px solid rgba(255, 193, 7, 0.3)',
                  borderRadius: '4px',
                  lineHeight: '1.4'
                }}>
                  <p style={{ margin: 0 }}>
                    ⚠️ <strong>Important:</strong> Your account needs MINA tokens to register on-chain.
                  </p>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.75rem' }}>
                    Get free testnet tokens from: <a 
                      href="https://faucet.minaprotocol.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#0066cc', textDecoration: 'underline' }}
                    >
                      faucet.minaprotocol.com
                    </a>
                  </p>
                </div>

                <button
                  onClick={handleRegisterDID}
                  disabled={state.loading}
                  style={{ marginTop: '1rem', width: '100%' }}
                >
                  {state.loading ? 'Registering...' : 'Register DID'}
                </button>
              </div>
            </div>
          </div>
        );

      case 'complete':
        return (
          <div className={styles.center}>
            <div style={{ fontSize: '5rem', marginBottom: '1rem' }}>🎉</div>
            <h2 style={{ fontSize: '2.5rem', marginBottom: '1rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
              Welcome to MinaID!
            </h2>
            <p style={{ fontSize: '1.25rem', marginBottom: '2rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
              Your decentralized identity is ready
            </p>

            <div className={styles.state} style={{ marginBottom: '2rem' }}>
              <h3 className={styles.bold}>What's Next?</h3>
              <p style={{ fontSize: '0.875rem' }}>✓ Use your Passkey to login securely</p>
              <p style={{ fontSize: '0.875rem' }}>✓ Generate zero-knowledge proofs of your credentials</p>
              <p style={{ fontSize: '0.875rem' }}>✓ Verify your identity anywhere without revealing data</p>
            </div>

            <button
              onClick={() => {
                if (onSuccess) {
                  onSuccess();
                } else {
                  window.location.href = '/dashboard';
                }
              }}
              className={styles.card}
            >
              <h2>
                <span>Go to Dashboard</span>
                <span>→</span>
              </h2>
              <p>Start using your MinaID</p>
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <GradientBG>
      <div className={styles.main}>
        {/* Progress Indicator */}
        <div style={{ width: '100%', maxWidth: '800px', marginBottom: '2rem', mixBlendMode: 'difference', filter: 'invert(0.7)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            {['welcome', 'connect-wallet', 'upload-aadhar', 'create-passkey', 'register-did', 'complete'].map((step, index) => (
              <div
                key={step}
                style={{
                  height: '8px',
                  flex: 1,
                  margin: '0 4px',
                  borderRadius: '4px',
                  backgroundColor: ['welcome', 'connect-wallet', 'upload-aadhar', 'create-passkey', 'register-did', 'complete'].indexOf(state.step) >= index
                    ? '#2d2d2d'
                    : 'rgba(255, 255, 255, 0.3)'
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: '0.75rem', textAlign: 'center', marginTop: '0.5rem' }}>
            Step {['welcome', 'connect-wallet', 'upload-aadhar', 'create-passkey', 'register-did', 'complete'].indexOf(state.step) + 1} of 6
          </p>
        </div>

        {/* Error Display */}
        {state.error && (
          <div 
            className={styles.state} 
            style={{ 
              maxWidth: '600px', 
              margin: '0 auto 2rem',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '2px solid #dc3545',
              padding: '1rem'
            }}
          >
            <p className={`${styles.bold} ${styles.error}`} style={{ marginBottom: '0.5rem' }}>
              Error
            </p>
            <p style={{ 
              fontSize: '0.875rem', 
              wordWrap: 'break-word', 
              overflowWrap: 'break-word',
              lineHeight: '1.4'
            }}>
              {state.error}
            </p>
          </div>
        )}

        {/* Loading Indicator */}
        {state.loading && (
          <div
            style={{
              maxWidth: '600px',
              margin: '0 auto 2rem',
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              border: '2px solid #8B5CF6',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center'
            }}
          >
            <LoadingSpinner size="large" message={state.loadingMessage || 'Processing...'} />
          </div>
        )}

        {/* Current Step Content */}
        <div style={{ width: '100%', maxWidth: '800px' }}>
          {renderStep()}
        </div>
      </div>
    </GradientBG>
  );
}
