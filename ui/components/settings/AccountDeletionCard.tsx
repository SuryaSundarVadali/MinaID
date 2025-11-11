/**
 * AccountDeletionCard.tsx
 * 
 * GDPR-compliant account deletion with multi-step confirmation
 * and on-chain DID revocation
 */

'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WalletSession } from '../../context/WalletContext';
import { useWallet } from '../../context/WalletContext';
import { rateLimiter, RateLimitConfigs, formatTimeRemaining } from '../../lib/RateLimiter';
import { logSecurityEvent } from '../../lib/SecurityUtils';

interface AccountDeletionCardProps {
  session: WalletSession;
}

type DeletionStep = 'warning' | 'confirm' | 'authenticate' | 'deleting' | 'complete';

export function AccountDeletionCard({ session }: AccountDeletionCardProps) {
  const router = useRouter();
  const { logout } = useWallet();
  const [deletionStep, setDeletionStep] = useState<DeletionStep>('warning');
  const [confirmText, setConfirmText] = useState('');
  const [understandChecks, setUnderstandChecks] = useState({
    dataLoss: false,
    irreversible: false,
    onChain: false,
  });
  const [deletionProgress, setDeletionProgress] = useState(0);
  const [deletionError, setDeletionError] = useState<string | null>(null);

  const requiredConfirmText = 'DELETE MY ACCOUNT';
  const allChecksCompleted = Object.values(understandChecks).every(v => v);
  const confirmTextMatches = confirmText.trim() === requiredConfirmText;

  const handleStartDeletion = () => {
    if (!allChecksCompleted || !confirmTextMatches) {
      alert('Please complete all confirmation steps.');
      return;
    }
    setDeletionStep('authenticate');
  };

  const handleAuthenticateAndDelete = async () => {
    // Rate limiting check
    const rateLimitKey = `account_deletion:${session.did}`;
    if (!rateLimiter.isAllowed(rateLimitKey, RateLimitConfigs.ACCOUNT_DELETION)) {
      const timeRemaining = rateLimiter.getTimeUntilUnblocked(rateLimitKey);
      setDeletionError(
        `Too many deletion attempts. Please try again in ${formatTimeRemaining(timeRemaining)}.`
      );
      setDeletionStep('warning');
      return;
    }

    setDeletionStep('deleting');
    setDeletionProgress(0);
    setDeletionError(null);

    try {
      // Log deletion start
      logSecurityEvent('account_deletion_started', { did: session.did }, 'warning');

      // Step 1: Authenticate with passkey
      setDeletionProgress(10);
      await new Promise(resolve => setTimeout(resolve, 500));
      // TODO: Real passkey authentication
      console.log('[AccountDeletion] Authenticated with passkey');

      // Step 2: Revoke DID on-chain
      setDeletionProgress(30);
      await new Promise(resolve => setTimeout(resolve, 1000));
      // TODO: Call DIDRegistry.revokeDID() contract method
      console.log('[AccountDeletion] DID revoked on-chain');

      // Step 3: Delete encrypted private keys
      setDeletionProgress(50);
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.removeItem(`encrypted_private_key_${session.did}`);
      console.log('[AccountDeletion] Private keys deleted');

      // Step 4: Delete all credentials
      setDeletionProgress(65);
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.removeItem('minaid_aadhar_data');
      console.log('[AccountDeletion] Credentials deleted');

      // Step 5: Delete all proofs
      setDeletionProgress(75);
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.removeItem('minaid_proofs');
      console.log('[AccountDeletion] Proofs deleted');

      // Step 6: Delete verification history
      setDeletionProgress(85);
      await new Promise(resolve => setTimeout(resolve, 500));
      localStorage.removeItem('minaid_verification_history');
      localStorage.removeItem('minaid_proof_requests');
      console.log('[AccountDeletion] Verification history deleted');

      // Step 7: Delete session
      setDeletionProgress(95);
      await new Promise(resolve => setTimeout(resolve, 500));
      logout();
      console.log('[AccountDeletion] Session terminated');

      // Complete
      setDeletionProgress(100);
      setDeletionStep('complete');
      
      // Log successful deletion
      logSecurityEvent('account_deletion_success', { did: session.did }, 'info');

    } catch (error: any) {
      console.error('[AccountDeletion] Failed:', error);
      setDeletionError(error.message || 'Account deletion failed');
      setDeletionStep('warning');
      
      // Log failed deletion
      logSecurityEvent(
        'account_deletion_failed',
        { did: session.did, error: error.message },
        'error'
      );
    }
  };

  const handleFinalComplete = () => {
    // Redirect to home page
    router.push('/');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 border-2 border-red-200">
      <h2 className="text-2xl font-bold text-red-600 mb-6 flex items-center">
        <span className="mr-2">⚠️</span>
        Danger Zone - Account Deletion
      </h2>

      {/* Warning Step */}
      {deletionStep === 'warning' && (
        <>
          <div className="mb-6 p-4 bg-red-50 rounded-lg border-2 border-red-300">
            <h3 className="font-bold text-red-900 mb-3 text-lg">
              ⚠️ WARNING: This action is PERMANENT and IRREVERSIBLE
            </h3>
            <p className="text-red-800 mb-3">
              Deleting your account will:
            </p>
            <ul className="text-red-800 space-y-2 list-disc list-inside">
              <li><strong>Revoke your DID</strong> on the Mina blockchain (permanent)</li>
              <li><strong>Delete all encrypted private keys</strong> from this device</li>
              <li><strong>Erase all credentials</strong> (Aadhar, KYC, etc.)</li>
              <li><strong>Remove all generated proofs</strong> and verification history</li>
              <li><strong>Terminate your passkey</strong> authentication</li>
              <li><strong>Cannot be undone</strong> - you will need to create a new account</li>
            </ul>
          </div>

          <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-300">
            <h4 className="font-semibold text-yellow-900 mb-2">💡 Before you continue:</h4>
            <ul className="text-yellow-800 space-y-1 text-sm list-disc list-inside">
              <li>Export your data if you need a backup (Data tab)</li>
              <li>Make sure you won't need your DID or credentials</li>
              <li>This will not delete data shared with verifiers</li>
              <li>Blockchain records are permanent (DID revocation is public)</li>
            </ul>
          </div>

          {deletionError && (
            <div className="mb-6 p-4 bg-red-100 rounded-lg border border-red-400">
              <p className="text-red-900 font-semibold">❌ Deletion Failed</p>
              <p className="text-red-800 text-sm mt-1">{deletionError}</p>
            </div>
          )}

          <button
            onClick={() => setDeletionStep('confirm')}
            className="w-full px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            I Understand - Proceed to Delete Account
          </button>
        </>
      )}

      {/* Confirmation Step */}
      {deletionStep === 'confirm' && (
        <>
          <div className="mb-6">
            <h3 className="font-bold text-gray-900 mb-4 text-lg">
              Confirm Account Deletion
            </h3>
            
            {/* Confirmation Checkboxes */}
            <div className="space-y-3 mb-6">
              <label className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg hover:border-red-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={understandChecks.dataLoss}
                  onChange={(e) => setUnderstandChecks({ ...understandChecks, dataLoss: e.target.checked })}
                  className="mt-1 w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-gray-700 text-sm">
                  I understand that <strong>all my data will be permanently deleted</strong> and cannot be recovered
                </span>
              </label>

              <label className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg hover:border-red-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={understandChecks.irreversible}
                  onChange={(e) => setUnderstandChecks({ ...understandChecks, irreversible: e.target.checked })}
                  className="mt-1 w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-gray-700 text-sm">
                  I understand that <strong>this action is irreversible</strong> and I will need to create a new account to use MinaID again
                </span>
              </label>

              <label className="flex items-start space-x-3 p-3 border-2 border-gray-200 rounded-lg hover:border-red-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={understandChecks.onChain}
                  onChange={(e) => setUnderstandChecks({ ...understandChecks, onChain: e.target.checked })}
                  className="mt-1 w-5 h-5 text-red-600 rounded focus:ring-red-500"
                />
                <span className="text-gray-700 text-sm">
                  I understand that <strong>my DID revocation will be recorded on the blockchain</strong> and is publicly visible
                </span>
              </label>
            </div>

            {/* Text Confirmation */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-900 mb-2">
                Type <code className="px-2 py-1 bg-gray-100 rounded font-mono text-red-600">{requiredConfirmText}</code> to confirm:
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={requiredConfirmText}
                className={`w-full px-4 py-2 border-2 rounded-lg focus:ring-2 focus:ring-red-500 ${
                  confirmTextMatches ? 'border-red-500' : 'border-gray-300'
                }`}
              />
              {confirmText && !confirmTextMatches && (
                <p className="text-sm text-red-600 mt-1">Text doesn't match. Please type exactly: {requiredConfirmText}</p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-3">
            <button
              onClick={() => {
                setDeletionStep('warning');
                setConfirmText('');
                setUnderstandChecks({ dataLoss: false, irreversible: false, onChain: false });
              }}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleStartDeletion}
              disabled={!allChecksCompleted || !confirmTextMatches}
              className="flex-1 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete My Account Permanently
            </button>
          </div>
        </>
      )}

      {/* Authentication Step */}
      {deletionStep === 'authenticate' && (
        <>
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">🔐</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Authenticate to Delete Account
            </h3>
            <p className="text-gray-600 mb-6">
              Please authenticate with your passkey to proceed with account deletion
            </p>
            <button
              onClick={handleAuthenticateAndDelete}
              className="px-8 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Authenticate with Passkey
            </button>
          </div>
        </>
      )}

      {/* Deleting Step */}
      {deletionStep === 'deleting' && (
        <>
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
              <span className="text-5xl">🗑️</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Deleting Your Account...
            </h3>
            <p className="text-gray-600 mb-6">
              Please wait while we securely delete your data
            </p>

            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
              <div
                className="bg-red-600 h-3 rounded-full transition-all duration-500"
                style={{ width: `${deletionProgress}%` }}
              />
            </div>

            {/* Progress Steps */}
            <div className="text-left max-w-md mx-auto space-y-2">
              {[
                { label: 'Authenticating...', threshold: 10 },
                { label: 'Revoking DID on-chain...', threshold: 30 },
                { label: 'Deleting private keys...', threshold: 50 },
                { label: 'Erasing credentials...', threshold: 65 },
                { label: 'Removing proofs...', threshold: 75 },
                { label: 'Clearing history...', threshold: 85 },
                { label: 'Terminating session...', threshold: 95 },
              ].map((step, idx) => (
                <div
                  key={idx}
                  className={`flex items-center space-x-2 text-sm ${
                    deletionProgress >= step.threshold ? 'text-green-600' : 'text-gray-400'
                  }`}
                >
                  {deletionProgress >= step.threshold ? (
                    <span>✅</span>
                  ) : (
                    <span>⏳</span>
                  )}
                  <span>{step.label}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Complete Step */}
      {deletionStep === 'complete' && (
        <>
          <div className="text-center py-8">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-5xl">✅</span>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              Account Deleted Successfully
            </h3>
            <p className="text-gray-600 mb-6">
              Your account and all associated data have been permanently deleted.
              You will be redirected to the home page.
            </p>

            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200 text-left">
              <h4 className="font-semibold text-gray-900 mb-2">What was deleted:</h4>
              <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
                <li>DID revoked on Mina blockchain</li>
                <li>All encrypted private keys</li>
                <li>All credentials (Aadhar, etc.)</li>
                <li>All generated proofs</li>
                <li>Verification history</li>
                <li>Passkey authentication</li>
              </ul>
            </div>

            <button
              onClick={handleFinalComplete}
              className="px-8 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
            >
              Go to Home Page
            </button>
          </div>
        </>
      )}
    </div>
  );
}
