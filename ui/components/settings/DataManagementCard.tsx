/**
 * DataManagementCard.tsx
 * 
 * Data export and privacy management
 */

'use client';

import React, { useState } from 'react';
import type { WalletSession } from '../../context/WalletContext';
import { ProofStorage } from '../../lib/ProofStorage';

interface DataManagementCardProps {
  session: WalletSession;
}

export function DataManagementCard({ session }: DataManagementCardProps) {
  const [isExporting, setIsExporting] = useState(false);

  const handleExportData = async () => {
    setIsExporting(true);
    try {
      // Collect all user data
      const userData = {
        did: session.did,
        passkeyId: session.passkeyId,
        credentials: JSON.parse(localStorage.getItem('minaid_aadhar_data') || 'null'),
        proofs: ProofStorage.getProofs(),
        verificationHistory: JSON.parse(localStorage.getItem('minaid_verification_history') || '[]'),
        proofRequests: JSON.parse(localStorage.getItem('minaid_proof_requests') || '[]'),
        exportDate: new Date().toISOString(),
      };

      // Create downloadable file
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `minaid-data-export-${Date.now()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert('Data exported successfully!');
    } catch (error) {
      console.error('[DataManagement] Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  const getStorageUsage = () => {
    let totalSize = 0;
    const items: { key: string; size: number }[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('minaid_')) {
        const value = localStorage.getItem(key) || '';
        const size = new Blob([value]).size;
        totalSize += size;
        items.push({ key, size });
      }
    }

    return { totalSize, items };
  };

  const storage = getStorageUsage();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Data Management</h2>

      {/* Storage Overview */}
      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
          <span className="mr-2">💾</span>
          Local Storage Usage
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Total Data Size</span>
            <span className="font-mono text-indigo-600 font-medium">
              {formatBytes(storage.totalSize)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-700">Number of Items</span>
            <span className="font-mono text-indigo-600 font-medium">
              {storage.items.length}
            </span>
          </div>
        </div>
      </div>

      {/* Data Breakdown */}
      <div className="mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">Stored Data</h3>
        <div className="space-y-2">
          {storage.items.map((item) => (
            <div key={item.key} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="flex items-center space-x-3">
                <span className="text-2xl">
                  {item.key.includes('aadhar') ? '📄' : 
                   item.key.includes('proof') ? '🔐' : 
                   item.key.includes('verification') ? '✓' : '📦'}
                </span>
                <div>
                  <p className="font-medium text-gray-900 text-sm">
                    {item.key.replace('minaid_', '').replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </p>
                  <p className="text-xs text-gray-500">{formatBytes(item.size)}</p>
                </div>
              </div>
            </div>
          ))}
          {storage.items.length === 0 && (
            <p className="text-center text-gray-500 py-4">No data stored yet</p>
          )}
        </div>
      </div>

      {/* Export Action */}
      <div className="mb-6">
        <button
          onClick={handleExportData}
          disabled={isExporting}
          className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          {isExporting ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Exporting...
            </>
          ) : (
            <>
              <span className="mr-2">📥</span>
              Export All Data (JSON)
            </>
          )}
        </button>
      </div>

      {/* GDPR Info */}
      <div className="p-4 bg-green-50 rounded-lg border border-green-200">
        <h4 className="font-semibold text-gray-900 mb-2">📋 Your Data Rights (GDPR)</h4>
        <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
          <li>Right to access your data (export above)</li>
          <li>Right to data portability (JSON format)</li>
          <li>Right to erasure (delete account in Danger Zone)</li>
          <li>All data is stored locally on your device</li>
        </ul>
      </div>
    </div>
  );
}
