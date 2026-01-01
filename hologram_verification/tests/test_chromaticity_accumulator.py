"""
Unit tests for ChromaticityAccumulator
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import unittest
import numpy as np
import cv2
from chromaticity_accumulator import ChromaticityAccumulator


class TestChromaticityAccumulator(unittest.TestCase):
    
    def setUp(self):
        """Create test frames with varying colors."""
        self.frames = []
        
        # Create frames with color variations (simulating hologram)
        for i in range(10):
            frame = np.zeros((240, 320, 3), dtype=np.uint8)
            # Add a region with varying hue
            hue = int(i * 18)  # Cycle through hues
            hsv = np.zeros((100, 100, 3), dtype=np.uint8)
            hsv[:, :, 0] = hue
            hsv[:, :, 1] = 255  # High saturation
            hsv[:, :, 2] = 200  # Good brightness
            
            region_bgr = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
            frame[70:170, 110:210] = region_bgr
            
            self.frames.append(frame)
    
    def test_initialization(self):
        """Test accumulator initialization."""
        acc = ChromaticityAccumulator(buffer_size=30)
        self.assertEqual(acc.buffer_size, 30)
        self.assertFalse(acc.initialized)
    
    def test_add_frame(self):
        """Test adding frames."""
        acc = ChromaticityAccumulator(buffer_size=10)
        
        for frame in self.frames:
            acc.add_frame(frame)
        
        self.assertTrue(acc.initialized)
        self.assertEqual(acc.frame_count, len(self.frames))
        self.assertEqual(len(acc.frame_buffer), len(self.frames))
    
    def test_generate_hologram_map(self):
        """Test hologram map generation."""
        acc = ChromaticityAccumulator(buffer_size=10)
        
        for frame in self.frames:
            acc.add_frame(frame)
        
        hologram_map = acc.generate_hologram_map(normalize=True)
        
        self.assertIsNotNone(hologram_map)
        self.assertEqual(hologram_map.shape[:2], self.frames[0].shape[:2])
        
        # Check that hologram region has high values
        roi = hologram_map[70:170, 110:210]
        self.assertGreater(np.mean(roi), np.mean(hologram_map))
    
    def test_get_hologram_regions(self):
        """Test region extraction."""
        acc = ChromaticityAccumulator(buffer_size=10)
        
        for frame in self.frames:
            acc.add_frame(frame)
        
        regions = acc.get_hologram_regions(threshold=0.3)
        
        # Should detect at least one region
        self.assertGreater(len(regions), 0)
    
    def test_reset(self):
        """Test reset functionality."""
        acc = ChromaticityAccumulator(buffer_size=10)
        
        for frame in self.frames:
            acc.add_frame(frame)
        
        acc.reset()
        
        self.assertFalse(acc.initialized)
        self.assertEqual(acc.frame_count, 0)
        self.assertEqual(len(acc.frame_buffer), 0)


if __name__ == '__main__':
    unittest.main()
