"""
DynamicBehaviorVerifier: Verify hologram "flash" effect using background subtraction.
Reference: Pouliquen et al. Paper - Dynamic behavior analysis for fraud detection.
"""

import cv2
import numpy as np
from typing import List, Tuple, Optional
from collections import deque
from sklearn.linear_model import SGDClassifier
from skimage.feature import hog


class DynamicBehaviorVerifier:
    """
    Verifies dynamic hologram behavior by suppressing static background.
    
    This class implements background estimation and difference imaging to detect
    the "flash" effect characteristic of real holograms. It distinguishes between
    genuine dynamic holograms and static printed fraud attempts.
    
    Reference:
        Pouliquen et al. - "Dynamic Analysis for Hologram Authentication"
        
    Key Insight:
        - Real holograms: High energy in difference image (Hue channel)
        - Photocopies/static fraud: Near-zero energy after alignment
        - Background subtraction reveals temporal dynamics
    
    Algorithm:
        1. Estimate background using median of K aligned frames
        2. Compute difference: |current_frame - background|
        3. Extract HOG features from difference image in candidate regions
        4. Classify using SGD or heuristic (high hue energy = hologram)
    
    Attributes:
        background_frames (int): Number of frames for background estimation
        background_model (np.ndarray): Estimated background image
        frame_buffer (deque): Buffer of recent aligned frames
        classifier (SGDClassifier): Optional ML classifier
    """
    
    def __init__(self, background_frames: int = 15, use_classifier: bool = False,
                 hue_energy_threshold: float = 0.15):
        """
        Initialize the DynamicBehaviorVerifier.
        
        Args:
            background_frames: Number of frames to use for background estimation
            use_classifier: Whether to use ML classifier (requires training)
            hue_energy_threshold: Threshold for hue energy in heuristic mode (0-1)
        """
        self.background_frames = background_frames
        self.use_classifier = use_classifier
        self.hue_energy_threshold = hue_energy_threshold
        
        # Frame buffer for background estimation
        self.frame_buffer = deque(maxlen=background_frames)
        self.background_model = None
        
        # Optional ML classifier
        self.classifier = None
        if use_classifier:
            self.classifier = SGDClassifier(
                loss='log_loss',  # Logistic regression
                penalty='l2',
                alpha=0.0001,
                max_iter=1000,
                random_state=42
            )
            self.classifier_trained = False
        
        self.frame_count = 0
    
    def add_frame(self, aligned_frame: np.ndarray) -> None:
        """
        Add an aligned frame to the buffer and update background model.
        
        Args:
            aligned_frame: Frame aligned to reference (BGR format)
        """
        self.frame_buffer.append(aligned_frame.copy())
        self.frame_count += 1
        
        # Update background model if we have enough frames
        if len(self.frame_buffer) >= self.background_frames // 2:
            self._update_background_model()
    
    def _update_background_model(self) -> None:
        """
        Update the background model using median of buffered frames.
        
        The median operation effectively removes transient foreground objects
        (like holograms) and retains the static background.
        """
        if len(self.frame_buffer) < 3:
            return
        
        # Stack frames and compute median
        frame_stack = np.array(list(self.frame_buffer), dtype=np.float32)
        self.background_model = np.median(frame_stack, axis=0).astype(np.uint8)
    
    def compute_difference_image(self, current_frame: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute difference between current frame and background model.
        
        Args:
            current_frame: Current aligned frame (BGR format)
            
        Returns:
            Tuple of (difference_image_bgr, difference_image_hsv)
        """
        if self.background_model is None:
            # No background model yet, return zeros
            return np.zeros_like(current_frame), np.zeros_like(current_frame)
        
        # Compute absolute difference
        diff_bgr = cv2.absdiff(current_frame, self.background_model)
        
        # Convert to HSV for hue analysis
        current_hsv = cv2.cvtColor(current_frame, cv2.COLOR_BGR2HSV)
        background_hsv = cv2.cvtColor(self.background_model, cv2.COLOR_BGR2HSV)
        diff_hsv = cv2.absdiff(current_hsv, background_hsv)
        
        return diff_bgr, diff_hsv
    
    def _extract_hog_features(self, region: np.ndarray) -> np.ndarray:
        """
        Extract HOG (Histogram of Oriented Gradients) features from a region.
        
        Args:
            region: Image region (grayscale or BGR)
            
        Returns:
            HOG feature vector
        """
        # Convert to grayscale if needed
        if len(region.shape) == 3:
            region_gray = cv2.cvtColor(region, cv2.COLOR_BGR2GRAY)
        else:
            region_gray = region
        
        # Resize to standard size for consistent feature dimensions
        region_resized = cv2.resize(region_gray, (64, 64))
        
        # Extract HOG features
        features = hog(
            region_resized,
            orientations=9,
            pixels_per_cell=(8, 8),
            cells_per_block=(2, 2),
            block_norm='L2-Hys',
            visualize=False,
            feature_vector=True
        )
        
        return features
    
    def _compute_hue_energy(self, diff_hsv: np.ndarray, mask: Optional[np.ndarray] = None) -> float:
        """
        Compute energy (variance) in the Hue channel of difference image.
        
        Holograms show high hue energy in difference image due to color changes.
        
        Args:
            diff_hsv: Difference image in HSV space
            mask: Optional mask to focus on specific region
            
        Returns:
            Normalized hue energy (0-1)
        """
        hue_diff = diff_hsv[:, :, 0].astype(np.float32)
        
        if mask is not None:
            hue_diff = hue_diff[mask > 0]
        
        if len(hue_diff) == 0:
            return 0.0
        
        # Compute normalized variance
        hue_variance = np.var(hue_diff) / (179.0 ** 2)  # Normalize by max hue value squared
        
        return float(hue_variance)
    
    def verify_region_heuristic(self, current_frame: np.ndarray, 
                                region: Tuple[int, int, int, int]) -> Tuple[bool, float]:
        """
        Verify a region using heuristic approach (no ML training required).
        
        Heuristic: A real hologram shows high energy in the hue channel of
        the difference image, while static fraud shows near-zero energy.
        
        Args:
            current_frame: Current aligned frame (BGR format)
            region: Bounding box as (x, y, w, h)
            
        Returns:
            Tuple of (is_hologram, confidence_score)
        """
        if self.background_model is None:
            return False, 0.0
        
        x, y, w, h = region
        
        # Extract region from current frame and difference image
        _, diff_hsv = self.compute_difference_image(current_frame)
        
        # Create mask for region
        mask = np.zeros(diff_hsv.shape[:2], dtype=np.uint8)
        mask[y:y+h, x:x+w] = 255
        
        # Compute hue energy in the region
        hue_energy = self._compute_hue_energy(diff_hsv, mask)
        
        # Also consider saturation difference
        sat_diff = diff_hsv[:, :, 1][mask > 0]
        sat_energy = np.var(sat_diff) / (255.0 ** 2) if len(sat_diff) > 0 else 0.0
        
        # Combined score
        combined_energy = 0.7 * hue_energy + 0.3 * sat_energy
        
        # Threshold decision
        is_hologram = combined_energy > self.hue_energy_threshold
        confidence = min(combined_energy / self.hue_energy_threshold, 1.0)
        
        return is_hologram, confidence
    
    def verify_region_ml(self, current_frame: np.ndarray,
                        region: Tuple[int, int, int, int]) -> Tuple[bool, float]:
        """
        Verify a region using ML classifier (requires prior training).
        
        Args:
            current_frame: Current aligned frame (BGR format)
            region: Bounding box as (x, y, w, h)
            
        Returns:
            Tuple of (is_hologram, confidence_score)
        """
        if not self.use_classifier or not self.classifier_trained:
            # Fall back to heuristic
            return self.verify_region_heuristic(current_frame, region)
        
        x, y, w, h = region
        
        # Get difference image
        diff_bgr, _ = self.compute_difference_image(current_frame)
        
        # Extract region
        region_diff = diff_bgr[y:y+h, x:x+w]
        
        if region_diff.size == 0:
            return False, 0.0
        
        # Extract HOG features
        features = self._extract_hog_features(region_diff)
        features = features.reshape(1, -1)
        
        # Predict
        prediction = self.classifier.predict(features)[0]
        
        # Get confidence (probability)
        if hasattr(self.classifier, 'predict_proba'):
            confidence = self.classifier.predict_proba(features)[0][1]
        else:
            # Use decision function as proxy for confidence
            decision = self.classifier.decision_function(features)[0]
            confidence = 1.0 / (1.0 + np.exp(-decision))  # Sigmoid
        
        is_hologram = bool(prediction == 1)
        
        return is_hologram, float(confidence)
    
    def verify_regions(self, current_frame: np.ndarray,
                      regions: List[Tuple[int, int, int, int]]) -> List[dict]:
        """
        Verify multiple regions.
        
        Args:
            current_frame: Current aligned frame (BGR format)
            regions: List of bounding boxes as (x, y, w, h)
            
        Returns:
            List of dictionaries with verification results
        """
        results = []
        
        for region in regions:
            if self.use_classifier and self.classifier_trained:
                is_hologram, confidence = self.verify_region_ml(current_frame, region)
            else:
                is_hologram, confidence = self.verify_region_heuristic(current_frame, region)
            
            results.append({
                'bbox': region,
                'is_hologram': is_hologram,
                'confidence': confidence
            })
        
        return results
    
    def train_classifier(self, X_train: np.ndarray, y_train: np.ndarray) -> None:
        """
        Train the ML classifier with labeled data.
        
        Args:
            X_train: Feature vectors (N x D array)
            y_train: Labels (N array, 0=fake, 1=real hologram)
        """
        if not self.use_classifier:
            raise ValueError("Classifier not enabled. Set use_classifier=True in constructor.")
        
        self.classifier.fit(X_train, y_train)
        self.classifier_trained = True
    
    def extract_training_features(self, frames: List[np.ndarray],
                                  regions: List[Tuple[int, int, int, int]]) -> List[np.ndarray]:
        """
        Extract HOG features from difference images for training.
        
        Args:
            frames: List of aligned frames
            regions: List of bounding boxes
            
        Returns:
            List of feature vectors
        """
        features_list = []
        
        # Build background model from frames
        for frame in frames:
            self.add_frame(frame)
        
        # Extract features for each region
        for frame in frames:
            diff_bgr, _ = self.compute_difference_image(frame)
            
            for x, y, w, h in regions:
                region_diff = diff_bgr[y:y+h, x:x+w]
                if region_diff.size > 0:
                    features = self._extract_hog_features(region_diff)
                    features_list.append(features)
        
        return features_list
    
    def visualize_difference(self, current_frame: np.ndarray) -> np.ndarray:
        """
        Create visualization of difference image analysis.
        
        Args:
            current_frame: Current frame (BGR format)
            
        Returns:
            Visualization image
        """
        if self.background_model is None:
            return current_frame
        
        diff_bgr, diff_hsv = self.compute_difference_image(current_frame)
        
        # Extract channels
        diff_hue = diff_hsv[:, :, 0]
        diff_sat = diff_hsv[:, :, 1]
        
        # Create colored visualizations
        hue_viz = cv2.applyColorMap(diff_hue, cv2.COLORMAP_JET)
        sat_viz = cv2.applyColorMap(diff_sat, cv2.COLORMAP_HOT)
        
        # Resize for display
        h, w = current_frame.shape[:2]
        new_size = (w // 2, h // 2)
        
        frame_small = cv2.resize(current_frame, new_size)
        bg_small = cv2.resize(self.background_model, new_size)
        diff_small = cv2.resize(diff_bgr, new_size)
        hue_small = cv2.resize(hue_viz, new_size)
        
        # Add labels
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(frame_small, 'Current', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(bg_small, 'Background', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(diff_small, 'Difference', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(hue_small, 'Hue Diff', (10, 20), font, 0.5, (255, 255, 255), 1)
        
        # Combine
        row1 = np.hstack([frame_small, bg_small])
        row2 = np.hstack([diff_small, hue_small])
        
        visualization = np.vstack([row1, row2])
        
        return visualization
    
    def reset(self) -> None:
        """Reset background model and frame buffer."""
        self.frame_buffer.clear()
        self.background_model = None
        self.frame_count = 0
