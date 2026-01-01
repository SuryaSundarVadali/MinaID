"""
ChromaticityAccumulator: Detect hologram regions by analyzing pixel statistics over N frames.
Reference: MIDV-Holo Paper - Core hologram detection algorithm.
"""

import numpy as np
import cv2
from typing import Tuple, List
from collections import deque


class ChromaticityAccumulator:
    """
    Accumulates chromaticity statistics over multiple frames to detect hologram regions.
    
    This class implements the core algorithm from the MIDV-Holo paper, which exploits
    the fact that hologram pixels have high saturation but highly varying hue over time,
    resulting in low mean chromaticity vector magnitude.
    
    Reference:
        MIDV-Holo Paper: "Hologram Detection in Identity Documents Using 
        Chromaticity Analysis and Temporal Accumulation"
        
    Key Insight:
        - Holograms: High S_max, Low M (mean chromaticity magnitude)
        - Static print: High S_max, High M (consistent color)
        - Background: Low S_max
    
    Algorithm:
        For each pixel (i,j) over N frames:
        1. Compute Chromaticity Vector C based on dominant RGB channel
        2. Accumulate: S_max, sum(C), N
        3. Generate Hologram Map: High S_max AND Low ||sum(C)/N||
    
    Attributes:
        buffer_size (int): Number of frames to accumulate
        frame_buffer (deque): Buffer of aligned frames
        s_max (np.ndarray): Maximum saturation per pixel
        c_sum (np.ndarray): Sum of chromaticity vectors per pixel
        n_count (np.ndarray): Count of valid observations per pixel
    """
    
    def __init__(self, buffer_size: int = 30, saturation_threshold: float = 0.2,
                 highlight_threshold: int = 250):
        """
        Initialize the ChromaticityAccumulator.
        
        Args:
            buffer_size: Number of frames to accumulate for statistics
            saturation_threshold: Minimum saturation to consider (0-1)
            highlight_threshold: Brightness threshold to exclude highlights (0-255)
        """
        self.buffer_size = buffer_size
        self.saturation_threshold = saturation_threshold
        self.highlight_threshold = highlight_threshold
        
        # Frame buffer
        self.frame_buffer = deque(maxlen=buffer_size)
        
        # Accumulation arrays (initialized on first frame)
        self.s_max = None
        self.c_sum = None
        self.n_count = None
        
        self.initialized = False
        self.frame_count = 0
    
    def _compute_chromaticity_vector(self, frame: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Compute chromaticity vector C for each pixel in the frame.
        
        Formula (MIDV-Holo Equation 1):
            If max(R,G,B) = R: C = (G-B)/S
            If max(R,G,B) = G: C = (B-R)/S + 2
            If max(R,G,B) = B: C = (R-G)/S + 4
            
        Where S is saturation = (max(R,G,B) - min(R,G,B)) / max(R,G,B)
        
        Args:
            frame: Input frame (BGR format)
            
        Returns:
            Tuple of (chromaticity_vector, saturation_map)
        """
        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        
        R = frame_rgb[:, :, 0]
        G = frame_rgb[:, :, 1]
        B = frame_rgb[:, :, 2]
        
        # Compute max and min channels
        max_rgb = np.maximum(np.maximum(R, G), B)
        min_rgb = np.minimum(np.minimum(R, G), B)
        
        # Compute saturation (handle division by zero)
        epsilon = 1e-6
        saturation = np.where(max_rgb > epsilon, (max_rgb - min_rgb) / max_rgb, 0.0)
        
        # Identify dominant channel
        r_dominant = (R >= G) & (R >= B)
        g_dominant = (G >= R) & (G >= B)
        b_dominant = ~(r_dominant | g_dominant)
        
        # Initialize chromaticity vector
        C = np.zeros_like(saturation, dtype=np.float32)
        
        # Compute C based on dominant channel (with safe division)
        # R dominant: C = (G-B)/S
        mask = r_dominant & (saturation > epsilon)
        C[mask] = (G[mask] - B[mask]) / (saturation[mask] + epsilon)
        
        # G dominant: C = (B-R)/S + 2
        mask = g_dominant & (saturation > epsilon)
        C[mask] = (B[mask] - R[mask]) / (saturation[mask] + epsilon) + 2.0
        
        # B dominant: C = (R-G)/S + 4
        mask = b_dominant & (saturation > epsilon)
        C[mask] = (R[mask] - G[mask]) / (saturation[mask] + epsilon) + 4.0
        
        return C, saturation
    
    def add_frame(self, frame: np.ndarray) -> None:
        """
        Add an aligned frame to the accumulator and update statistics.
        
        Args:
            frame: Aligned frame (BGR format)
        """
        if not self.initialized:
            h, w = frame.shape[:2]
            self.s_max = np.zeros((h, w), dtype=np.float32)
            self.c_sum = np.zeros((h, w), dtype=np.float32)
            self.n_count = np.zeros((h, w), dtype=np.int32)
            self.initialized = True
        
        # Add frame to buffer
        self.frame_buffer.append(frame.copy())
        self.frame_count += 1
        
        # Compute chromaticity and saturation
        C, S = self._compute_chromaticity_vector(frame)
        
        # Create mask for valid pixels (exclude highlights and low saturation)
        frame_gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        valid_mask = (S > self.saturation_threshold) & (frame_gray < self.highlight_threshold)
        
        # Update S_max
        self.s_max = np.maximum(self.s_max, S)
        
        # Accumulate chromaticity sum (only for valid pixels)
        self.c_sum[valid_mask] += C[valid_mask]
        
        # Update count
        self.n_count[valid_mask] += 1
    
    def generate_hologram_map(self, normalize: bool = True) -> np.ndarray:
        """
        Generate the Hologram Map (Ĩ^hm) from accumulated statistics.
        
        The hologram map highlights regions where:
        - S_max is high (colorful regions)
        - ||mean(C)|| is low (high color variation over time)
        
        Formula:
            M = ||sum(C)/N|| = magnitude of mean chromaticity vector
            hologram_score = S_max * (1 - M_normalized)
            
        Higher scores indicate higher probability of hologram presence.
        
        Args:
            normalize: Whether to normalize output to [0, 255]
            
        Returns:
            Hologram map as float32 array
        """
        if not self.initialized or self.frame_count == 0:
            return np.zeros((480, 640), dtype=np.float32)
        
        # Compute mean chromaticity vector magnitude
        # Handle division by zero
        epsilon = 1e-6
        mean_C = np.where(self.n_count > 0, self.c_sum / (self.n_count + epsilon), 0.0)
        
        # Magnitude of mean chromaticity vector
        M = np.abs(mean_C)
        
        # Normalize M to [0, 1] range
        # Holograms have low M (approaching 0), static colors have high M
        M_max = np.max(M) if np.max(M) > epsilon else 1.0
        M_normalized = M / M_max
        
        # Hologram score: High S_max AND Low M
        # Formula: S_max * (1 - M_normalized)
        # This gives high values where saturation is high but mean color is low
        hologram_map = self.s_max * (1.0 - M_normalized)
        
        # Apply threshold based on minimum observation count
        min_observations = max(self.buffer_size // 3, 5)
        hologram_map[self.n_count < min_observations] = 0.0
        
        if normalize:
            # Normalize to [0, 255] for visualization
            if np.max(hologram_map) > epsilon:
                hologram_map = (hologram_map / np.max(hologram_map) * 255).astype(np.uint8)
            else:
                hologram_map = np.zeros_like(hologram_map, dtype=np.uint8)
        
        return hologram_map
    
    def get_hologram_regions(self, threshold: float = 0.5) -> List[Tuple[int, int, int, int]]:
        """
        Extract bounding boxes of potential hologram regions.
        
        Args:
            threshold: Threshold for hologram map (0-1)
            
        Returns:
            List of bounding boxes as (x, y, w, h) tuples
        """
        hologram_map = self.generate_hologram_map(normalize=False)
        
        # Threshold the map
        threshold_value = threshold * np.max(hologram_map) if np.max(hologram_map) > 0 else 0.1
        binary_map = (hologram_map > threshold_value).astype(np.uint8) * 255
        
        # Morphological operations to clean up
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        binary_map = cv2.morphologyEx(binary_map, cv2.MORPH_CLOSE, kernel)
        binary_map = cv2.morphologyEx(binary_map, cv2.MORPH_OPEN, kernel)
        
        # Find connected components
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(binary_map, connectivity=8)
        
        # Extract bounding boxes (skip background label 0)
        regions = []
        min_area = 100  # Minimum area threshold
        
        for i in range(1, num_labels):
            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]
            area = stats[i, cv2.CC_STAT_AREA]
            
            if area > min_area:
                regions.append((x, y, w, h))
        
        return regions
    
    def reset(self) -> None:
        """Reset all accumulated statistics."""
        self.frame_buffer.clear()
        self.s_max = None
        self.c_sum = None
        self.n_count = None
        self.initialized = False
        self.frame_count = 0
    
    def get_statistics_map(self) -> dict:
        """
        Get visualization of accumulated statistics.
        
        Returns:
            Dictionary with 's_max', 'mean_C', and 'n_count' arrays
        """
        if not self.initialized:
            return {}
        
        epsilon = 1e-6
        mean_C = np.where(self.n_count > 0, self.c_sum / (self.n_count + epsilon), 0.0)
        
        return {
            's_max': self.s_max,
            'mean_C': mean_C,
            'n_count': self.n_count,
            'frame_count': self.frame_count
        }
