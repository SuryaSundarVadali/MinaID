'use client';

/**
 * Advanced Hologram Testing Tool with Real-Time Streaming
 * 
 * Shows frame-by-frame hologram detection with visual overlays
 */

import React, { useState, useRef, useEffect } from 'react';

interface DetectionResult {
  valid: boolean;
  confidence: number;
  details: string;
  total_frames: number;
  detections_count: number;
}

interface StreamFrame {
  frame_number: number;
  total_frames: number;
  annotated_frame: string; // base64
  detections: any[];
  detections_count: number;
  avg_confidence: number;
  progress: number;
}

export default function HologramStreamingTester() {
  const [isRecording, setIsRecording] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentFrame, setCurrentFrame] = useState<StreamFrame | null>(null);
  const [finalResult, setFinalResult] = useState<any | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [streamActive, setStreamActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAnnotations, setShowAnnotations] = useState(true);
  
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const streamCanvasRef = useRef<HTMLCanvasElement>(null);
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

  // Draw annotated frame on canvas
  useEffect(() => {
    if (currentFrame && streamCanvasRef.current && showAnnotations) {
      const canvas = streamCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const img = new Image();
      img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
      };
      img.src = `data:image/jpeg;base64,${currentFrame.annotated_frame}`;
    }
  }, [currentFrame, showAnnotations]);

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

  const startRecording = async () => {
    if (!streamRef.current) {
      await startStream();
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
        
        // Automatically stream-test the recorded video
        await streamTestHologram(blob);
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setCurrentFrame(null);
      setFinalResult(null);

      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

      setTimeout(() => {
        if (mediaRecorderRef.current?.state === 'recording') {
          stopRecording();
        }
      }, 10000);

    } catch (err) {
      console.error('Recording error:', err);
      setError('Failed to start recording');
    }
  };

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

  const streamTestHologram = async (videoBlob: Blob) => {
    setIsStreaming(true);
    setError(null);
    setCurrentFrame(null);
    setFinalResult(null);

    try {
      const formData = new FormData();
      const file = new File([videoBlob], `hologram-stream-${Date.now()}.webm`, { type: 'video/webm' });
      formData.append('video', file);

      console.log('🎬 Starting streaming analysis...');

      const response = await fetch('http://localhost:8000/verify_hologram_stream', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter(line => line.trim());

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            if (data.error) {
              setError(data.error);
            } else if (data.done) {
              setFinalResult(data);
              console.log('✅ Streaming complete:', data);
            } else {
              setCurrentFrame(data);
            }
          } catch (e) {
            console.warn('Failed to parse JSON:', line);
          }
        }
      }

    } catch (err) {
      console.error('Streaming error:', err);
      setError(err instanceof Error ? err.message : 'Streaming failed');
    } finally {
      setIsStreaming(false);
    }
  };

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
    await streamTestHologram(blob);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6">
            <h1 className="text-3xl font-bold text-white mb-2">
              🎬 Real-Time Hologram Detection Tester
            </h1>
            <p className="text-purple-100">
              Frame-by-frame visualization of hologram detection algorithm
            </p>
          </div>

          <div className="p-6 grid lg:grid-cols-2 gap-6">
            {/* Left: Camera and Controls */}
            <div className="space-y-4">
              {/* Live Camera */}
              <div className="bg-gray-100 rounded-lg p-4">
                <h2 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
                  📹 Live Camera
                  {isRecording && <span className="text-red-600 animate-pulse">● REC</span>}
                </h2>
                
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  
                  {isRecording && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 z-10">
                      <span className="w-3 h-3 bg-white rounded-full animate-pulse"></span>
                      <span className="font-mono font-bold">{recordingTime}s / 10s</span>
                    </div>
                  )}
                  
                  {!streamActive && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <div className="text-6xl mb-3">📹</div>
                        <p>Camera not active</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-2">
                  {!streamActive ? (
                    <button
                      onClick={startStream}
                      className="w-full px-4 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                    >
                      📹 Start Camera
                    </button>
                  ) : (
                    <div className="space-y-2">
                      {!isRecording ? (
                        <>
                          <button
                            onClick={startRecording}
                            className="w-full px-4 py-3 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700"
                          >
                            ⏺ Record & Analyze (10s)
                          </button>
                          <button
                            onClick={stopStream}
                            className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg font-medium hover:bg-gray-700"
                          >
                            ⏹ Stop Camera
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="w-full px-4 py-3 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 animate-pulse"
                        >
                          ⏹ Stop Recording
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
            </div>

            {/* Right: Analysis Results */}
            <div className="space-y-4">
              {/* Annotated Frame Display */}
              <div className="bg-gray-100 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-bold text-gray-800">
                    🎯 Detection Overlay
                  </h2>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={showAnnotations}
                      onChange={(e) => setShowAnnotations(e.target.checked)}
                      className="rounded"
                    />
                    Show annotations
                  </label>
                </div>
                
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ aspectRatio: '16/9' }}>
                  <canvas
                    ref={streamCanvasRef}
                    className="w-full h-full object-contain"
                  />
                  
                  {!currentFrame && !isStreaming && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-gray-400">
                        <div className="text-6xl mb-3">🎯</div>
                        <p>Waiting for analysis...</p>
                      </div>
                    </div>
                  )}
                  
                  {isStreaming && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                      <div className="text-center text-white">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-white mx-auto mb-3"></div>
                        <p className="font-bold">Analyzing frames...</p>
                        {currentFrame && (
                          <p className="text-sm mt-2">
                            Frame {currentFrame.frame_number} / {currentFrame.total_frames}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Metrics */}
                {currentFrame && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <div className="bg-white rounded p-2 text-center">
                      <p className="text-xs text-gray-600">Frame</p>
                      <p className="text-lg font-bold text-gray-900">
                        {currentFrame.frame_number}
                      </p>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <p className="text-xs text-gray-600">Detections</p>
                      <p className="text-lg font-bold text-blue-600">
                        {currentFrame.detections_count}
                      </p>
                    </div>
                    <div className="bg-white rounded p-2 text-center">
                      <p className="text-xs text-gray-600">Confidence</p>
                      <p className="text-lg font-bold text-green-600">
                        {(currentFrame.avg_confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Progress Bar */}
                {currentFrame && (
                  <div className="mt-3">
                    <div className="bg-gray-300 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full transition-all duration-300"
                        style={{ width: `${currentFrame.progress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-600 text-center mt-1">
                      {currentFrame.progress.toFixed(1)}% complete
                    </p>
                  </div>
                )}
              </div>

              {/* Error Display */}
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

              {/* Final Results */}
              {finalResult && (
                <div className={`border-2 rounded-lg p-4 ${
                  finalResult.valid 
                    ? 'bg-green-50 border-green-500' 
                    : 'bg-orange-50 border-orange-500'
                }`}>
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-3xl">
                      {finalResult.valid ? '✅' : '⚠️'}
                    </span>
                    <div>
                      <h3 className={`text-lg font-bold ${
                        finalResult.valid ? 'text-green-900' : 'text-orange-900'
                      }`}>
                        {finalResult.valid ? 'Hologram Verified!' : 'Verification Failed'}
                      </h3>
                      <p className={`text-sm ${
                        finalResult.valid ? 'text-green-700' : 'text-orange-700'
                      }`}>
                        Analysis complete
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-white rounded p-3">
                      <p className="text-xs text-gray-600">Total Frames</p>
                      <p className="text-xl font-bold">{finalResult.total_frames}</p>
                    </div>
                    <div className="bg-white rounded p-3">
                      <p className="text-xs text-gray-600">Detections</p>
                      <p className="text-xl font-bold text-blue-600">{finalResult.total_detections}</p>
                    </div>
                    <div className="bg-white rounded p-3 col-span-2">
                      <p className="text-xs text-gray-600 mb-1">Average Confidence</p>
                      <p className="text-2xl font-bold text-green-600">
                        {(finalResult.avg_confidence * 100).toFixed(1)}%
                      </p>
                      <div className="mt-2 bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-full ${
                            finalResult.avg_confidence >= 0.6 ? 'bg-green-500' : 'bg-orange-500'
                          }`}
                          style={{ width: `${finalResult.avg_confidence * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
