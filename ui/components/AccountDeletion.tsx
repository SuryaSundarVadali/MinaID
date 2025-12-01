'use client';

import React, { useState } from 'react';
import LoadingSpinner from './LoadingSpinner';
import { ProgressIndicator } from './ProgressIndicator';
import { progressIndicator } from '../lib/ProgressIndicatorService';
import { transactionQueue } from '../lib/TransactionQueueService';
import { base64ToBytes } from '../lib/SecurityUtils';

interface AccountDeletionProps {
  walletAddress: string;
  onDeleted?: () => void;
  onCancel?: () => void;
}

export function AccountDeletion({ walletAddress, onDeleted, onCancel }: AccountDeletionProps) {
  const [step, setStep] = useState<'confirm' | 'authenticate' | 'deleting' | 'deleted' | 'error'>('confirm');
  const [error, setError] = useState<string>('');
  const [operationId, setOperationId] = useState<string>('');
  const [understandRisks, setUnderstandRisks] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  /**
   * Handle passkey authentication for deletion
   */
  const handleAuthenticate = async () => {
    try {
      setStep('authenticate');
      setError('');

      // Get stored passkey ID
      const passkeyIdKey = `minaid_passkey_id_${walletAddress}`;
      const passkeyId = localStorage.getItem(passkeyIdKey);

      if (!passkeyId) {
        throw new Error('No passkey found for this account');
      }

      // Authenticate with passkey
      const passkeyBytes = base64ToBytes(passkeyId);
      const credential = await navigator.credentials.get({
        publicKey: {
          challenge: new TextEncoder().encode('delete-account-' + Date.now()),
          allowCredentials: [{
            id: passkeyBytes.buffer as BufferSource,
            type: 'public-key'
          }],
          userVerification: 'required'
        }
      }) as any;

      if (!credential) {
        throw new Error('Authentication failed');
      }

      console.log('✓ Authenticated with passkey');
      
      // Proceed to deletion
      await handleDelete();

    } catch (err: any) {
      console.error('Authentication error:', err);
      
      if (err.name === 'NotAllowedError') {
        setError('Authentication cancelled or failed');
      } else {
        setError(err.message || 'Authentication failed');
      }
      
      setStep('error');
    }
  };

  /**
   * Handle account deletion
   */
  const handleDelete = async () => {
    try {
      setStep('deleting');

      // Create progress operation
      const opId = progressIndicator.startOperation(
        'transaction',
        'Deleting account',
        [
          'Signing revocation message',
          'Submitting DID revocation',
          'Clearing local data',
          'Finalizing deletion'
        ],
        20000 // 20 seconds estimated
      );
      
      setOperationId(opId);

      // Step 1: Sign revocation message
      progressIndicator.updateStep(opId, 'step_0', 50);
      
      const privateKeyKey = `minaid_encrypted_private_key_${walletAddress}`;
      const encryptedPrivateKey = localStorage.getItem(privateKeyKey);
      
      if (!encryptedPrivateKey) {
        throw new Error('Private key not found');
      }

      progressIndicator.completeStep(opId, 'step_0');

      // Step 2: Submit DID revocation transaction
      progressIndicator.updateStep(opId, 'step_1', 0);

      // Get passkey for decryption
      const passkeyIdKey = `minaid_passkey_id_${walletAddress}`;
      const passkeyId = localStorage.getItem(passkeyIdKey);

      if (!passkeyId) {
        throw new Error('Passkey not found');
      }

      // Queue revocation transaction
      const txId = transactionQueue.addTransaction(
        'revokeDID',
        {
          userPublicKey: walletAddress,
          signature: 'placeholder-signature' // Would be actual signature
        },
        (txId, result) => {
          if (result.success) {
            console.log('✓ DID revocation transaction successful:', result.transactionHash);
            progressIndicator.completeStep(opId, 'step_1');
            
            // Proceed to clear data
            clearAccountData(opId);
          } else {
            throw new Error(result.error || 'Transaction failed');
          }
        }
      );

      console.log('Revocation transaction queued:', txId);
      progressIndicator.updateStep(opId, 'step_1', 50);

    } catch (err: any) {
      console.error('Deletion error:', err);
      setError(err.message || 'Failed to delete account');
      setStep('error');
      
      if (operationId) {
        progressIndicator.failOperation(operationId, err.message);
      }
    }
  };

  /**
   * Clear all account data
   */
  const clearAccountData = (opId: string) => {
    try {
      progressIndicator.updateStep(opId, 'step_2', 0);

      // List of all data keys to clear
      const keysToRemove = [
        `minaid_encrypted_private_key_${walletAddress}`,
        `minaid_passkey_id_${walletAddress}`,
        `minaid_passkey_created_${walletAddress}`,
        `minaid_did_${walletAddress}`,
        `minaid_did_document_${walletAddress}`,
        `minaid_citizenship_hash_${walletAddress}`,
        `minaid_age_hash_${walletAddress}`,
        `minaid_aadhar_data_${walletAddress}`,
        `minaid_proofs_${walletAddress}`,
        `minaid_last_login_${walletAddress}`
      ];

      // Remove all keys
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });

      console.log(`✓ Cleared ${keysToRemove.length} data items`);
      progressIndicator.completeStep(opId, 'step_2');

      // Step 4: Finalize
      progressIndicator.updateStep(opId, 'step_3', 50);
      
      setTimeout(() => {
        progressIndicator.completeStep(opId, 'step_3');
        progressIndicator.completeOperation(opId);
        setStep('deleted');
        
        // Call callback after brief delay
        setTimeout(() => {
          if (onDeleted) onDeleted();
        }, 2000);
      }, 1000);

    } catch (err: any) {
      console.error('Data clearing error:', err);
      setError('Failed to clear account data');
      setStep('error');
      progressIndicator.failOperation(opId, err.message);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Confirmation Step */}
      {step === 'confirm' && (
        <div className="space-y-6">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Delete Account
            </h2>
            <p className="text-gray-600">
              This action cannot be undone
            </p>
          </div>

          {/* Warning Message */}
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 space-y-2">
            <h3 className="font-semibold text-red-900 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Warning: The following will happen
            </h3>
            <ul className="list-disc list-inside text-sm text-red-800 space-y-1">
              <li>Your DID will be permanently revoked on the blockchain</li>
              <li>All stored credentials and proofs will be deleted</li>
              <li>Your private key and passkey will be removed</li>
              <li>All verification history will be lost</li>
              <li>This action is irreversible and cannot be undone</li>
            </ul>
          </div>

          {/* Account Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-semibold text-gray-900 mb-2">Account Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Wallet:</span> {walletAddress.slice(0, 10)}...{walletAddress.slice(-8)}</p>
            </div>
          </div>

          {/* Confirmation Checkbox */}
          <div className="space-y-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={understandRisks}
                onChange={(e) => setUnderstandRisks(e.target.checked)}
                className="mt-1 w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
              />
              <span className="text-sm text-gray-700">
                I understand that this action is permanent and cannot be reversed. All my data will be permanently deleted.
              </span>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Type <span className="font-mono bg-gray-100 px-1">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type DELETE"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleAuthenticate}
              disabled={!understandRisks || confirmText !== 'DELETE'}
              className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
            >
              Delete Account
            </button>
          </div>
        </div>
      )}

      {/* Deleting Step */}
      {step === 'deleting' && operationId && (
        <div className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Deleting Account...
            </h2>
            <p className="text-gray-600">
              Please wait while we process your request
            </p>
          </div>

          <ProgressIndicator
            operationId={operationId}
            showSteps={true}
            showTimeEstimate={true}
          />

          <div className="text-center text-sm text-gray-500">
            Do not close this window
          </div>
        </div>
      )}

      {/* Deleted Step */}
      {step === 'deleted' && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Account Deleted
            </h2>
            <p className="text-gray-600">
              Your MinaID account has been permanently deleted
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            All your data has been cleared and your DID has been revoked on the blockchain
          </div>

          <button
            onClick={onDeleted}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
          >
            Return to Home
          </button>
        </div>
      )}

      {/* Error Step */}
      {step === 'error' && (
        <div className="text-center space-y-6">
          <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Deletion Failed
            </h2>
            <p className="text-red-600">
              {error}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              onClick={() => setStep('confirm')}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
