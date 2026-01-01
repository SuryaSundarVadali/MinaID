'use client';

/**
 * Passport Scanner Component
 * 
 * Allows users to scan physical passports using OCR or enter MRZ data manually
 */

import React, { useState, useRef } from 'react';
import { oracleService, PassportData } from '@/lib/OracleService';
import LoadingSpinner from './LoadingSpinner';

interface PassportScannerProps {
  onVerified: (verificationResult: any) => void;
  onError?: (error: string) => void;
}

export default function PassportScanner({ onVerified, onError }: PassportScannerProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [mrzLine1, setMrzLine1] = useState('');
  const [mrzLine2, setMrzLine2] = useState('');
  const [manualMode, setManualMode] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Hologram verification state
  const [hologramVideo, setHologramVideo] = useState<File | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  // Parse MRZ data
  const parseMRZ = (line1: string, line2: string): PassportData | null => {
    try {
      // Validate MRZ format
      if (line1.length !== 44 || line2.length !== 44) {
        throw new Error('Invalid MRZ length. Each line must be exactly 44 characters.');
      }

      // Parse passport data from MRZ
      // Line 2 format: PASSPORT_NUMBER + CHECK + NATIONALITY + DOB + CHECK + SEX + EXPIRY + CHECK + ...
      const passportNumber = line2.substring(0, 9).replace(/</g, '');
      const nationality = line2.substring(10, 13);
      const birthDate = line2.substring(13, 19); // YYMMDD
      const expiryDate = line2.substring(21, 27); // YYMMDD
      
      // Parse name from line 1 (after P< and country code)
      const nameSection = line1.substring(5).replace(/</g, ' ').trim();
      const fullName = nameSection;

      return {
        passportNumber,
        birthDate,
        expiryDate,
        nationality,
        fullName,
        mrzLine1: line1,
        mrzLine2: line2,
        verificationType: 'physical',
      };
    } catch (error) {
      console.error('MRZ parsing error:', error);
      return null;
    }
  };

  // Handle manual MRZ entry
  const handleManualVerify = async () => {
    if (!mrzLine1 || !mrzLine2) {
      onError?.('Please enter both MRZ lines');
      return;
    }

    if (!hologramVideo) {
      onError?.('Please record a video of the passport hologram');
      return;
    }

    // Remove any whitespace and convert to uppercase
    const line1 = mrzLine1.trim().toUpperCase();
    const line2 = mrzLine2.trim().toUpperCase();

    // Parse MRZ
    const passportData = parseMRZ(line1, line2);
    if (!passportData) {
      onError?.('Invalid MRZ format. Please check your input.');
      return;
    }

    // Verify with Oracle (including hologram video)
    await verifyWithOracle(passportData, hologramVideo);
  };

  // Handle image upload for OCR
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsScanning(true);

    try {
      // In a real implementation, use an OCR library like Tesseract.js
      // For now, we'll show a placeholder
      onError?.('OCR scanning is coming soon! Please use manual entry for now.');
      
      // TODO: Implement OCR scanning
      // const mrzText = await performOCR(file);
      // const [line1, line2] = mrzText.split('\n');
      // const passportData = parseMRZ(line1, line2);
      // await verifyWithOracle(passportData);
      
    } catch (error) {
      console.error('OCR error:', error);
      onError?.('Failed to scan passport. Please try manual entry.');
    } finally {
      setIsScanning(false);
    }
  };

  // Verify passport with Oracle
  const verifyWithOracle = async (passportData: PassportData, videoFile: File) => {
    setIsVerifying(true);

    try {
      // First check Oracle health
      const isHealthy = await oracleService.healthCheck();
      if (!isHealthy) {
        throw new Error('Oracle server is not available. Please try again later.');
      }

      console.log('🔍 Verifying passport with Oracle...');
      console.log('Passport data:', passportData);
      console.log('Hologram video:', videoFile.name, videoFile.size, 'bytes');

      // Send to Oracle for verification (with hologram video)
      const result = await oracleService.verifyPassportWithHologram(passportData, videoFile);

      console.log('✅ Oracle verification result:', result);

      if (!result.isValid) {
        onError?.(result.error || 'Passport verification failed');
        return;
      }

      // Prepare data for contract
      const contractData = await oracleService.prepareContractData(result);

      // Return both raw result and contract-ready data
      onVerified({
        raw: result,
        contract: contractData,
        passportData,
      });

    } catch (error) {
      console.error('Verification error:', error);
      onError?.(error instanceof Error ? error.message : 'Verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  // Load ICAO specimen for testing
  const loadTestPassport = () => {
    setMrzLine1('P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<');
    setMrzLine2('L898902C36UTO7408122F1204159ZE184226B<<<<<10');
  };

  // Handle video file upload
  const handleVideoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate video file
      if (!file.type.startsWith('video/')) {
        onError?.('Please upload a valid video file');
        return;
      }
      
      // Check file size (max 50MB)
      if (file.size > 50 * 1024 * 1024) {
        onError?.('Video file is too large. Please upload a video smaller than 50MB');
        return;
      }
      
      setHologramVideo(file);
      console.log('✅ Hologram video uploaded:', file.name, file.size, 'bytes');
    }
  };

  // Start recording video from webcam
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' }, // Prefer back camera on mobile
        audio: false 
      });
      
      recordedChunksRef.current = [];
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `hologram-${Date.now()}.webm`, { type: 'video/webm' });
        setHologramVideo(file);
        console.log('✅ Recording complete:', file.size, 'bytes');
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };
      
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 10000);
      
    } catch (error) {
      console.error('Camera access error:', error);
      onError?.('Failed to access camera. Please allow camera permissions or upload a video file.');
    }
  };

  // Stop recording video
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">
        🛂 Passport Verification
      </h2>

      {/* Mode Toggle */}
      <div className="mb-6 flex gap-4">
        <button
          onClick={() => setManualMode(true)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            manualMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📝 Manual Entry
        </button>
        <button
          onClick={() => setManualMode(false)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            !manualMode
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📷 Camera Scan
        </button>
      </div>

      {/* Manual Entry Mode */}
      {manualMode ? (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MRZ Line 1 (44 characters)
            </label>
            <input
              type="text"
              value={mrzLine1}
              onChange={(e) => setMrzLine1(e.target.value.toUpperCase())}
              placeholder="P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<<"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={44}
            />
            <p className="mt-1 text-xs text-gray-500">
              {mrzLine1.length}/44 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              MRZ Line 2 (44 characters)
            </label>
            <input
              type="text"
              value={mrzLine2}
              onChange={(e) => setMrzLine2(e.target.value.toUpperCase())}
              placeholder="L898902C36UTO7408122F1204159ZE184226B<<<<<10"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              maxLength={44}
            />
            <p className="mt-1 text-xs text-gray-500">
              {mrzLine2.length}/44 characters
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={loadTestPassport}
              className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              📋 Load Test Data
            </button>
          </div>

          {/* Hologram Video Section */}
          <div className="border-t border-gray-200 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-3">
              🎥 Hologram Verification Video (Required)
            </label>
            
            {hologramVideo ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">✅</span>
                    <div>
                      <p className="font-medium text-green-900">{hologramVideo.name}</p>
                      <p className="text-sm text-green-700">
                        {(hologramVideo.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setHologramVideo(null)}
                    className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    📹 <strong>Record a 5-10 second video</strong> showing the passport hologram from different angles.
                    Tilt the passport slowly to capture the hologram's dynamic optical effects.
                  </p>
                </div>
                
                <div className="flex gap-2">
                  {isRecording ? (
                    <button
                      onClick={stopRecording}
                      className="flex-1 px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors animate-pulse"
                    >
                      ⏹ Stop Recording
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={startRecording}
                        className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors"
                      >
                        📹 Record Video
                      </button>
                      <button
                        onClick={() => videoInputRef.current?.click()}
                        className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                      >
                        📁 Upload Video
                      </button>
                    </>
                  )}
                </div>
                
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          <button
            onClick={handleManualVerify}
            disabled={isVerifying || mrzLine1.length !== 44 || mrzLine2.length !== 44 || !hologramVideo}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isVerifying ? (
              <span className="flex items-center justify-center gap-2">
                <LoadingSpinner size="small" />
                Verifying with Oracle...
              </span>
            ) : (
              '🔍 Verify Passport'
            )}
          </button>
        </div>
      ) : (
        /* Camera Scan Mode */
        <div className="space-y-4">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
            
            {isScanning ? (
              <div className="flex flex-col items-center gap-4">
                <LoadingSpinner />
                <p className="text-gray-600">Scanning passport...</p>
              </div>
            ) : (
              <>
                <div className="text-6xl mb-4">📷</div>
                <p className="text-gray-600 mb-4">
                  Take a photo of your passport's MRZ (Machine Readable Zone)
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Upload Photo
                </button>
                <p className="text-sm text-gray-500 mt-4">
                  Note: OCR scanning is coming soon. Please use manual entry for now.
                </p>
              </>
            )}
          </div>
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-medium text-blue-900 mb-2">ℹ️ How it works:</h3>
        <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
          <li>Enter or scan your passport's MRZ (Machine Readable Zone)</li>
          <li>Record a video of the passport hologram (5-10 seconds, tilting slowly)</li>
          <li>The Oracle server validates the MRZ checksums</li>
          <li>Computer vision algorithms verify the hologram authenticity</li>
          <li>Oracle signs the verification result cryptographically</li>
          <li>Submit the signed result to the blockchain</li>
          <li>Receive your verifiable digital identity (DID)</li>
        </ol>
      </div>
    </div>
  );
}
