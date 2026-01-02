'use client';

/**
 * Hologram Testing Tool Component
 * 
 * Development tool for testing hologram verification with real-time visual feedback
 * Shows live camera feed with hologram detection overlays, confidence scores, and metrics
 */

import React, { useState, useRef, useEffect } from 'react';

interface DetectionResult {
  valid: boolean;
  confidence: number;
  details: string;
  total_frames: number;
  detections_count: number;
}

export default function HologramTestingTool() {
  const [isRecording, setIsRecording] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<DetectionResult | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [streamActive, setStreamActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);
  
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStream();
      if (recordedVideoUrl) {
        URL.revokeObjectURL(recordedVideoUrl);
      }
    };
  }, [recordedVideoUrl]);

  // Start camera stream
  const startStream = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      streamRef.current = stream;
      
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play();
      }
      
      setStreamActive(true);
    } catch (err) {
      console.error('Camera access error:', err);
      setError('Failed to access camera. Please allow camera permissions.');
    }
  };

  // Stop camera stream
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  // Start recording
  const startRecording = async () => {
    if (!streamRef.current) {
      await startStream();
      // Wait a bit for stream to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (!streamRef.current) {
      setError('Camera stream not available');
      return;
    }

    try {
      recordedChunksRef.current = [];
      
      const mediaRecorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9',
      });

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        setRecordedVideoUrl(url);
        
        // Automatically test the recorded video
        await testHologram(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setTestResult(null);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 30000);

    } catch (err) {
      console.error('Recording error:', err);
      setError('Failed to start recording');
    }
  };

  // Stop recording
  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Test hologram with API
  const testHologram = async (videoBlob: Blob) => {
    setIsTesting(true);
    setError(null);

    try {
      const formData = new FormData();
      const file = new File([videoBlob], `hologram-test-${Date.now()}.webm`, { type: 'video/webm' });
      formData.append('video', file);

      console.log('🔍 Testing hologram with API...');
      console.log('File size:', (file.size / 1024 / 1024).toFixed(2), 'MB');

      const response = await fetch('http://localhost:8000/verify_hologram', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(errorData.detail || `API error: ${response.status}`);
      }

      const result: DetectionResult = await response.json();
      console.log('✅ Test result:', result);
      setTestResult(result);

    } catch (err) {
      console.error('Testing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to test hologram');
    } finally {
      setIsTesting(false);
    }
  };

  // Upload and test existing video
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please upload a valid video file');
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setError('Video file is too large (max 50MB)');
      return;
    }

    const url = URL.createObjectURL(file);
    setRecordedVideoUrl(url);

    const blob = await file.arrayBuffer().then(buffer => new Blob([buffer], { type: file.type }));
    await testHologram(blob);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-lg shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 p-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              🔬 Hologram Verification Testing Tool
            </h1>
            <p className="text-purple-100">
              Test the hologram detection system with real-time visual feedback
            </p>
          </div>

          {/* Instructions */}
          {showInstructions && (
            <div className="bg-blue-50 border-b border-blue-200 p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">💡</span>
                <div className="flex-1">
                  <h3 className="font-bold text-blue-900 mb-2">Testing Instructions:</h3>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Position your passport with the hologram clearly visible</li>
                    <li>Click "Start Camera" to activate the live preview</li>
                    <li>Click "Record & Test" to record a 30-second video</li>
                    <li>Slowly tilt the passport during recording to capture the hologram effect</li>
                    <li>The system will automatically analyze the video after recording</li>
                    <li>View the detection results and confidence scores below</li>
                  </ol>
                </div>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          <div className="p-6 grid md:grid-cols-2 gap-6">
            {/* Left Column - Camera/Video */}
            <div className="space-y-4">
              <div className="bg-gray-100 rounded-lg p-4">
                <h2 className="text-lg font-bold text-gray-800 mb-3">
                  📹 Live Camera Feed
                </h2>
                
                {/* Video Preview */}
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  
                  {/* Recording Indicator */}
                  {isRecording && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 animate-pulse z-10">
                      <span className="w-3 h-3 bg-white rounded-full"></span>
                      <span className="font-mono font-bold">{recordingTime}s / 30s</span>
                    </div>
                  )}
                  
                  {/* Recording Instructions */}
                  {isRecording && (
                    <div className="absolute bottom-3 left-0 right-0 text-center z-10">
                      <p className="bg-black bg-opacity-70 text-white px-4 py-2 rounded-lg inline-block text-sm">
                        🔄 Tilt the passport slowly to show the hologram
                      </p>
                    </div>
                  )}
                  
                  {/* No Stream Placeholder */}
                  {!streamActive && !recordedVideoUrl && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <div className="text-6xl mb-3">📹</div>
                        <p>Camera not active</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="mt-4 space-y-2">
                  {!streamActive ? (
                    <button
                      onClick={startStream}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors"
                    >
                      📹 Start Camera
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {!isRecording ? (
                        <>
                          <button
                            onClick={startRecording}
                            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
                          >
                            ⏺ Record & Test (30s)
                          </button>
                          <button
                            onClick={stopStream}
                            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700 transition-colors"
                          >
                            ⏹ Stop Camera
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors animate-pulse"
                        >
                          ⏹ Stop Recording Now
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="text-center">
                    <label className="cursor-pointer text-sm text-indigo-600 hover:text-indigo-800 font-medium">
                      📁 Or upload a video file
                      <input
                        type="file"
                        accept="video/*"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Recorded Video Playback */}
              {recordedVideoUrl && (
                <div className="bg-gray-100 rounded-lg p-4">
                  <h2 className="text-lg font-bold text-gray-800 mb-3">
                    📼 Recorded Video
                  </h2>
                  <video
                    src={recordedVideoUrl}
                    controls
                    className="w-full rounded-lg bg-black"
                  />
                </div>
              )}
            </div>

            {/* Right Column - Results */}
            <div className="space-y-4">
              {/* Status */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">❌</span>
                    <div>
                      <h3 className="font-bold text-red-900">Error</h3>
                      <p className="text-sm text-red-700">{error}</p>
                    </div>
                  </div>
                </div>
              )}

              {isTesting && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <div>
                      <h3 className="font-bold text-blue-900">Testing Hologram...</h3>
                      <p className="text-sm text-blue-700">Analyzing video for hologram detection</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Results */}
              {testResult && (
                <div className={`border-2 rounded-lg p-4 ${
                  testResult.valid 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-orange-50 border-orange-500'
                }`}>
                  <div className="flex items-start gap-3 mb-4">
                    <span className="text-4xl">
                      {testResult.valid ? '✅' : '⚠️'}
                    </span>
                    <div>
                      <h3 className={`text-xl font-bold ${
                        testResult.valid ? 'text-green-900' : 'text-orange-900'
                      }`}>
                        {testResult.valid ? 'Hologram Detected!' : 'Low Confidence'}
                      </h3>
                      <p className={`text-sm ${
                        testResult.valid ? 'text-green-700' : 'text-orange-700'
                      }`}>
                        {testResult.details}
                      </p>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Confidence Score</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {(testResult.confidence * 100).toFixed(1)}%
                      </p>
                      <div className="mt-2 bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div 
                          className={`h-full ${
                            testResult.confidence >= 0.6 ? 'bg-green-500' : 
                            testResult.confidence >= 0.4 ? 'bg-yellow-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${testResult.confidence * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Total Frames</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {testResult.total_frames}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Detections</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {testResult.detections_count}
                      </p>
                    </div>

                    <div className="bg-white rounded-lg p-3">
                      <p className="text-xs text-gray-600 mb-1">Detection Rate</p>
                      <p className="text-2xl font-bold text-gray-900">
                        {testResult.total_frames > 0 
                          ? ((testResult.detections_count / testResult.total_frames) * 100).toFixed(1)
                          : '0'
                        }%
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* System Info */}
              <div className="bg-gray-100 rounded-lg p-4">
                <h3 className="font-bold text-gray-800 mb-3">🔧 System Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">API Endpoint:</span>
                    <span className="font-mono text-gray-900">localhost:8000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Max Video Size:</span>
                    <span className="font-mono text-gray-900">50 MB</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Recording Duration:</span>
                    <span className="font-mono text-gray-900">30 seconds</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Detection Algorithm:</span>
                    <span className="font-mono text-gray-900">MIDV-Holo + ORB</span>
                  </div>
                </div>
              </div>

              {/* Tips */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-bold text-yellow-900 mb-2">💡 Tips for Better Detection</h3>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>Ensure good lighting conditions</li>
                  <li>Keep the passport stable but tilt slowly</li>
                  <li>Focus on the hologram area</li>
                  <li>Avoid reflections and glare</li>
                  <li>Record for the full 10 seconds</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
