#!/bin/bash

# Stop Hologram Testing Services

echo "🛑 Stopping Hologram Testing Services"
echo "======================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m'

# Stop hologram service
if [ -f "logs/hologram_service.pid" ]; then
    PID=$(cat logs/hologram_service.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping hologram service (PID: $PID)..."
        kill $PID
        rm logs/hologram_service.pid
        echo -e "${GREEN}✓${NC} Hologram service stopped"
    else
        echo "Hologram service not running"
        rm logs/hologram_service.pid
    fi
else
    echo "No hologram service PID file found"
fi

# Stop UI service
if [ -f "logs/ui_service.pid" ]; then
    PID=$(cat logs/ui_service.pid)
    if ps -p $PID > /dev/null 2>&1; then
        echo "Stopping UI service (PID: $PID)..."
        kill $PID
        rm logs/ui_service.pid
        echo -e "${GREEN}✓${NC} UI service stopped"
    else
        echo "UI service not running"
        rm logs/ui_service.pid
    fi
else
    echo "No UI service PID file found"
fi

# Also kill any remaining processes on the ports
echo ""
echo "Checking for processes on ports 3000 and 8000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "Killed process on port 3000"
lsof -ti:8000 | xargs kill -9 2>/dev/null && echo "Killed process on port 8000"

echo ""
echo -e "${GREEN}✓${NC} All services stopped"
echo ""
