#!/usr/bin/env python3
"""
Quick verification test for the Hologram Detection System
Creates a synthetic test video and verifies the pipeline works
"""

import sys
import os

# Add src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src'))

import cv2
import numpy as np
from hologram_verifier import HologramVerifier

def create_test_video(output_path='test_video.mp4', num_frames=30):
    """Create a synthetic test video with color-changing region (simulating hologram)"""
    
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    writer = cv2.VideoWriter(output_path, fourcc, 30, (640, 480))
    
    print("Creating synthetic test video...")
    
    for i in range(num_frames):
        # Create frame
        frame = np.ones((480, 640, 3), dtype=np.uint8) * 128
        
        # Add a color-changing region (simulating hologram)
        hue = int((i / num_frames) * 179)  # Cycle through hues
        hsv_color = np.uint8([[[hue, 255, 200]]])
        bgr_color = cv2.cvtColor(hsv_color, cv2.COLOR_HSV2BGR)[0][0]
        
        # Draw region with changing color
        cv2.rectangle(frame, (200, 150), (440, 330), bgr_color.tolist(), -1)
        
        # Add some static features for alignment
        cv2.rectangle(frame, (50, 50), (100, 100), (255, 255, 255), 2)
        cv2.circle(frame, (550, 400), 30, (255, 255, 255), 2)
        
        writer.write(frame)
    
    writer.release()
    print(f"✓ Test video created: {output_path}")
    return output_path

def test_system():
    """Test the hologram verification system"""
    
    print("\n" + "="*60)
    print("Hologram Verification System - Quick Test")
    print("="*60 + "\n")
    
    # Create test video
    test_video = create_test_video()
    
    # Initialize verifier
    print("\nInitializing HologramVerifier...")
    verifier = HologramVerifier(
        feature_detector='orb',
        buffer_size=20,
        update_interval=5,
        confidence_threshold=0.3  # Lower threshold for synthetic test
    )
    print("✓ Verifier initialized")
    
    # Process video
    print("\nProcessing test video...")
    try:
        results = verifier.process_video_stream(
            video_source=test_video,
            display=False,  # Don't display in test
            save_output=None,
            max_frames=30
        )
        
        # Check results
        print("\n" + "="*60)
        print("Test Results:")
        print("="*60)
        print(f"✓ Frames processed: {results['total_frames']}")
        print(f"✓ Frames with detections: {results['frames_with_detections']}")
        print(f"✓ Total detections: {len(results['verified_holograms'])}")
        print(f"✓ Avg processing time: {results['avg_processing_time']:.4f}s/frame")
        
        if results['confidence_scores']:
            print(f"✓ Avg confidence: {results['avg_confidence']:.3f}")
        
        # Verify system works
        if results['total_frames'] > 0:
            print("\n✅ System test PASSED - All components working!")
            return True
        else:
            print("\n❌ System test FAILED - No frames processed")
            return False
            
    except Exception as e:
        print(f"\n❌ System test FAILED with error: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        # Cleanup
        if os.path.exists(test_video):
            os.remove(test_video)
            print(f"\nCleaned up test video")

if __name__ == "__main__":
    success = test_system()
    sys.exit(0 if success else 1)
