"""
FrameAligner: Register consecutive frames to a reference frame.
Reference: Pouliquen et al. - Critical for background estimation.
"""

import cv2
import numpy as np
from typing import Optional, Tuple


class FrameAligner:
    """
    Aligns consecutive video frames to a reference frame using feature-based registration.
    
    This class implements frame alignment using ORB or SIFT feature detection,
    followed by homography computation with RANSAC for robust registration.
    
    Reference:
        Pouliquen et al. - Frame alignment is critical for temporal analysis
        and background estimation in hologram detection.
    
    Attributes:
        feature_detector (str): Type of feature detector ('orb' or 'sift')
        max_features (int): Maximum number of features to detect
        reference_frame (np.ndarray): The reference frame for alignment
        matcher: Feature matcher object (BFMatcher or FLANN)
    """
    
    def __init__(self, feature_detector: str = 'orb', max_features: int = 5000):
        """
        Initialize the FrameAligner.
        
        Args:
            feature_detector: Feature detection algorithm ('orb' or 'sift')
            max_features: Maximum number of features to detect
        """
        self.feature_detector = feature_detector.lower()
        self.max_features = max_features
        self.reference_frame = None
        self.reference_keypoints = None
        self.reference_descriptors = None
        
        # Initialize feature detector
        if self.feature_detector == 'orb':
            self.detector = cv2.ORB_create(nfeatures=max_features)
            # Use BFMatcher with Hamming distance for ORB
            self.matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)
        elif self.feature_detector == 'sift':
            self.detector = cv2.SIFT_create(nfeatures=max_features)
            # Use FLANN matcher for SIFT
            FLANN_INDEX_KDTREE = 1
            index_params = dict(algorithm=FLANN_INDEX_KDTREE, trees=5)
            search_params = dict(checks=50)
            self.matcher = cv2.FlannBasedMatcher(index_params, search_params)
        else:
            raise ValueError("Feature detector must be 'orb' or 'sift'")
    
    def set_reference_frame(self, frame: np.ndarray) -> None:
        """
        Set the reference frame for alignment.
        
        Args:
            frame: Reference frame (BGR image)
        """
        # Convert to grayscale for feature detection
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        
        # Detect keypoints and compute descriptors
        self.reference_keypoints, self.reference_descriptors = self.detector.detectAndCompute(gray, None)
        
        if self.reference_descriptors is None or len(self.reference_keypoints) < 10:
            raise ValueError("Reference frame does not contain enough features")
        
        self.reference_frame = frame.copy()
    
    def align_frame(self, frame: np.ndarray, ransac_threshold: float = 5.0) -> Tuple[np.ndarray, Optional[np.ndarray], bool]:
        """
        Align a frame to the reference frame using feature matching and homography.
        
        Algorithm:
        1. Detect keypoints in the current frame
        2. Match features with the reference frame
        3. Compute homography matrix using RANSAC
        4. Warp the frame to align with the reference
        
        Args:
            frame: Input frame to align (BGR image)
            ransac_threshold: RANSAC reprojection threshold in pixels
            
        Returns:
            Tuple containing:
                - Aligned frame (BGR image)
                - Homography matrix (3x3) or None if alignment failed
                - Success flag (bool)
        """
        if self.reference_frame is None:
            raise ValueError("Reference frame not set. Call set_reference_frame() first.")
        
        # Convert to grayscale
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        
        # Detect keypoints and compute descriptors
        keypoints, descriptors = self.detector.detectAndCompute(gray, None)
        
        if descriptors is None or len(keypoints) < 10:
            # Not enough features, return original frame
            return frame, None, False
        
        # Match features
        try:
            if self.feature_detector == 'orb':
                matches = self.matcher.knnMatch(self.reference_descriptors, descriptors, k=2)
            else:
                matches = self.matcher.knnMatch(self.reference_descriptors, descriptors, k=2)
            
            # Apply Lowe's ratio test
            good_matches = []
            for match_pair in matches:
                if len(match_pair) == 2:
                    m, n = match_pair
                    if m.distance < 0.75 * n.distance:
                        good_matches.append(m)
            
            if len(good_matches) < 10:
                # Not enough good matches
                return frame, None, False
            
            # Extract matched keypoint coordinates
            ref_pts = np.float32([self.reference_keypoints[m.queryIdx].pt for m in good_matches]).reshape(-1, 1, 2)
            curr_pts = np.float32([keypoints[m.trainIdx].pt for m in good_matches]).reshape(-1, 1, 2)
            
            # Compute homography using RANSAC
            homography, mask = cv2.findHomography(curr_pts, ref_pts, cv2.RANSAC, ransac_threshold)
            
            if homography is None:
                return frame, None, False
            
            # Warp the frame to align with reference
            h, w = self.reference_frame.shape[:2]
            aligned_frame = cv2.warpPerspective(frame, homography, (w, h))
            
            return aligned_frame, homography, True
            
        except Exception as e:
            print(f"Error during frame alignment: {e}")
            return frame, None, False
    
    def update_reference_frame(self, frame: np.ndarray, alpha: float = 0.1) -> None:
        """
        Update the reference frame using exponential moving average.
        
        This can be used to create a running average reference that adapts
        to gradual changes in the scene.
        
        Args:
            frame: New frame to incorporate into reference
            alpha: Weight for new frame (0 < alpha < 1)
        """
        if self.reference_frame is None:
            self.set_reference_frame(frame)
        else:
            # Update reference using exponential moving average
            self.reference_frame = cv2.addWeighted(
                self.reference_frame, 1 - alpha,
                frame, alpha, 0
            )
            # Re-compute features for updated reference
            self.set_reference_frame(self.reference_frame)
    
    def get_alignment_quality(self, frame: np.ndarray) -> float:
        """
        Estimate the quality of alignment for a given frame.
        
        Returns a score between 0 and 1, where higher values indicate
        better alignment quality based on the number of inlier matches.
        
        Args:
            frame: Frame to evaluate
            
        Returns:
            Alignment quality score (0 to 1)
        """
        if self.reference_frame is None:
            return 0.0
        
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if len(frame.shape) == 3 else frame
        keypoints, descriptors = self.detector.detectAndCompute(gray, None)
        
        if descriptors is None:
            return 0.0
        
        try:
            matches = self.matcher.knnMatch(self.reference_descriptors, descriptors, k=2)
            good_matches = []
            for match_pair in matches:
                if len(match_pair) == 2:
                    m, n = match_pair
                    if m.distance < 0.75 * n.distance:
                        good_matches.append(m)
            
            # Quality score based on number of good matches
            max_possible_matches = min(len(self.reference_keypoints), len(keypoints))
            quality = len(good_matches) / max(max_possible_matches, 1)
            
            return min(quality, 1.0)
        except:
            return 0.0
