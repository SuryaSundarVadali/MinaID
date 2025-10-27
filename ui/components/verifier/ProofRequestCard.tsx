/**
 * ProofRequestCard.tsx
 * 
 * Card for creating proof requests and generating QR codes
 */

'use client';

import React, { useState } from 'react';
import QRCode from 'qrcode';

type ProofType = 'age' | 'kyc' | 'composite';

interface ProofRequestConfig {
  type: ProofType;
  minimumAge?: number;
  kycAttributes?: string[];
  expiresIn?: number; // minutes
}

export function ProofRequestCard() {
  const [config, setConfig] = useState<ProofRequestConfig>({
    type: 'age',
    minimumAge: 18,
    expiresIn: 60,
  });
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [requestUrl, setRequestUrl] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateRequest = async () => {
    setIsGenerating(true);
    try {
      // Generate unique request ID
      const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Create request payload
      const request = {
        id: requestId,
        ...config,
        createdAt: Date.now(),
        verifierDID: 'did:mina:verifier_' + Math.random().toString(36).substr(2, 9), // TODO: Use actual verifier DID
      };

      // Save to localStorage
      const requests = JSON.parse(localStorage.getItem('minaid_proof_requests') || '[]');
      requests.push(request);
      localStorage.setItem('minaid_proof_requests', JSON.stringify(requests));

      // Generate shareable URL
      const baseUrl = window.location.origin;
      const requestUrlStr = `${baseUrl}/respond?request=${btoa(JSON.stringify(request))}`;
      setRequestUrl(requestUrlStr);

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(requestUrlStr, {
        width: 300,
        margin: 2,
        color: {
          dark: '#4F46E5',
          light: '#FFFFFF',
        },
      });
      setQrCode(qrCodeDataUrl);

      console.log('[ProofRequest] Generated:', request);
    } catch (error) {
      console.error('[ProofRequest] Failed to generate:', error);
      alert('Failed to generate proof request. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyUrl = () => {
    if (requestUrl) {
      navigator.clipboard.writeText(requestUrl);
      alert('Request URL copied to clipboard!');
    }
  };

  const handleReset = () => {
    setQrCode(null);
    setRequestUrl(null);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Create Proof Request</h2>

      {!qrCode ? (
        <>
          {/* Proof Type Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Proof Type
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                { type: 'age' as ProofType, icon: '🎂', label: 'Age Verification' },
                { type: 'kyc' as ProofType, icon: '✅', label: 'KYC Status' },
                { type: 'composite' as ProofType, icon: '🔗', label: 'Composite' },
              ].map((option) => (
                <button
                  key={option.type}
                  onClick={() => setConfig({ ...config, type: option.type })}
                  className={`p-4 rounded-lg border-2 transition-all ${
                    config.type === option.type
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{option.icon}</div>
                  <div className="font-medium text-gray-900">{option.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Age Configuration */}
          {config.type === 'age' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Minimum Age Required
              </label>
              <div className="flex space-x-2 mb-3">
                {[18, 21, 25, 30].map((age) => (
                  <button
                    key={age}
                    onClick={() => setConfig({ ...config, minimumAge: age })}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      config.minimumAge === age
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {age}+
                  </button>
                ))}
              </div>
              <input
                type="number"
                value={config.minimumAge || 18}
                onChange={(e) => setConfig({ ...config, minimumAge: parseInt(e.target.value) })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Custom age"
              />
            </div>
          )}

          {/* KYC Configuration */}
          {config.type === 'kyc' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Required KYC Attributes
              </label>
              {['Identity Verified', 'Address Verified', 'Phone Verified', 'Email Verified'].map((attr) => (
                <label key={attr} className="flex items-center space-x-2 mb-2">
                  <input
                    type="checkbox"
                    checked={config.kycAttributes?.includes(attr)}
                    onChange={(e) => {
                      const attrs = config.kycAttributes || [];
                      if (e.target.checked) {
                        setConfig({ ...config, kycAttributes: [...attrs, attr] });
                      } else {
                        setConfig({ ...config, kycAttributes: attrs.filter(a => a !== attr) });
                      }
                    }}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                  />
                  <span className="text-gray-700">{attr}</span>
                </label>
              ))}
            </div>
          )}

          {/* Expiration */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Request Expires In (minutes)
            </label>
            <select
              value={config.expiresIn}
              onChange={(e) => setConfig({ ...config, expiresIn: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>1 hour</option>
              <option value={180}>3 hours</option>
              <option value={1440}>24 hours</option>
            </select>
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerateRequest}
            disabled={isGenerating}
            className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? 'Generating...' : 'Generate Proof Request'}
          </button>
        </>
      ) : (
        <>
          {/* QR Code Display */}
          <div className="text-center">
            <div className="inline-block p-4 bg-white border-4 border-indigo-600 rounded-xl mb-4">
              <img src={qrCode} alt="Proof Request QR Code" className="w-64 h-64" />
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-green-800 font-medium mb-2">
                ✅ Proof Request Created Successfully!
              </p>
              <p className="text-xs text-green-600">
                Share this QR code with the user to request their proof
              </p>
            </div>

            {/* Request URL */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Shareable Link
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={requestUrl || ''}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={handleCopyUrl}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Request Details */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-left">
              <h4 className="font-semibold text-gray-900 mb-2">Request Details</h4>
              <div className="space-y-1 text-sm text-gray-700">
                <p><strong>Type:</strong> {config.type}</p>
                {config.minimumAge && <p><strong>Minimum Age:</strong> {config.minimumAge}+</p>}
                {config.kycAttributes && config.kycAttributes.length > 0 && (
                  <p><strong>KYC Attributes:</strong> {config.kycAttributes.join(', ')}</p>
                )}
                <p><strong>Expires In:</strong> {config.expiresIn} minutes</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex space-x-3">
              <button
                onClick={handleReset}
                className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              >
                Create Another
              </button>
              <button
                onClick={() => window.print()}
                className="flex-1 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
              >
                Print QR Code
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
