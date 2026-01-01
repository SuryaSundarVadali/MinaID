'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import GradientBG from './GradientBG';

export default function UploadDocumentChoice() {
  const router = useRouter();

  return (
    <GradientBG>
      <main className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-5xl font-bold text-white mb-4">
              📋 Upload Identity Document
            </h1>
            <p className="text-xl text-gray-300">
              Choose your identity document type to begin verification
            </p>
          </div>

          {/* Document Type Selection Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Aadhar Card */}
            <button
              onClick={() => router.push('/upload-aadhar')}
              className="group bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border-2 border-gray-700 hover:border-indigo-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-indigo-500/20"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-5xl">📄</span>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-indigo-400 transition-colors">
                  Aadhar Card
                </h2>
                
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Upload your Aadhar card for identity verification. 
                  Supports XML file upload with secure parsing.
                </p>
                
                <div className="space-y-2 text-sm text-left w-full bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>XML file format supported</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Secure local processing</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Zero-knowledge proof generation</span>
                  </div>
                </div>

                <div className="mt-6 px-6 py-3 bg-indigo-600 group-hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                  <span>Select Aadhar</span>
                  <span>→</span>
                </div>
              </div>
            </button>

            {/* Passport Card */}
            <button
              onClick={() => router.push('/upload-passport')}
              className="group bg-gray-800/50 backdrop-blur-md rounded-2xl p-8 border-2 border-gray-700 hover:border-purple-500 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-purple-500/20"
            >
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-5xl">🛂</span>
                </div>
                
                <h2 className="text-2xl font-bold text-white mb-3 group-hover:text-purple-400 transition-colors">
                  Passport
                </h2>
                
                <p className="text-gray-400 mb-6 leading-relaxed">
                  Scan your physical passport with video verification. 
                  Includes advanced hologram authentication.
                </p>
                
                <div className="space-y-2 text-sm text-left w-full bg-gray-900/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Video-based scanning</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>Hologram verification (CV)</span>
                  </div>
                  <div className="flex items-center gap-2 text-green-400">
                    <span>✓</span>
                    <span>MRZ data extraction</span>
                  </div>
                </div>

                <div className="mt-6 px-6 py-3 bg-purple-600 group-hover:bg-purple-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2">
                  <span>Select Passport</span>
                  <span>→</span>
                </div>
              </div>
            </button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 backdrop-blur-sm border border-blue-500/30 rounded-xl p-6 text-center">
            <div className="flex items-start gap-4">
              <span className="text-3xl">ℹ️</span>
              <div className="text-left">
                <h3 className="text-lg font-semibold text-blue-300 mb-2">
                  Which document should I choose?
                </h3>
                <p className="text-gray-300 text-sm leading-relaxed">
                  <strong>Choose Aadhar</strong> if you have your Aadhar XML file downloaded. 
                  This is typically obtained from the UIDAI website or mAadhar app.
                </p>
                <p className="text-gray-300 text-sm leading-relaxed mt-2">
                  <strong>Choose Passport</strong> if you have your physical passport and want to verify it using 
                  your device's camera. The system will scan and authenticate your passport's hologram.
                </p>
              </div>
            </div>
          </div>

          {/* Back to Dashboard */}
          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-gray-400 hover:text-white transition-colors text-lg"
            >
              ← Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    </GradientBG>
  );
}
