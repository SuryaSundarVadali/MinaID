"""
HsvRegionSelector: Fast, single-frame region proposal for hologram detection.
Reference: Kada et al. Paper - Adaptive HSV-based region selection.
"""

import cv2
import numpy as np
from typing import List, Tuple


class HsvRegionSelector:
    """
    Fast region proposal mechanism using HSV color space analysis.
    
    This class implements a single-frame approach to quickly identify potential
    hologram regions based on adaptive thresholds for Saturation and Value channels,
    combined with hue variance analysis.
    
    Reference:
        Kada et al. - "Fast Hologram Detection Using Adaptive HSV Thresholding"
        
    Algorithm:
        1. Convert frame to HSV
        2. Compute S and V histograms
        3. Determine adaptive thresholds (T_s, T_v) from histogram peaks
        4. Create binary mask: (S > T_s) AND (V > T_v)
        5. Apply morphological operations
        6. Filter regions with high hue variance ("flashy" colors)
    
    Attributes:
        s_percentile (float): Percentile for saturation threshold
        v_percentile (float): Percentile for value threshold
        min_region_area (int): Minimum area for valid regions
        hue_variance_threshold (float): Minimum hue variance for "flashy" regions
    """
    
    def __init__(self, s_percentile: float = 70.0, v_percentile: float = 60.0,
                 min_region_area: int = 100, hue_variance_threshold: float = 0.15):
        """
        Initialize the HsvRegionSelector.
        
        Args:
            s_percentile: Percentile for adaptive saturation threshold (0-100)
            v_percentile: Percentile for adaptive value threshold (0-100)
            min_region_area: Minimum pixel area for valid regions
            hue_variance_threshold: Minimum normalized hue variance (0-1)
        """
        self.s_percentile = s_percentile
        self.v_percentile = v_percentile
        self.min_region_area = min_region_area
        self.hue_variance_threshold = hue_variance_threshold
    
    def _compute_adaptive_thresholds(self, hsv_frame: np.ndarray) -> Tuple[int, int]:
        """
        Compute adaptive thresholds for Saturation and Value channels.
        
        Uses histogram analysis to find thresholds that separate colorful/bright
        regions from background.
        
        Args:
            hsv_frame: Frame in HSV color space
            
        Returns:
            Tuple of (saturation_threshold, value_threshold)
        """
        # Extract S and V channels
        s_channel = hsv_frame[:, :, 1]
        v_channel = hsv_frame[:, :, 2]
        
        # Compute thresholds based on percentiles
        # This adapts to the lighting conditions of each frame
        s_threshold = np.percentile(s_channel, self.s_percentile)
        v_threshold = np.percentile(v_channel, self.v_percentile)
        
        # Ensure minimum thresholds to avoid noise
        s_threshold = max(s_threshold, 40)  # Minimum saturation
        v_threshold = max(v_threshold, 50)  # Minimum brightness
        
        return int(s_threshold), int(v_threshold)
    
    def _compute_hue_variance(self, hsv_frame: np.ndarray, mask: np.ndarray) -> float:
        """
        Compute hue variance within a masked region.
        
        Holograms typically show high hue variance due to color shifting.
        
        Args:
            hsv_frame: Frame in HSV color space
            mask: Binary mask for the region
            
        Returns:
            Normalized hue variance (0-1)
        """
        if np.sum(mask) == 0:
            return 0.0
        
        # Extract hue values in the masked region
        hue_channel = hsv_frame[:, :, 0]
        hue_values = hue_channel[mask > 0]
        
        if len(hue_values) < 10:
            return 0.0
        
        # Hue is circular (0-179 in OpenCV), so we need circular variance
        # Convert to angles and compute circular variance
        angles = hue_values.astype(np.float32) * 2.0  # Scale to [0, 358]
        angles_rad = np.deg2rad(angles)
        
        # Circular mean
        sin_mean = np.mean(np.sin(angles_rad))
        cos_mean = np.mean(np.cos(angles_rad))
        
        # Circular variance (1 - R, where R is mean resultant length)
        R = np.sqrt(sin_mean**2 + cos_mean**2)
        circular_variance = 1.0 - R
        
        return circular_variance
    
    def select_regions(self, frame: np.ndarray) -> Tuple[List[Tuple[int, int, int, int]], np.ndarray]:
        """
        Select potential hologram regions from a single frame.
        
        Args:
            frame: Input frame (BGR format)
            
        Returns:
            Tuple containing:
                - List of bounding boxes as (x, y, w, h)
                - Binary mask of selected regions
        """
        # Convert to HSV
        hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        
        # Compute adaptive thresholds
        s_threshold, v_threshold = self._compute_adaptive_thresholds(hsv_frame)
        
        # Create binary mask
        s_channel = hsv_frame[:, :, 1]
        v_channel = hsv_frame[:, :, 2]
        
        mask = ((s_channel > s_threshold) & (v_channel > v_threshold)).astype(np.uint8) * 255
        
        # Morphological operations to close gaps and remove noise
        kernel_close = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
        kernel_open = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
        
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel_close)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel_open)
        
        # Find connected components
        num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(
            mask, connectivity=8
        )
        
        # Filter regions based on area and hue variance
        selected_regions = []
        final_mask = np.zeros_like(mask)
        
        for i in range(1, num_labels):  # Skip background (label 0)
            x = stats[i, cv2.CC_STAT_LEFT]
            y = stats[i, cv2.CC_STAT_TOP]
            w = stats[i, cv2.CC_STAT_WIDTH]
            h = stats[i, cv2.CC_STAT_HEIGHT]
            area = stats[i, cv2.CC_STAT_AREA]
            
            # Check minimum area
            if area < self.min_region_area:
                continue
            
            # Create mask for this component
            component_mask = (labels == i).astype(np.uint8)
            
            # Check hue variance (flashy color profile)
            hue_var = self._compute_hue_variance(hsv_frame, component_mask)
            
            if hue_var > self.hue_variance_threshold:
                selected_regions.append((x, y, w, h))
                final_mask[component_mask > 0] = 255
        
        return selected_regions, final_mask
    
    def visualize_hsv_analysis(self, frame: np.ndarray) -> np.ndarray:
        """
        Create a visualization of HSV channel analysis.
        
        Args:
            frame: Input frame (BGR format)
            
        Returns:
            Visualization image showing H, S, V channels and threshold mask
        """
        hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        h, w = frame.shape[:2]
        
        # Get thresholds
        s_threshold, v_threshold = self._compute_adaptive_thresholds(hsv_frame)
        
        # Extract channels
        h_channel = hsv_frame[:, :, 0]
        s_channel = hsv_frame[:, :, 1]
        v_channel = hsv_frame[:, :, 2]
        
        # Normalize hue for visualization (0-179 -> 0-255)
        h_viz = (h_channel.astype(np.float32) / 179.0 * 255.0).astype(np.uint8)
        
        # Create threshold visualization
        threshold_mask = ((s_channel > s_threshold) & (v_channel > v_threshold)).astype(np.uint8) * 255
        
        # Stack horizontally: Original | H | S | V | Mask
        h_colored = cv2.applyColorMap(h_viz, cv2.COLORMAP_HSV)
        s_colored = cv2.applyColorMap(s_channel, cv2.COLORMAP_JET)
        v_colored = cv2.applyColorMap(v_channel, cv2.COLORMAP_GRAY)
        mask_colored = cv2.cvtColor(threshold_mask, cv2.COLOR_GRAY2BGR)
        
        # Resize for compact display
        scale = 0.5
        new_size = (int(w * scale), int(h * scale))
        
        frame_small = cv2.resize(frame, new_size)
        h_small = cv2.resize(h_colored, new_size)
        s_small = cv2.resize(s_colored, new_size)
        v_small = cv2.resize(v_colored, new_size)
        mask_small = cv2.resize(mask_colored, new_size)
        
        # Add labels
        font = cv2.FONT_HERSHEY_SIMPLEX
        cv2.putText(frame_small, 'Original', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(h_small, 'Hue', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(s_small, f'Sat (T={s_threshold})', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(v_small, f'Val (T={v_threshold})', (10, 20), font, 0.5, (255, 255, 255), 1)
        cv2.putText(mask_small, 'Mask', (10, 20), font, 0.5, (255, 255, 255), 1)
        
        # Combine
        row1 = np.hstack([frame_small, h_small, s_small])
        row2 = np.hstack([v_small, mask_small, np.zeros_like(mask_small)])
        
        visualization = np.vstack([row1, row2])
        
        return visualization
    
    def get_region_properties(self, frame: np.ndarray, regions: List[Tuple[int, int, int, int]]) -> List[dict]:
        """
        Extract properties for each detected region.
        
        Args:
            frame: Input frame (BGR format)
            regions: List of bounding boxes as (x, y, w, h)
            
        Returns:
            List of dictionaries with region properties
        """
        hsv_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
        properties = []
        
        for (x, y, w, h) in regions:
            # Extract region
            region_hsv = hsv_frame[y:y+h, x:x+w]
            
            # Create mask for region
            mask = np.ones((h, w), dtype=np.uint8)
            
            # Compute statistics
            h_mean = np.mean(region_hsv[:, :, 0])
            s_mean = np.mean(region_hsv[:, :, 1])
            v_mean = np.mean(region_hsv[:, :, 2])
            
            h_std = np.std(region_hsv[:, :, 0])
            s_std = np.std(region_hsv[:, :, 1])
            v_std = np.std(region_hsv[:, :, 2])
            
            # Hue variance
            hue_var = self._compute_hue_variance(region_hsv, mask)
            
            properties.append({
                'bbox': (x, y, w, h),
                'area': w * h,
                'hue_mean': h_mean,
                'sat_mean': s_mean,
                'val_mean': v_mean,
                'hue_std': h_std,
                'sat_std': s_std,
                'val_std': v_std,
                'hue_variance': hue_var
            })
        
        return properties
