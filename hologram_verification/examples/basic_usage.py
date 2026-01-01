"""
Example usage of the Hologram Verification System
"""

import sys
import os

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from hologram_verifier import HologramVerifier
import cv2


def main():
    """
    Example: Process a video file or webcam stream for hologram detection.
    """
    print("=" * 60)
    print("Hologram Detection and Verification System")
    print("Based on: MIDV-Holo, Kada et al., and Pouliquen et al.")
    print("=" * 60)
    print()
    
    # Configuration
    VIDEO_SOURCE = 0  # Use 0 for webcam, or provide path to video file
    # VIDEO_SOURCE = "path/to/your/video.mp4"
    
    SAVE_OUTPUT = None  # Set to path to save output video
    # SAVE_OUTPUT = "output_hologram_detection.mp4"
    
    MAX_FRAMES = None  # Set to limit processing (None = process all)
    # MAX_FRAMES = 300  # Process first 300 frames
    
    # Initialize verifier
    print("Initializing Hologram Verifier...")
    verifier = HologramVerifier(
        feature_detector='orb',      # 'orb' or 'sift'
        buffer_size=30,              # Frames for chromaticity accumulation
        update_interval=10,          # Update hologram map every N frames
        use_ml_classifier=False,     # Use heuristic mode (no training needed)
        confidence_threshold=0.6     # Minimum confidence for detection
    )
    
    print("Configuration:")
    print(f"  Feature Detector: orb")
    print(f"  Buffer Size: 30 frames")
    print(f"  Update Interval: 10 frames")
    print(f"  Confidence Threshold: 0.6")
    print()
    
    # Process video
    print("Starting video processing...")
    print("Press 'q' to quit, 'r' to reset")
    print()
    
    try:
        results = verifier.process_video_stream(
            video_source=VIDEO_SOURCE,
            display=True,
            save_output=SAVE_OUTPUT,
            max_frames=MAX_FRAMES
        )
        
        # Print results
        print("\n" + "=" * 60)
        print("Processing Complete!")
        print("=" * 60)
        print(f"Total Frames Processed: {results['total_frames']}")
        print(f"Frames with Detections: {results['frames_with_detections']}")
        print(f"Total Hologram Detections: {len(results['verified_holograms'])}")
        print(f"Average Processing Time: {results['avg_processing_time']:.4f} seconds/frame")
        print(f"Average FPS: {1.0/results['avg_processing_time']:.2f}")
        
        if results['confidence_scores']:
            print(f"Average Confidence: {results['avg_confidence']:.3f}")
            print(f"Maximum Confidence: {results['max_confidence']:.3f}")
        
        print("\nDetection Summary:")
        if results['verified_holograms']:
            for i, detection in enumerate(results['verified_holograms'][:10]):  # Show first 10
                print(f"  {i+1}. Frame {detection['frame']}: "
                      f"Bbox {detection['bbox']}, Confidence: {detection['confidence']:.3f}")
            if len(results['verified_holograms']) > 10:
                print(f"  ... and {len(results['verified_holograms']) - 10} more detections")
        else:
            print("  No holograms detected")
        
    except KeyboardInterrupt:
        print("\nProcessing interrupted by user")
    except Exception as e:
        print(f"\nError during processing: {e}")
        import traceback
        traceback.print_exc()


def example_single_frame():
    """
    Example: Process a single image frame.
    """
    print("Single Frame Processing Example")
    print("-" * 60)
    
    # Load image
    image_path = "test_image.jpg"  # Replace with your image path
    
    if not os.path.exists(image_path):
        print(f"Error: Image not found at {image_path}")
        print("Please provide a valid image path")
        return
    
    frame = cv2.imread(image_path)
    
    # Initialize verifier
    verifier = HologramVerifier()
    
    # Process frame
    result_frame, detections = verifier.process_frame(frame)
    
    # Display results
    print(f"Detections: {len(detections)}")
    for i, det in enumerate(detections):
        print(f"  {i+1}. Bbox: {det['bbox']}, Confidence: {det['confidence']:.3f}")
    
    # Show image
    cv2.imshow('Hologram Detection', result_frame)
    cv2.waitKey(0)
    cv2.destroyAllWindows()


def example_with_visualization():
    """
    Example: Process video with detailed pipeline visualization.
    """
    print("Pipeline Visualization Example")
    print("-" * 60)
    
    VIDEO_SOURCE = 0  # Webcam
    
    verifier = HologramVerifier()
    
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    
    print("Processing with visualization...")
    print("Press 'q' to quit, 'v' to toggle visualization mode")
    
    show_viz = False
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            if show_viz:
                # Show detailed pipeline visualization
                viz_frame = verifier.visualize_pipeline(frame)
                cv2.imshow('Pipeline Visualization', viz_frame)
            else:
                # Show normal detection
                result_frame, detections = verifier.process_frame(frame)
                cv2.imshow('Hologram Detection', result_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('v'):
                show_viz = not show_viz
                print(f"Visualization mode: {'ON' if show_viz else 'OFF'}")
    
    finally:
        cap.release()
        cv2.destroyAllWindows()


if __name__ == "__main__":
    # Run main example
    main()
    
    # Uncomment to run other examples:
    # example_single_frame()
    # example_with_visualization()
