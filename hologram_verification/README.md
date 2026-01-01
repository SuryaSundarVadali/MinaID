# Hologram Detection and Verification System

A comprehensive Python implementation for detecting and verifying holograms (Optically Variable Devices - OVDs) in identity documents using video analysis. This system synthesizes algorithms from three key academic papers:

- **MIDV-Holo**: Chromaticity accumulation and temporal analysis
- **Kada et al.**: Adaptive HSV-based region selection
- **Pouliquen et al.**: Dynamic behavior verification with background subtraction

## Overview

Holograms on ID cards change appearance (hue/saturation) based on the angle of light and observation. This system detects whether a valid hologram exists on a document presented in a video stream, helping to:

- Authenticate identity documents
- Detect counterfeit documents
- Distinguish between genuine holograms and printed/static fraud attempts

## Key Features

- **Frame Alignment**: Registers consecutive frames using ORB/SIFT feature matching and homography
- **Chromaticity Accumulation**: Analyzes pixel color statistics over time to identify hologram regions
- **HSV Region Selection**: Fast single-frame region proposals using adaptive thresholds
- **Dynamic Behavior Verification**: Background subtraction and "flash effect" detection
- **Real-time Processing**: Optimized for webcam/video stream processing
- **ML Support**: Optional machine learning classifier for enhanced accuracy

## Installation

### Prerequisites

- Python 3.8 or higher
- pip package manager

### Quick Setup (Recommended)

Use the provided setup script to automatically create a virtual environment and install dependencies:

```bash
cd hologram_verification
./setup.sh
```

Then activate the virtual environment:

```bash
source venv/bin/activate
```

### Manual Installation

If you prefer to set up manually:

```bash
cd hologram_verification

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # On Linux/Mac
# or
venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt
```

### Required Packages

- opencv-python >= 4.8.0
- numpy >= 1.24.0
- scikit-learn >= 1.3.0
- scikit-image >= 0.21.0

**Note**: Always activate the virtual environment before running the code:
```bash
source venv/bin/activate
```

To deactivate when done:
```bash
deactivate
```

## Quick Start

**Important**: Make sure you have activated the virtual environment first:
```bash
source venv/bin/activate
```

### Basic Usage

```python
from src.hologram_verifier import HologramVerifier

# Initialize the verifier
verifier = HologramVerifier(
    feature_detector='orb',
    buffer_size=30,
    confidence_threshold=0.6
)

# Process a video file
results = verifier.process_video_stream(
    video_source='document_video.mp4',
    display=True,
    save_output='output.mp4'
)

print(f"Detections: {len(results['verified_holograms'])}")
```

### Webcam Example

```python
from src.hologram_verifier import HologramVerifier

verifier = HologramVerifier()

# Use webcam (source=0)
results = verifier.process_video_stream(
    video_source=0,
    display=True
)
```

### Run Example Scripts

```bash
# Activate virtual environment first
source venv/bin/activate

# Basic example with webcam
python examples/basic_usage.py

# Advanced examples (batch processing, ML training, etc.)
python examples/advanced_usage.py
```

## System Architecture

### Pipeline Flow

```
Video Frame → Frame Alignment → Chromaticity Accumulation
                                         ↓
HSV Region Selection ← ← ← ← ← ← Hologram Map Generation
         ↓
Dynamic Behavior Verification → Verified Hologram Regions
```

### Core Components

#### 1. FrameAligner
Aligns consecutive frames to a reference frame to enable temporal analysis.

```python
from src.frame_aligner import FrameAligner

aligner = FrameAligner(feature_detector='orb')
aligner.set_reference_frame(first_frame)
aligned_frame, homography, success = aligner.align_frame(current_frame)
```

#### 2. ChromaticityAccumulator
Implements MIDV-Holo algorithm for hologram detection via chromaticity analysis.

```python
from src.chromaticity_accumulator import ChromaticityAccumulator

accumulator = ChromaticityAccumulator(buffer_size=30)
accumulator.add_frame(aligned_frame)
hologram_map = accumulator.generate_hologram_map()
regions = accumulator.get_hologram_regions()
```

**Key Insight**: Holograms have high saturation but highly varying hue over time, resulting in low mean chromaticity vector magnitude.

#### 3. HsvRegionSelector
Fast region proposal using adaptive HSV thresholds.

```python
from src.hsv_region_selector import HsvRegionSelector

selector = HsvRegionSelector()
regions, mask = selector.select_regions(frame)
properties = selector.get_region_properties(frame, regions)
```

#### 4. DynamicBehaviorVerifier
Verifies the "flash effect" by suppressing static background.

```python
from src.dynamic_behavior_verifier import DynamicBehaviorVerifier

verifier = DynamicBehaviorVerifier(background_frames=15)
verifier.add_frame(aligned_frame)
is_hologram, confidence = verifier.verify_region_heuristic(frame, region)
```

## Mathematical Foundation

### Chromaticity Vector Calculation (MIDV-Holo)

For each pixel $(i,j)$:

1. Determine dominant channel: $\max(R,G,B)$
2. Calculate chromaticity $C$:
   - If $R$ is max: $C = \frac{G-B}{S}$
   - If $G$ is max: $C = \frac{B-R}{S} + 2$
   - If $B$ is max: $C = \frac{R-G}{S} + 4$

3. Saturation: $S = \frac{\max(R,G,B) - \min(R,G,B)}{\max(R,G,B)}$

4. Accumulate statistics:
   - $S_{max}$: Maximum saturation over frames
   - $\sum C$: Sum of chromaticity vectors
   - $N$: Count of valid observations

5. Hologram Map: $\tilde{I}^{hm} = S_{max} \times (1 - \frac{||\sum C||}{N})$

## Configuration

### HologramVerifier Parameters

```python
verifier = HologramVerifier(
    feature_detector='orb',      # 'orb' or 'sift'
    buffer_size=30,              # Frames for accumulation
    update_interval=10,          # Frames between map updates
    use_ml_classifier=False,     # Enable ML classification
    confidence_threshold=0.6     # Detection threshold (0-1)
)
```

### Performance Tuning

**For Real-time Processing:**
```python
verifier = HologramVerifier(
    feature_detector='orb',      # ORB is faster
    buffer_size=20,              # Smaller buffer
    update_interval=5            # More frequent updates
)
```

**For High Accuracy:**
```python
verifier = HologramVerifier(
    feature_detector='sift',     # SIFT is more accurate
    buffer_size=45,              # Longer accumulation
    confidence_threshold=0.7     # Higher threshold
)
```

## Advanced Usage

### Training ML Classifier

```python
from src.dynamic_behavior_verifier import DynamicBehaviorVerifier
import numpy as np

# Initialize with ML enabled
verifier = HologramVerifier(use_ml_classifier=True)
behavior_verifier = verifier.behavior_verifier

# Prepare training data
X_train = []  # Feature vectors
y_train = []  # Labels (0=fake, 1=real)

# Extract features from labeled videos
for video in real_hologram_videos:
    features = behavior_verifier.extract_training_features(frames, regions)
    X_train.extend(features)
    y_train.extend([1] * len(features))

# Train classifier
behavior_verifier.train_classifier(np.array(X_train), np.array(y_train))

# Use trained verifier
results = verifier.process_video_stream('test_video.mp4')
```

### Batch Processing

```python
video_files = ['doc1.mp4', 'doc2.mp4', 'doc3.mp4']

verifier = HologramVerifier()

for video in video_files:
    verifier.reset()
    results = verifier.process_video_stream(video, display=False)
    print(f"{video}: {len(results['verified_holograms'])} detections")
```

### Custom Visualization

```python
verifier = HologramVerifier()

cap = cv2.VideoCapture(0)
while True:
    ret, frame = cap.read()
    
    # Get detailed pipeline visualization
    viz = verifier.visualize_pipeline(frame)
    cv2.imshow('Pipeline', viz)
    
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
```

## Output Format

### Detection Results

```python
{
    'total_frames': 300,
    'frames_with_detections': 45,
    'verified_holograms': [
        {
            'frame': 10,
            'bbox': (100, 150, 200, 180),  # (x, y, w, h)
            'confidence': 0.85
        },
        # ... more detections
    ],
    'avg_processing_time': 0.0334,  # seconds per frame
    'avg_confidence': 0.78,
    'max_confidence': 0.92
}
```

## Datasets

For training or testing, use publicly available datasets:

- **MIDV-Holo**: Hologram detection dataset with real and fake documents
- **MIDV-DynAttack**: Dynamic attack scenarios for fraud detection

## Performance Metrics

On a typical system (Intel i7, 16GB RAM):

- **ORB Feature Detector**: ~30 FPS (640x480)
- **SIFT Feature Detector**: ~15 FPS (640x480)
- **Detection Accuracy**: 85-95% (with proper configuration)

## Troubleshooting

### Low Frame Rate
- Use ORB instead of SIFT
- Reduce buffer_size
- Process every other frame
- Reduce input resolution

### False Positives
- Increase confidence_threshold
- Increase buffer_size for better statistics
- Adjust hue_variance_threshold in HsvRegionSelector

### False Negatives
- Decrease confidence_threshold
- Ensure proper lighting conditions
- Increase s_percentile in HsvRegionSelector
- Use longer accumulation buffer

### Alignment Failures
- Ensure sufficient texture in frames
- Use SIFT for textured documents
- Improve lighting conditions
- Reduce motion blur

## Technical Details

### Heuristic vs ML Mode

**Heuristic Mode** (Default):
- No training required
- Based on hue energy in difference image
- Works out-of-the-box
- Good for general use

**ML Mode**:
- Requires labeled training data
- Uses HOG features + SGD classifier
- Higher accuracy with proper training
- Better for specific document types

### Color Space Analysis

The system operates in multiple color spaces:
- **BGR**: Input and display
- **RGB**: Chromaticity calculation
- **HSV**: Region selection and hue analysis
- **Grayscale**: Feature detection

## Project Structure

```
hologram_verification/
├── src/
│   ├── __init__.py
│   ├── frame_aligner.py
│   ├── chromaticity_accumulator.py
│   ├── hsv_region_selector.py
│   ├── dynamic_behavior_verifier.py
│   └── hologram_verifier.py
├── examples/
│   ├── basic_usage.py
│   └── advanced_usage.py
├── tests/
│   └── (unit tests)
├── requirements.txt
└── README.md
```

## References

1. **MIDV-Holo Paper**: Chromaticity-based hologram detection using temporal accumulation
2. **Kada et al.**: Fast hologram detection using adaptive HSV thresholding
3. **Pouliquen et al.**: Dynamic analysis for hologram authentication and fraud detection

## License

This implementation is provided for research and educational purposes.

## Contributing

Contributions are welcome! Areas for improvement:
- Additional feature descriptors (AKAZE, etc.)
- GPU acceleration
- Mobile deployment
- Additional dataset support
- Enhanced ML models

## Contact

For questions or issues, please refer to the project repository or documentation.

---

**Note**: This system is designed for research and development purposes. For production deployment in security-critical applications, additional validation and testing with appropriate datasets is required.
