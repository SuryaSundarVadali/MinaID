"""
Test script for Hologram Verification Microservice
"""

import requests
import os
import sys

# Service endpoint
BASE_URL = "http://localhost:8000"

def test_health():
    """Test health endpoint"""
    print("Testing health endpoint...")
    response = requests.get(f"{BASE_URL}/health")
    
    if response.status_code == 200:
        print("✓ Health check passed")
        print(f"  Response: {response.json()}")
        return True
    else:
        print(f"✗ Health check failed: {response.status_code}")
        return False

def test_verify_hologram(video_path):
    """Test hologram verification with a video file"""
    print(f"\nTesting hologram verification with: {video_path}")
    
    if not os.path.exists(video_path):
        print(f"✗ Video file not found: {video_path}")
        return False
    
    with open(video_path, 'rb') as video_file:
        files = {'video': (os.path.basename(video_path), video_file, 'video/mp4')}
        
        print("Uploading video for verification...")
        response = requests.post(f"{BASE_URL}/verify_hologram", files=files)
        
        if response.status_code == 200:
            result = response.json()
            print("✓ Verification completed")
            print(f"  Valid: {result['valid']}")
            print(f"  Confidence: {result['confidence']:.3f}")
            print(f"  Details: {result['details']}")
            print(f"  Frames: {result['total_frames']}")
            print(f"  Detections: {result['detections_count']}")
            return True
        else:
            print(f"✗ Verification failed: {response.status_code}")
            print(f"  Error: {response.text}")
            return False

def test_config():
    """Test configuration endpoint"""
    print("\nTesting configuration endpoint...")
    response = requests.get(f"{BASE_URL}/config")
    
    if response.status_code == 200:
        print("✓ Config retrieved")
        print(f"  {response.json()}")
        return True
    else:
        print(f"✗ Config failed: {response.status_code}")
        return False

if __name__ == "__main__":
    print("="*60)
    print("Hologram Verification Service Test")
    print("="*60)
    print()
    
    # Test health
    if not test_health():
        print("\nService is not running. Start it with: ./start.sh")
        sys.exit(1)
    
    # Test config
    test_config()
    
    # Test verification if video provided
    if len(sys.argv) > 1:
        video_path = sys.argv[1]
        test_verify_hologram(video_path)
    else:
        print("\nTo test verification, provide a video file:")
        print("  python test_service.py path/to/video.mp4")
    
    print("\n" + "="*60)
    print("Tests complete!")
    print("="*60)
