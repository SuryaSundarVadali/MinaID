"""
Hologram Detection and Verification System for Identity Documents
Based on academic papers: MIDV-Holo, Kada et al., and Pouliquen et al.
"""

from .frame_aligner import FrameAligner
from .chromaticity_accumulator import ChromaticityAccumulator
from .hsv_region_selector import HsvRegionSelector
from .dynamic_behavior_verifier import DynamicBehaviorVerifier
from .hologram_verifier import HologramVerifier

__version__ = "1.0.0"
__all__ = [
    "FrameAligner",
    "ChromaticityAccumulator",
    "HsvRegionSelector",
    "DynamicBehaviorVerifier",
    "HologramVerifier",
]
