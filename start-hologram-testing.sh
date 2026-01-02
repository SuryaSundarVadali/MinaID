#!/bin/bash

# Hologram Testing Quick Start Script
# Launches the hologram verification service and testing UI

echo "🔬 Starting Hologram Verification Testing Environment"
echo "======================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Python service is running
check_hologram_service() {
    if curl -s http://localhost:8000/health > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Hologram service is running"
        return 0
    else
        echo -e "${RED}✗${NC} Hologram service is not running"
        return 1
    fi
}

# Check if UI is running
check_ui_service() {
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} UI service is running"
        return 0
    else
        echo -e "${RED}✗${NC} UI service is not running"
        return 1
    fi
}

echo "📋 Checking services..."
echo ""

HOLOGRAM_RUNNING=0
UI_RUNNING=0

if check_hologram_service; then
    HOLOGRAM_RUNNING=1
fi

if check_ui_service; then
    UI_RUNNING=1
fi

echo ""

# Start hologram service if not running
if [ $HOLOGRAM_RUNNING -eq 0 ]; then
    echo -e "${YELLOW}Starting hologram verification service...${NC}"
    cd hologram_service
    
    # Check if virtual environment exists
    if [ ! -d "venv" ]; then
        echo "Creating Python virtual environment..."
        python3 -m venv venv
    fi
    
    # Activate virtual environment and install dependencies
    source venv/bin/activate
    pip install -q -r requirements.txt
    
    # Start service in background
    echo "Launching hologram API on http://localhost:8000"
    python api.py > ../logs/hologram_service.log 2>&1 &
    HOLOGRAM_PID=$!
    echo $HOLOGRAM_PID > ../logs/hologram_service.pid
    echo -e "${GREEN}✓${NC} Hologram service started (PID: $HOLOGRAM_PID)"
    
    cd ..
    
    # Wait for service to be ready
    echo "Waiting for service to be ready..."
    for i in {1..30}; do
        if curl -s http://localhost:8000/health > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Service is ready!"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
else
    echo -e "${GREEN}✓${NC} Hologram service already running"
fi

echo ""

# Start UI if not running
if [ $UI_RUNNING -eq 0 ]; then
    echo -e "${YELLOW}Starting UI service...${NC}"
    cd ui
    
    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        echo "Installing npm dependencies..."
        npm install
    fi
    
    # Start Next.js dev server in background
    echo "Launching UI on http://localhost:3000"
    npm run dev > ../logs/ui_service.log 2>&1 &
    UI_PID=$!
    echo $UI_PID > ../logs/ui_service.pid
    echo -e "${GREEN}✓${NC} UI service started (PID: $UI_PID)"
    
    cd ..
    
    # Wait for UI to be ready
    echo "Waiting for UI to be ready..."
    for i in {1..60}; do
        if curl -s http://localhost:3000 > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} UI is ready!"
            break
        fi
        sleep 1
        echo -n "."
    done
    echo ""
else
    echo -e "${GREEN}✓${NC} UI service already running"
fi

echo ""
echo "======================================================"
echo -e "${GREEN}🎉 Testing environment is ready!${NC}"
echo "======================================================"
echo ""
echo "Available testing pages:"
echo ""
echo -e "  ${BLUE}1. Basic Testing Tool${NC}"
echo "     URL: http://localhost:3000/test-hologram"
echo "     Features: Camera preview, record & test, upload videos"
echo ""
echo -e "  ${BLUE}2. Advanced Streaming Tester${NC}"
echo "     URL: http://localhost:3000/test-hologram-stream"
echo "     Features: Real-time frame analysis, annotated frames"
echo ""
echo -e "  ${BLUE}3. Production Passport Upload${NC}"
echo "     URL: http://localhost:3000/upload-passport"
echo "     Features: Full passport verification with hologram"
echo ""
echo -e "  ${BLUE}4. API Documentation${NC}"
echo "     URL: http://localhost:8000/docs"
echo "     Features: Interactive API testing"
echo ""
echo "Services:"
echo "  - Hologram API: http://localhost:8000"
echo "  - UI: http://localhost:3000"
echo ""
echo "Logs:"
echo "  - Hologram service: logs/hologram_service.log"
echo "  - UI service: logs/ui_service.log"
echo ""
echo "To stop services:"
echo "  ./stop-hologram-testing.sh"
echo ""
echo -e "${YELLOW}💡 Tip:${NC} Use the basic testing tool first to verify your setup!"
echo ""
