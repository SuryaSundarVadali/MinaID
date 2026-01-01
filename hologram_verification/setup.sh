#!/bin/bash

# Setup script for Hologram Verification System
# Creates virtual environment and installs dependencies

echo "=========================================="
echo "Hologram Verification System Setup"
echo "=========================================="
echo ""

# Check if Python 3 is installed
if ! command -v python3 &> /dev/null; then
    echo "Error: Python 3 is not installed"
    echo "Please install Python 3.8 or higher"
    exit 1
fi

echo "Python version: $(python3 --version)"
echo ""

# Create virtual environment
echo "Creating virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
    echo "✓ Virtual environment created"
else
    echo "✓ Virtual environment already exists"
fi
echo ""

# Activate virtual environment and install dependencies
echo "Installing dependencies..."
source venv/bin/activate

# Upgrade pip
pip install --upgrade pip

# Install requirements
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "Setup Complete!"
echo "=========================================="
echo ""
echo "To activate the virtual environment, run:"
echo "  source venv/bin/activate"
echo ""
echo "To run examples:"
echo "  source venv/bin/activate"
echo "  python examples/basic_usage.py"
echo ""
echo "To deactivate the virtual environment:"
echo "  deactivate"
echo ""
