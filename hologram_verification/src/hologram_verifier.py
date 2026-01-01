"""
HologramVerifier: Main pipeline orchestrator for hologram detection and verification.
Synthesizes algorithms from MIDV-Holo, Kada et al., and Pouliquen et al.
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional, Dict
import time
import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

try:
    from frame_aligner import FrameAligner
    from chromaticity_accumulator import ChromaticityAccumulator
    from hsv_region_selector import HsvRegionSelector
    from dynamic_behavior_verifier import DynamicBehaviorVerifier
except ImportError:
    from .frame_aligner import FrameAligner
    from .chromaticity_accumulator import ChromaticityAccumulator
    from .hsv_region_selector import HsvRegionSelector
    from .dynamic_behavior_verifier import DynamicBehaviorVerifier


class HologramVerifier:
    """
    Main pipeline for hologram detection and verification in video streams.
    
    This class orchestrates the complete hologram verification workflow by
    combining multiple detection and verification algorithms:
    
    1. Frame alignment (Pouliquen et al.)
    2. Chromaticity accumulation (MIDV-Holo)
    3. HSV region selection (Kada et al.)
    4. Dynamic behavior verification (Pouliquen et al.)
    
    The pipeline processes video streams frame-by-frame, accumulates evidence
    over time, and outputs verified hologram regions with confidence scores.
    
    Attributes:
        frame_aligner (FrameAligner): Aligns frames to reference
        accumulator (ChromaticityAccumulator): Accumulates chromaticity statistics
        region_selector (HsvRegionSelector): Fast region proposal
        behavior_verifier (DynamicBehaviorVerifier): Verifies dynamic behavior
        update_interval (int): Frames between hologram map updates
    """
    
    def __init__(self, 
                 feature_detector: str = 'orb',
                 buffer_size: int = 30,
                 update_interval: int = 10,
                 use_ml_classifier: bool = False,
                 confidence_threshold: float = 0.6):
        """
        Initialize the HologramVerifier pipeline.
        
        Args:
            feature_detector: Feature detection algorithm ('orb' or 'sift')
            buffer_size: Number of frames for chromaticity accumulation
            update_interval: Frames between hologram map updates
            use_ml_classifier: Whether to use ML-based verification
            confidence_threshold: Minimum confidence for hologram detection (0-1)
        """
        # Initialize components
        self.frame_aligner = FrameAligner(feature_detector=feature_detector)
        self.accumulator = ChromaticityAccumulator(buffer_size=buffer_size)
        self.region_selector = HsvRegionSelector()
        self.behavior_verifier = DynamicBehaviorVerifier(use_classifier=use_ml_classifier)
        
        # Configuration
        self.update_interval = update_interval
        self.confidence_threshold = confidence_threshold
        
        # State
        self.frame_count = 0
        self.reference_set = False
        self.verified_regions = []
        self.processing_times = []
        
        # Results storage
        self.last_hologram_map = None
        self.last_regions = []
    
    def process_video_stream(self, video_source, 
                            display: bool = True,
                            save_output: Optional[str] = None,
                            max_frames: Optional[int] = None) -> Dict:
        """
        Process a video stream for hologram detection and verification.
        
        Args:
            video_source: Video file path, camera index, or VideoCapture object
            display: Whether to display results in real-time
            save_output: Optional path to save output video
            max_frames: Maximum number of frames to process (None = all)
            
        Returns:
            Dictionary with detection results and statistics
        """
        # Open video source
        if isinstance(video_source, (str, int)):
            cap = cv2.VideoCapture(video_source)
        else:
            cap = video_source
        
        if not cap.isOpened():
            raise ValueError(f"Cannot open video source: {video_source}")
        
        # Get video properties
        fps = int(cap.get(cv2.CAP_PROP_FPS)) or 30
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        
        print(f"Video properties: {width}x{height} @ {fps} FPS, {total_frames} frames")
        
        # Setup output video writer
        writer = None
        if save_output:
            fourcc = cv2.VideoWriter_fourcc(*'mp4v')
            writer = cv2.VideoWriter(save_output, fourcc, fps, (width, height))
        
        # Detection results
        detection_results = {
            'total_frames': 0,
            'frames_with_detections': 0,
            'verified_holograms': [],
            'avg_processing_time': 0.0,
            'confidence_scores': []
        }
        
        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break
                
                # Check max frames limit
                if max_frames and self.frame_count >= max_frames:
                    break
                
                start_time = time.time()
                
                # Process frame
                result_frame, detections = self.process_frame(frame)
                
                processing_time = time.time() - start_time
                self.processing_times.append(processing_time)
                
                # Update statistics
                detection_results['total_frames'] += 1
                if detections:
                    detection_results['frames_with_detections'] += 1
                    for det in detections:
                        detection_results['verified_holograms'].append({
                            'frame': self.frame_count,
                            'bbox': det['bbox'],
                            'confidence': det['confidence']
                        })
                        detection_results['confidence_scores'].append(det['confidence'])
                
                # Display
                if display:
                    # Add frame info
                    info_text = f"Frame: {self.frame_count} | FPS: {1.0/processing_time:.1f} | Detections: {len(detections)}"
                    cv2.putText(result_frame, info_text, (10, 30), 
                               cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                    
                    cv2.imshow('Hologram Verification', result_frame)
                    
                    key = cv2.waitKey(1) & 0xFF
                    if key == ord('q'):
                        break
                    elif key == ord('r'):
                        self.reset()
                
                # Save output
                if writer:
                    writer.write(result_frame)
                
        finally:
            cap.release()
            if writer:
                writer.release()
            if display:
                cv2.destroyAllWindows()
        
        # Compute final statistics
        if self.processing_times:
            detection_results['avg_processing_time'] = np.mean(self.processing_times)
        
        if detection_results['confidence_scores']:
            detection_results['avg_confidence'] = np.mean(detection_results['confidence_scores'])
            detection_results['max_confidence'] = np.max(detection_results['confidence_scores'])
        
        return detection_results
    
    def process_frame(self, frame: np.ndarray) -> Tuple[np.ndarray, List[Dict]]:
        """
        Process a single frame through the verification pipeline.
        
        Pipeline stages:
        1. Set reference frame (first frame)
        2. Align current frame to reference
        3. Add to chromaticity accumulator
        4. Periodically generate hologram map
        5. Use HSV selector for fast region proposals
        6. Verify regions with dynamic behavior analysis
        
        Args:
            frame: Input frame (BGR format)
            
        Returns:
            Tuple of (annotated_frame, list_of_detections)
        """
        self.frame_count += 1
        result_frame = frame.copy()
        detections = []
        
        # Stage 1: Set reference frame
        if not self.reference_set:
            self.frame_aligner.set_reference_frame(frame)
            self.reference_set = True
            return result_frame, detections
        
        # Stage 2: Align frame
        aligned_frame, homography, alignment_success = self.frame_aligner.align_frame(frame)
        
        if not alignment_success:
            # Skip frame if alignment failed
            cv2.putText(result_frame, "Alignment Failed", (10, 60),
                       cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2)
            return result_frame, detections
        
        # Stage 3: Add to accumulator
        self.accumulator.add_frame(aligned_frame)
        self.behavior_verifier.add_frame(aligned_frame)
        
        # Stage 4: Generate hologram map periodically
        candidate_regions = []
        
        if self.frame_count % self.update_interval == 0:
            # Get regions from chromaticity accumulator
            self.last_hologram_map = self.accumulator.generate_hologram_map(normalize=True)
            accumulator_regions = self.accumulator.get_hologram_regions(threshold=0.5)
            candidate_regions.extend(accumulator_regions)
        
        # Stage 5: Fast region proposals with HSV selector
        hsv_regions, hsv_mask = self.region_selector.select_regions(aligned_frame)
        candidate_regions.extend(hsv_regions)
        
        # Remove duplicate regions
        candidate_regions = self._merge_overlapping_regions(candidate_regions)
        
        # Stage 6: Verify regions with dynamic behavior
        if candidate_regions:
            verification_results = self.behavior_verifier.verify_regions(
                aligned_frame, candidate_regions
            )
            
            # Filter by confidence threshold
            for result in verification_results:
                if result['is_hologram'] and result['confidence'] >= self.confidence_threshold:
                    detections.append(result)
        
        # Annotate frame
        result_frame = self._annotate_frame(result_frame, detections)
        
        self.last_regions = detections
        return result_frame, detections
    
    def _merge_overlapping_regions(self, regions: List[Tuple[int, int, int, int]], 
                                   iou_threshold: float = 0.5) -> List[Tuple[int, int, int, int]]:
        """
        Merge overlapping bounding boxes using Non-Maximum Suppression.
        
        Args:
            regions: List of bounding boxes as (x, y, w, h)
            iou_threshold: IoU threshold for merging
            
        Returns:
            List of merged bounding boxes
        """
        if not regions:
            return []
        
        # Convert to (x1, y1, x2, y2) format
        boxes = []
        for (x, y, w, h) in regions:
            boxes.append([x, y, x + w, y + h])
        boxes = np.array(boxes)
        
        # Compute areas
        areas = (boxes[:, 2] - boxes[:, 0]) * (boxes[:, 3] - boxes[:, 1])
        
        # Sort by y2 coordinate
        indices = np.argsort(boxes[:, 3])
        
        keep = []
        while len(indices) > 0:
            i = indices[-1]
            keep.append(i)
            
            if len(indices) == 1:
                break
            
            # Compute IoU with remaining boxes
            xx1 = np.maximum(boxes[i, 0], boxes[indices[:-1], 0])
            yy1 = np.maximum(boxes[i, 1], boxes[indices[:-1], 1])
            xx2 = np.minimum(boxes[i, 2], boxes[indices[:-1], 2])
            yy2 = np.minimum(boxes[i, 3], boxes[indices[:-1], 3])
            
            w = np.maximum(0, xx2 - xx1)
            h = np.maximum(0, yy2 - yy1)
            
            intersection = w * h
            union = areas[i] + areas[indices[:-1]] - intersection
            iou = intersection / union
            
            # Remove overlapping boxes
            indices = indices[:-1][iou <= iou_threshold]
        
        # Convert back to (x, y, w, h) format
        merged_regions = []
        for i in keep:
            x1, y1, x2, y2 = boxes[i]
            merged_regions.append((int(x1), int(y1), int(x2 - x1), int(y2 - y1)))
        
        return merged_regions
    
    def _annotate_frame(self, frame: np.ndarray, detections: List[Dict]) -> np.ndarray:
        """
        Annotate frame with detection results.
        
        Args:
            frame: Input frame
            detections: List of detection dictionaries
            
        Returns:
            Annotated frame
        """
        annotated = frame.copy()
        
        for detection in detections:
            x, y, w, h = detection['bbox']
            confidence = detection['confidence']
            
            # Color based on confidence (green = high, yellow = medium)
            if confidence > 0.8:
                color = (0, 255, 0)  # Green
            elif confidence > 0.6:
                color = (0, 255, 255)  # Yellow
            else:
                color = (0, 165, 255)  # Orange
            
            # Draw bounding box
            cv2.rectangle(annotated, (x, y), (x + w, y + h), color, 2)
            
            # Draw label
            label = f"Hologram: {confidence:.2f}"
            label_size, _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
            label_y = max(y - 10, label_size[1])
            
            cv2.rectangle(annotated, (x, label_y - label_size[1] - 5), 
                         (x + label_size[0], label_y + 5), color, -1)
            cv2.putText(annotated, label, (x, label_y), 
                       cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 0), 1)
        
        return annotated
    
    def visualize_pipeline(self, frame: np.ndarray) -> np.ndarray:
        """
        Create comprehensive visualization of the pipeline stages.
        
        Args:
            frame: Input frame
            
        Returns:
            Visualization image showing all pipeline stages
        """
        if not self.reference_set:
            return frame
        
        # Process frame
        aligned_frame, _, _ = self.frame_aligner.align_frame(frame)
        
        # Get visualizations from each component
        hsv_viz = self.region_selector.visualize_hsv_analysis(aligned_frame)
        
        if self.last_hologram_map is not None:
            hologram_map_viz = cv2.applyColorMap(self.last_hologram_map, cv2.COLORMAP_JET)
        else:
            hologram_map_viz = np.zeros_like(frame)
        
        diff_viz = self.behavior_verifier.visualize_difference(aligned_frame)
        
        # Resize for consistent display
        h, w = frame.shape[:2]
        scale = 0.4
        new_size = (int(w * scale), int(h * scale))
        
        frame_small = cv2.resize(frame, new_size)
        aligned_small = cv2.resize(aligned_frame, new_size)
        holo_small = cv2.resize(hologram_map_viz, new_size)
        
        # Add labels
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(frame_small, 'Original', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(aligned_small, 'Aligned', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(holo_small, 'Hologram Map', (10, 20), font, 0.5, (255, 255, 255), 1)
        
        # Combine
        row1 = np.hstack([frame_small, aligned_small, holo_small])
        
        # Resize other visualizations to match
        hsv_viz = cv2.resize(hsv_viz, (row1.shape[1], hsv_viz.shape[0]))
        diff_viz = cv2.resize(diff_viz, (row1.shape[1], diff_viz.shape[0]))
        
        visualization = np.vstack([row1, hsv_viz, diff_viz])
        
        return visualization
    
    def reset(self) -> None:
        """Reset the pipeline to initial state."""
        self.frame_count = 0
        self.reference_set = False
        self.verified_regions = []
        self.processing_times = []
        self.last_hologram_map = None
        self.last_regions = []
        
        self.accumulator.reset()
        self.behavior_verifier.reset()
    
    def get_statistics(self) -> Dict:
        """
        Get pipeline statistics.
        
        Returns:
            Dictionary with processing statistics
        """
        stats = {
            'total_frames_processed': self.frame_count,
            'avg_processing_time': np.mean(self.processing_times) if self.processing_times else 0.0,
            'fps': 1.0 / np.mean(self.processing_times) if self.processing_times else 0.0,
            'last_detections_count': len(self.last_regions),
        }
        
        # Add accumulator statistics
        acc_stats = self.accumulator.get_statistics_map()
        if acc_stats:
            stats['accumulator_frame_count'] = acc_stats['frame_count']
        
        return stats
