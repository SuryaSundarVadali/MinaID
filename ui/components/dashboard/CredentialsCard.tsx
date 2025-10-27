/**
 * CredentialsCard.tsx
 * 
 * Display and manage user credentials
 */

'use client';

import React from 'react';

interface Credential {
  id: string;
  type: 'age' | 'kyc' | 'address' | 'identity';
  issuer: string;
  issuedAt: number;
  expiresAt?: number;
  status: 'active' | 'revoked' | 'expired';
  attributes: Record<string, any>;
}

interface CredentialsCardProps {
  credentials?: Credential[];
}

export function CredentialsCard({ credentials = [] }: CredentialsCardProps) {
  const getCredentialIcon = (type: string) => {
    const icons = {
      age: '🎂',
      kyc: '✅',
      address: '📍',
      identity: '👤',
    };
    return icons[type as keyof typeof icons] || '📄';
  };

  const getStatusBadge = (status: Credential['status']) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      revoked: 'bg-red-100 text-red-700',
      expired: 'bg-gray-100 text-gray-700',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  // Mock credential if none exist
  const displayCredentials = credentials.length > 0 ? credentials : [
    {
      id: 'aadhar-age-credential',
      type: 'age' as const,
      issuer: 'UIDAI (Aadhaar)',
      issuedAt: Date.now() - 86400000 * 7, // 7 days ago
      status: 'active' as const,
      attributes: {
        minimumAge: 18,
        verified: true,
      },
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Credentials</h2>
        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
          + Add Credential
        </button>
      </div>

      {displayCredentials.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📄</div>
          <p className="text-gray-500 mb-4">No credentials yet</p>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium">
            Upload Your First Credential
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {displayCredentials.map(credential => (
            <div
              key={credential.id}
              className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  <div className="text-3xl">{getCredentialIcon(credential.type)}</div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <h3 className="font-bold text-gray-900 capitalize">
                        {credential.type} Credential
                      </h3>
                      {getStatusBadge(credential.status)}
                    </div>
                    
                    <div className="space-y-1 text-sm">
                      <p className="text-gray-600">
                        <span className="font-medium">Issuer:</span> {credential.issuer}
                      </p>
                      <p className="text-gray-600">
                        <span className="font-medium">Issued:</span>{' '}
                        {new Date(credential.issuedAt).toLocaleDateString()}
                      </p>
                      {credential.expiresAt && (
                        <p className="text-gray-600">
                          <span className="font-medium">Expires:</span>{' '}
                          {new Date(credential.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {/* Attributes */}
                    {Object.keys(credential.attributes).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {Object.entries(credential.attributes).map(([key, value]) => (
                          <span
                            key={key}
                            className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
                          >
                            {key}: {String(value)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col space-y-2 ml-4">
                  <button className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded hover:bg-indigo-200 transition-colors text-xs font-medium">
                    View
                  </button>
                  <button className="px-3 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200 transition-colors text-xs font-medium">
                    Generate Proof
                  </button>
                  {credential.status === 'active' && (
                    <button className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors text-xs font-medium">
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
