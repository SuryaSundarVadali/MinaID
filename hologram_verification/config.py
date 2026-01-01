"""
Configuration file for hologram verification system
"""

# Feature Detection Configuration
FEATURE_DETECTOR = 'orb'  # 'orb' or 'sift'
MAX_FEATURES = 5000
RANSAC_THRESHOLD = 5.0

# Chromaticity Accumulation Configuration
BUFFER_SIZE = 30
SATURATION_THRESHOLD = 0.2
HIGHLIGHT_THRESHOLD = 250

# HSV Region Selection Configuration
S_PERCENTILE = 70.0
V_PERCENTILE = 60.0
MIN_REGION_AREA = 100
HUE_VARIANCE_THRESHOLD = 0.15

# Dynamic Behavior Verification Configuration
BACKGROUND_FRAMES = 15
HUE_ENERGY_THRESHOLD = 0.15
USE_ML_CLASSIFIER = False

# Pipeline Configuration
UPDATE_INTERVAL = 10
CONFIDENCE_THRESHOLD = 0.6

# Video Processing Configuration
DISPLAY_RESULTS = True
SAVE_OUTPUT = False
OUTPUT_PATH = 'output_hologram_detection.mp4'
MAX_FRAMES = None  # None for unlimited

# Real-time Processing Optimization
PROCESS_EVERY_N_FRAMES = 1  # Set to 2 for every other frame
RESIZE_INPUT = False
INPUT_WIDTH = 640
INPUT_HEIGHT = 480

# Visualization Configuration
SHOW_HOLOGRAM_MAP = True
SHOW_BOUNDING_BOXES = True
SHOW_CONFIDENCE_SCORES = True
SHOW_FPS = True

# Color Configuration for Display
COLOR_HIGH_CONFIDENCE = (0, 255, 0)     # Green
COLOR_MEDIUM_CONFIDENCE = (0, 255, 255)  # Yellow
COLOR_LOW_CONFIDENCE = (0, 165, 255)     # Orange

# Logging Configuration
VERBOSE = True
LOG_FILE = 'hologram_detection.log'

# Dataset Paths (for training)
REAL_HOLOGRAM_DATA_DIR = 'data/real_holograms'
FAKE_HOLOGRAM_DATA_DIR = 'data/fake_holograms'
TEST_DATA_DIR = 'data/test'

# Model Paths
CLASSIFIER_MODEL_PATH = 'models/hologram_classifier.pkl'
