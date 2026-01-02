"""
FastAPI Hologram Verification Microservice
Integrates the Python hologram_verifier with the MinaID Oracle system
"""

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os
import tempfile
import logging
from typing import Dict, Any
import uvicorn
import cv2
import numpy as np
import base64
import json
import asyncio

# Add hologram_verification to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'hologram_verification', 'src'))

try:
    from hologram_verifier import HologramVerifier
except ImportError as e:
    print(f"Error importing hologram_verifier: {e}")
    print("Make sure the hologram_verification system is properly installed")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="MinaID Hologram Verification Service",
    description="Microservice for verifying passport holograms using computer vision",
    version="1.0.0"
)

# CORS middleware for Oracle server communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global verifier instance (initialized on startup)
verifier: HologramVerifier = None

# Configuration
CONFIDENCE_THRESHOLD = 0.6
MAX_VIDEO_SIZE_MB = 50
SUPPORTED_FORMATS = ['.mp4', '.avi', '.mov', '.webm']


class VerificationResponse(BaseModel):
    """Response model for hologram verification"""
    valid: bool
    confidence: float
    details: str
    total_frames: int = 0
    detections_count: int = 0


class HealthResponse(BaseModel):
    """Health check response"""
    status: str
    service: str
    version: str


@app.on_event("startup")
async def startup_event():
    """Initialize the hologram verifier on startup"""
    global verifier
    
    logger.info("Initializing Hologram Verifier...")
    
    try:
        verifier = HologramVerifier(
            feature_detector='orb',      # ORB for speed
            buffer_size=30,
            update_interval=10,
            use_ml_classifier=False,     # Use heuristic mode
            confidence_threshold=CONFIDENCE_THRESHOLD
        )
        logger.info("✓ Hologram Verifier initialized successfully")
    except Exception as e:
        logger.error(f"Failed to initialize HologramVerifier: {e}")
        raise


@app.get("/", response_model=HealthResponse)
async def root():
    """Root endpoint - health check"""
    return HealthResponse(
        status="online",
        service="MinaID Hologram Verification Service",
        version="1.0.0"
    )


@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    if verifier is None:
        raise HTTPException(status_code=503, detail="Service not initialized")
    
    return HealthResponse(
        status="healthy",
        service="MinaID Hologram Verification Service",
        version="1.0.0"
    )


@app.post("/verify_hologram", response_model=VerificationResponse)
async def verify_hologram(video: UploadFile = File(...)):
    """
    Verify hologram authenticity from video input.
    
    Args:
        video: Video file upload containing the passport hologram
        
    Returns:
        VerificationResponse with validation result
    """
    logger.info(f"Received hologram verification request: {video.filename}")
    
    # Validate file
    if not video.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    # Check file extension
    file_ext = os.path.splitext(video.filename)[1].lower()
    if file_ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format. Supported: {SUPPORTED_FORMATS}"
        )
    
    # Check file size
    video.file.seek(0, 2)  # Seek to end
    file_size_mb = video.file.tell() / (1024 * 1024)
    video.file.seek(0)  # Reset to beginning
    
    if file_size_mb > MAX_VIDEO_SIZE_MB:
        raise HTTPException(
            status_code=400,
            detail=f"Video file too large. Maximum: {MAX_VIDEO_SIZE_MB}MB"
        )
    
    logger.info(f"Video size: {file_size_mb:.2f}MB")
    
    # Save video to temporary file
    temp_video_path = None
    try:
        # Create temporary file with proper extension
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_ext,
            prefix='hologram_'
        ) as temp_file:
            # Write uploaded video to temp file
            content = await video.read()
            temp_file.write(content)
            temp_video_path = temp_file.name
        
        logger.info(f"Video saved to: {temp_video_path}")
        
        # Process video with hologram verifier
        logger.info("Processing video for hologram detection...")
        
        results = verifier.process_video_stream(
            video_source=temp_video_path,
            display=False,
            save_output=None,
            max_frames=None  # Process all frames
        )
        
        # Analyze results
        total_frames = results['total_frames']
        frames_with_detections = results['frames_with_detections']
        detections = results['verified_holograms']
        
        logger.info(f"Processing complete: {total_frames} frames, {len(detections)} detections")
        
        # Determine validity
        # A valid hologram should be detected in multiple frames
        min_detection_frames = max(3, total_frames // 10)  # At least 10% of frames or 3 frames
        
        is_valid = False
        avg_confidence = 0.0
        details = ""
        
        if len(detections) >= min_detection_frames:
            # Calculate average confidence
            confidences = results.get('confidence_scores', [])
            if confidences:
                avg_confidence = sum(confidences) / len(confidences)
                
                # Check if confidence meets threshold
                if avg_confidence >= CONFIDENCE_THRESHOLD:
                    is_valid = True
                    details = f"Valid hologram detected in {frames_with_detections}/{total_frames} frames"
                else:
                    details = f"Hologram detected but confidence too low: {avg_confidence:.2f}"
            else:
                details = "Hologram detected but no confidence scores available"
        else:
            details = f"Insufficient hologram detections: {len(detections)} detections in {total_frames} frames (minimum: {min_detection_frames})"
        
        logger.info(f"Verification result: valid={is_valid}, confidence={avg_confidence:.3f}")
        
        # Reset verifier for next request
        verifier.reset()
        
        return VerificationResponse(
            valid=is_valid,
            confidence=float(avg_confidence),
            details=details,
            total_frames=total_frames,
            detections_count=len(detections)
        )
        
    except Exception as e:
        logger.error(f"Error processing video: {e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error processing video: {str(e)}"
        )
    
    finally:
        # Clean up temporary file
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
                logger.info(f"Cleaned up temporary file: {temp_video_path}")
            except Exception as e:
                logger.warning(f"Failed to delete temp file: {e}")


@app.post("/verify_hologram_batch")
async def verify_hologram_batch(videos: list[UploadFile] = File(...)):
    """
    Batch verification endpoint (for future use).
    
    Args:
        videos: List of video files
        
    Returns:
        List of verification results
    """
    results = []
    
    for video in videos:
        try:
            result = await verify_hologram(video)
            results.append({
                "filename": video.filename,
                "result": result.dict()
            })
        except HTTPException as e:
            results.append({
                "filename": video.filename,
                "error": e.detail
            })
    
    return {"results": results}


@app.get("/config")
async def get_config():
    """Get current service configuration"""
    return {
        "confidence_threshold": CONFIDENCE_THRESHOLD,
        "max_video_size_mb": MAX_VIDEO_SIZE_MB,
        "supported_formats": SUPPORTED_FORMATS,
        "feature_detector": "orb",
        "buffer_size": 30
    }


@app.post("/verify_hologram_stream")
async def verify_hologram_stream(video: UploadFile = File(...)):
    """
    Verify hologram with frame-by-frame streaming of annotated results.
    
    Returns a stream of JSON objects, each containing:
    - frame_number: Current frame number
    - total_frames: Total frames in video
    - annotated_frame: Base64-encoded annotated frame image
    - detections: List of hologram detections in this frame
    - confidence: Overall confidence score so far
    
    This endpoint is useful for real-time visualization during testing.
    """
    logger.info(f"Received streaming verification request: {video.filename}")
    
    # Validate file
    if not video.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    file_ext = os.path.splitext(video.filename)[1].lower()
    if file_ext not in SUPPORTED_FORMATS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported video format. Supported: {SUPPORTED_FORMATS}"
        )
    
    # Save video to temporary file
    temp_video_path = None
    try:
        with tempfile.NamedTemporaryFile(
            delete=False,
            suffix=file_ext,
            prefix='hologram_stream_'
        ) as temp_file:
            content = await video.read()
            temp_file.write(content)
            temp_video_path = temp_file.name
        
        logger.info(f"Streaming video from: {temp_video_path}")
        
        async def generate_frames():
            """Generator function that yields annotated frames"""
            try:
                cap = cv2.VideoCapture(temp_video_path)
                if not cap.isOpened():
                    yield json.dumps({"error": "Cannot open video file"}) + "\n"
                    return
                
                total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
                frame_number = 0
                all_confidences = []
                
                # Create a fresh verifier for this stream
                stream_verifier = HologramVerifier(
                    feature_detector='orb',
                    buffer_size=30,
                    update_interval=10,
                    use_ml_classifier=False,
                    confidence_threshold=CONFIDENCE_THRESHOLD
                )
                
                while True:
                    ret, frame = cap.read()
                    if not ret:
                        break
                    
                    frame_number += 1
                    
                    # Process frame
                    annotated_frame, detections = stream_verifier.process_frame(frame)
                    
                    # Collect confidence scores
                    for det in detections:
                        all_confidences.append(det['confidence'])
                    
                    # Encode frame as JPEG
                    _, buffer = cv2.imencode('.jpg', annotated_frame, [cv2.IMWRITE_JPEG_QUALITY, 85])
                    frame_base64 = base64.b64encode(buffer).decode('utf-8')
                    
                    # Calculate average confidence
                    avg_confidence = sum(all_confidences) / len(all_confidences) if all_confidences else 0.0
                    
                    # Prepare frame data
                    frame_data = {
                        "frame_number": frame_number,
                        "total_frames": total_frames,
                        "annotated_frame": frame_base64,
                        "detections": detections,
                        "detections_count": len(detections),
                        "avg_confidence": float(avg_confidence),
                        "progress": (frame_number / total_frames) * 100 if total_frames > 0 else 0
                    }
                    
                    # Yield frame data as JSON
                    yield json.dumps(frame_data) + "\n"
                    
                    # Small delay to prevent overwhelming the client
                    await asyncio.sleep(0.01)
                
                cap.release()
                
                # Send final summary
                final_data = {
                    "done": True,
                    "total_frames": frame_number,
                    "total_detections": len(all_confidences),
                    "avg_confidence": float(sum(all_confidences) / len(all_confidences)) if all_confidences else 0.0,
                    "valid": (sum(all_confidences) / len(all_confidences) >= CONFIDENCE_THRESHOLD) if all_confidences else False
                }
                yield json.dumps(final_data) + "\n"
                
            except Exception as e:
                logger.error(f"Error during streaming: {e}", exc_info=True)
                yield json.dumps({"error": str(e)}) + "\n"
            
            finally:
                # Cleanup temp file
                if temp_video_path and os.path.exists(temp_video_path):
                    try:
                        os.remove(temp_video_path)
                    except Exception as e:
                        logger.warning(f"Failed to delete temp file: {e}")
        
        return StreamingResponse(
            generate_frames(),
            media_type="application/x-ndjson",
            headers={
                "Cache-Control": "no-cache",
                "X-Accel-Buffering": "no"
            }
        )
        
    except Exception as e:
        logger.error(f"Error setting up streaming: {e}", exc_info=True)
        if temp_video_path and os.path.exists(temp_video_path):
            try:
                os.remove(temp_video_path)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    # Run the service
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        log_level="info"
    )
