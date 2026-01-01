"""
Advanced examples for hologram verification system
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

from hologram_verifier import HologramVerifier
from dynamic_behavior_verifier import DynamicBehaviorVerifier
import cv2
import numpy as np


def example_train_ml_classifier():
    """
    Example: Train ML classifier with labeled data.
    
    This requires a dataset with labeled hologram regions.
    Dataset structure:
        data/
            real_holograms/
                video1.mp4
                video2.mp4
            fake_holograms/
                video1.mp4
                video2.mp4
    """
    print("Training ML Classifier Example")
    print("-" * 60)
    
    # Initialize verifier with ML enabled
    verifier = HologramVerifier(use_ml_classifier=True)
    behavior_verifier = verifier.behavior_verifier
    
    # Collect training data
    X_train = []
    y_train = []
    
    # Process real hologram videos (label = 1)
    real_videos = ['data/real_holograms/video1.mp4']  # Add your video paths
    for video_path in real_videos:
        if not os.path.exists(video_path):
            print(f"Warning: {video_path} not found, skipping")
            continue
        
        cap = cv2.VideoCapture(video_path)
        frames = []
        
        # Read frames
        for _ in range(30):  # Use 30 frames
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        
        cap.release()
        
        if len(frames) < 10:
            continue
        
        # Extract features (assume hologram is in center region)
        h, w = frames[0].shape[:2]
        region = (w//4, h//4, w//2, h//2)  # Center region
        
        features_list = behavior_verifier.extract_training_features(frames, [region])
        X_train.extend(features_list)
        y_train.extend([1] * len(features_list))
        
        print(f"Processed {video_path}: {len(features_list)} samples")
    
    # Process fake hologram videos (label = 0)
    fake_videos = ['data/fake_holograms/video1.mp4']  # Add your video paths
    for video_path in fake_videos:
        if not os.path.exists(video_path):
            print(f"Warning: {video_path} not found, skipping")
            continue
        
        cap = cv2.VideoCapture(video_path)
        frames = []
        
        for _ in range(30):
            ret, frame = cap.read()
            if not ret:
                break
            frames.append(frame)
        
        cap.release()
        
        if len(frames) < 10:
            continue
        
        h, w = frames[0].shape[:2]
        region = (w//4, h//4, w//2, h//2)
        
        features_list = behavior_verifier.extract_training_features(frames, [region])
        X_train.extend(features_list)
        y_train.extend([0] * len(features_list))
        
        print(f"Processed {video_path}: {len(features_list)} samples")
    
    # Train classifier
    if len(X_train) > 0:
        X_train = np.array(X_train)
        y_train = np.array(y_train)
        
        print(f"\nTraining classifier with {len(X_train)} samples...")
        behavior_verifier.train_classifier(X_train, y_train)
        print("Training complete!")
        
        # Now use the trained verifier
        print("\nTesting on new video...")
        test_video = 'data/test_video.mp4'
        if os.path.exists(test_video):
            results = verifier.process_video_stream(test_video, display=True)
            print(f"Results: {results}")
    else:
        print("No training data collected. Please provide valid video paths.")


def example_custom_configuration():
    """
    Example: Use custom configuration for specific document types.
    """
    print("Custom Configuration Example")
    print("-" * 60)
    
    # Configuration optimized for passport holograms
    passport_verifier = HologramVerifier(
        feature_detector='sift',     # SIFT is more accurate for textured documents
        buffer_size=45,              # Longer accumulation for better statistics
        update_interval=15,          # Less frequent updates
        confidence_threshold=0.7     # Higher threshold for passport security
    )
    
    # Adjust component parameters
    passport_verifier.region_selector.s_percentile = 75  # Higher saturation threshold
    passport_verifier.region_selector.hue_variance_threshold = 0.2  # More color variation
    
    passport_verifier.behavior_verifier.hue_energy_threshold = 0.2  # Stronger flash effect
    
    print("Passport Hologram Verifier initialized")
    print("Processing video...")
    
    VIDEO_SOURCE = 0  # or path to video
    results = passport_verifier.process_video_stream(VIDEO_SOURCE, display=True)
    
    print(f"\nResults: {results}")


def example_batch_processing():
    """
    Example: Process multiple videos in batch.
    """
    print("Batch Processing Example")
    print("-" * 60)
    
    video_files = [
        'data/document1.mp4',
        'data/document2.mp4',
        'data/document3.mp4',
    ]
    
    verifier = HologramVerifier()
    
    all_results = []
    
    for video_path in video_files:
        if not os.path.exists(video_path):
            print(f"Warning: {video_path} not found, skipping")
            continue
        
        print(f"\nProcessing: {video_path}")
        verifier.reset()  # Reset for each video
        
        results = verifier.process_video_stream(
            video_path,
            display=False,
            save_output=f"output_{os.path.basename(video_path)}",
            max_frames=300
        )
        
        all_results.append({
            'video': video_path,
            'results': results
        })
        
        print(f"  Frames: {results['total_frames']}")
        print(f"  Detections: {len(results['verified_holograms'])}")
    
    # Summary
    print("\n" + "=" * 60)
    print("Batch Processing Summary")
    print("=" * 60)
    
    for item in all_results:
        video = os.path.basename(item['video'])
        results = item['results']
        has_hologram = len(results['verified_holograms']) > 0
        
        print(f"{video}: {'HOLOGRAM DETECTED' if has_hologram else 'No hologram'}")
        if has_hologram:
            avg_conf = results.get('avg_confidence', 0)
            print(f"  Average confidence: {avg_conf:.3f}")


def example_real_time_webcam():
    """
    Example: Real-time hologram detection from webcam with optimizations.
    """
    print("Real-time Webcam Detection")
    print("-" * 60)
    
    # Optimized for real-time performance
    verifier = HologramVerifier(
        feature_detector='orb',      # ORB is faster than SIFT
        buffer_size=20,              # Smaller buffer for faster response
        update_interval=5,           # More frequent updates
        confidence_threshold=0.5     # Lower threshold for sensitivity
    )
    
    VIDEO_SOURCE = 0
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    
    # Set camera properties for better performance
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
    cap.set(cv2.CAP_PROP_FPS, 30)
    
    print("Webcam initialized. Hold ID document with hologram in view.")
    print("Press 'q' to quit, 's' to save screenshot, 'r' to reset")
    
    frame_count = 0
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Process every other frame for better performance
            if frame_count % 2 == 0:
                result_frame, detections = verifier.process_frame(frame)
            else:
                result_frame = frame
            
            # Display FPS
            stats = verifier.get_statistics()
            fps_text = f"FPS: {stats['fps']:.1f}"
            cv2.putText(result_frame, fps_text, (10, result_frame.shape[0] - 10),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
            
            cv2.imshow('Real-time Hologram Detection', result_frame)
            
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q'):
                break
            elif key == ord('s'):
                filename = f"screenshot_{frame_count}.jpg"
                cv2.imwrite(filename, result_frame)
                print(f"Saved {filename}")
            elif key == ord('r'):
                verifier.reset()
                print("Pipeline reset")
            
            frame_count += 1
    
    finally:
        cap.release()
        cv2.destroyAllWindows()


def example_save_visualizations():
    """
    Example: Save visualization images for analysis.
    """
    print("Save Visualizations Example")
    print("-" * 60)
    
    VIDEO_SOURCE = 'data/test_video.mp4'
    OUTPUT_DIR = 'visualizations'
    
    if not os.path.exists(VIDEO_SOURCE):
        print(f"Error: Video not found at {VIDEO_SOURCE}")
        return
    
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    verifier = HologramVerifier()
    cap = cv2.VideoCapture(VIDEO_SOURCE)
    
    frame_count = 0
    save_interval = 30  # Save every 30 frames
    
    print(f"Processing video and saving visualizations to {OUTPUT_DIR}/")
    
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        
        result_frame, detections = verifier.process_frame(frame)
        
        # Save visualization every N frames
        if frame_count % save_interval == 0:
            viz = verifier.visualize_pipeline(frame)
            output_path = os.path.join(OUTPUT_DIR, f"viz_frame_{frame_count:04d}.jpg")
            cv2.imwrite(output_path, viz)
            print(f"Saved {output_path}")
        
        frame_count += 1
    
    cap.release()
    print(f"\nProcessing complete. {frame_count} frames processed.")


if __name__ == "__main__":
    print("Advanced Hologram Verification Examples")
    print("=" * 60)
    print()
    print("Available examples:")
    print("1. Train ML classifier")
    print("2. Custom configuration")
    print("3. Batch processing")
    print("4. Real-time webcam")
    print("5. Save visualizations")
    print()
    
    choice = input("Select example (1-5, or 'all' to run default): ").strip()
    
    if choice == '1':
        example_train_ml_classifier()
    elif choice == '2':
        example_custom_configuration()
    elif choice == '3':
        example_batch_processing()
    elif choice == '4':
        example_real_time_webcam()
    elif choice == '5':
        example_save_visualizations()
    else:
        # Run default real-time example
        example_real_time_webcam()
