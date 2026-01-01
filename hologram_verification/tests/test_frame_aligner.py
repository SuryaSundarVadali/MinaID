"""
Unit tests for FrameAligner
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import unittest
import numpy as np
import cv2
from frame_aligner import FrameAligner


class TestFrameAligner(unittest.TestCase):
    
    def setUp(self):
        """Create test frames."""
        # Create a simple test image with features
        self.reference_frame = np.zeros((480, 640, 3), dtype=np.uint8)
        cv2.rectangle(self.reference_frame, (100, 100), (200, 200), (255, 255, 255), -1)
        cv2.circle(self.reference_frame, (400, 300), 50, (255, 255, 255), -1)
        
        # Create a slightly translated version
        M = np.float32([[1, 0, 20], [0, 1, 10]])  # Translation matrix
        self.translated_frame = cv2.warpAffine(self.reference_frame, M, (640, 480))
    
    def test_initialization_orb(self):
        """Test ORB initialization."""
        aligner = FrameAligner(feature_detector='orb')
        self.assertEqual(aligner.feature_detector, 'orb')
        self.assertIsNotNone(aligner.detector)
        self.assertIsNotNone(aligner.matcher)
    
    def test_initialization_sift(self):
        """Test SIFT initialization."""
        aligner = FrameAligner(feature_detector='sift')
        self.assertEqual(aligner.feature_detector, 'sift')
        self.assertIsNotNone(aligner.detector)
        self.assertIsNotNone(aligner.matcher)
    
    def test_set_reference_frame(self):
        """Test setting reference frame."""
        aligner = FrameAligner()
        aligner.set_reference_frame(self.reference_frame)
        
        self.assertIsNotNone(aligner.reference_frame)
        self.assertIsNotNone(aligner.reference_keypoints)
        self.assertIsNotNone(aligner.reference_descriptors)
    
    def test_align_frame(self):
        """Test frame alignment."""
        aligner = FrameAligner()
        aligner.set_reference_frame(self.reference_frame)
        
        aligned_frame, homography, success = aligner.align_frame(self.translated_frame)
        
        self.assertTrue(success)
        self.assertIsNotNone(homography)
        self.assertEqual(aligned_frame.shape, self.reference_frame.shape)
    
    def test_alignment_quality(self):
        """Test alignment quality estimation."""
        aligner = FrameAligner()
        aligner.set_reference_frame(self.reference_frame)
        
        quality = aligner.get_alignment_quality(self.translated_frame)
        
        self.assertGreater(quality, 0.0)
        self.assertLessEqual(quality, 1.0)


if __name__ == '__main__':
    unittest.main()
