#!/bin/bash

# Start script for Hologram Verification Microservice

echo "Starting MinaID Hologram Verification Service..."
echo ""

# Check if virtual environment exists
if [ ! -d "../hologram_verification/venv" ]; then
    echo "Error: Virtual environment not found"
    echo "Please run setup.sh in hologram_verification directory first"
    exit 1
fi

# Activate virtual environment
source ../hologram_verification/venv/bin/activate

# Install additional dependencies
echo "Installing FastAPI dependencies..."
pip install -r requirements.txt

echo ""
echo "=========================================="
echo "Starting service on http://localhost:8000"
echo "=========================================="
echo ""

# Run the service
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
