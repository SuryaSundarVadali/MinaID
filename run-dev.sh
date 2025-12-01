#!/bin/bash

# MinaID Development Startup Script
# This script starts all necessary services for local development

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[MinaID]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18 or higher."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version 18 or higher is required. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) detected"

# Function to check if a port is in use
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Create logs directory
mkdir -p logs

# Start WebSocket Server
start_websocket() {
    print_status "Starting WebSocket server on port 8080..."
    
    if check_port 8080; then
        print_warning "Port 8080 is already in use. Skipping WebSocket server."
    else
        cd server
        
        if [ ! -d "node_modules" ]; then
            print_status "Installing WebSocket server dependencies..."
            npm install
        fi
        
        npm start > ../logs/websocket.log 2>&1 &
        WEBSOCKET_PID=$!
        echo $WEBSOCKET_PID > ../logs/websocket.pid
        print_success "WebSocket server started (PID: $WEBSOCKET_PID)"
        cd ..
    fi
}

# Start UI Development Server
start_ui() {
    print_status "Starting UI development server on port 3000..."
    
    if check_port 3000; then
        print_warning "Port 3000 is already in use. Skipping UI server."
    else
        cd ui
        
        if [ ! -d "node_modules" ]; then
            print_status "Installing UI dependencies..."
            npm install
        fi
        
        npm run dev > ../logs/ui.log 2>&1 &
        UI_PID=$!
        echo $UI_PID > ../logs/ui.pid
        print_success "UI server started (PID: $UI_PID)"
        cd ..
    fi
}

# Build contracts
build_contracts() {
    print_status "Building smart contracts..."
    
    cd contracts
    
    if [ ! -d "node_modules" ]; then
        print_status "Installing contract dependencies..."
        npm install
    fi
    
    npm run build
    print_success "Contracts built successfully"
    cd ..
}

# Check if cache exists
check_cache() {
    if [ -f "contracts/cache.json" ]; then
        print_success "Circuit cache found"
        return 0
    else
        print_warning "Circuit cache not found"
        return 1
    fi
}

# Generate cache
generate_cache() {
    print_status "Generating circuit cache (this may take 5-10 minutes)..."
    
    cd contracts
    npm run generate-cache
    npm run copy-cache
    print_success "Cache generated and copied to UI"
    cd ..
}

# Cleanup function
cleanup() {
    print_status "Shutting down services..."
    
    if [ -f logs/websocket.pid ]; then
        WEBSOCKET_PID=$(cat logs/websocket.pid)
        if ps -p $WEBSOCKET_PID > /dev/null 2>&1; then
            kill $WEBSOCKET_PID
            print_success "WebSocket server stopped"
        fi
        rm logs/websocket.pid
    fi
    
    if [ -f logs/ui.pid ]; then
        UI_PID=$(cat logs/ui.pid)
        if ps -p $UI_PID > /dev/null 2>&1; then
            kill $UI_PID
            print_success "UI server stopped"
        fi
        rm logs/ui.pid
    fi
    
    print_success "All services stopped"
    exit 0
}

# Register cleanup on script exit
trap cleanup EXIT INT TERM

# Main execution
print_status "Starting MinaID development environment..."
echo ""

# Parse command line arguments
SKIP_CONTRACTS=false
SKIP_CACHE=false
SKIP_WEBSOCKET=false
SKIP_UI=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-contracts)
            SKIP_CONTRACTS=true
            shift
            ;;
        --skip-cache)
            SKIP_CACHE=true
            shift
            ;;
        --skip-websocket)
            SKIP_WEBSOCKET=true
            shift
            ;;
        --skip-ui)
            SKIP_UI=true
            shift
            ;;
        --help)
            echo "Usage: ./run-dev.sh [options]"
            echo ""
            echo "Options:"
            echo "  --skip-contracts    Skip building contracts"
            echo "  --skip-cache        Skip cache generation"
            echo "  --skip-websocket    Skip WebSocket server"
            echo "  --skip-ui           Skip UI development server"
            echo "  --help              Show this help message"
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Build contracts
if [ "$SKIP_CONTRACTS" = false ]; then
    build_contracts
else
    print_warning "Skipping contract build"
fi

# Check/generate cache
if [ "$SKIP_CACHE" = false ]; then
    if ! check_cache; then
        read -p "Generate circuit cache now? This takes 5-10 minutes. (y/N) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            generate_cache
        else
            print_warning "Skipping cache generation. Some features may not work."
        fi
    fi
else
    print_warning "Skipping cache check"
fi

# Start services
if [ "$SKIP_WEBSOCKET" = false ]; then
    start_websocket
    sleep 2
else
    print_warning "Skipping WebSocket server"
fi

if [ "$SKIP_UI" = false ]; then
    start_ui
    sleep 3
else
    print_warning "Skipping UI server"
fi

echo ""
print_success "MinaID development environment is running!"
echo ""
echo -e "${BLUE}Services:${NC}"
echo "  • UI:        http://localhost:3000"
echo "  • WebSocket: ws://localhost:8080"
echo "  • Health:    http://localhost:8080/health"
echo ""
echo -e "${BLUE}Logs:${NC}"
echo "  • WebSocket: tail -f logs/websocket.log"
echo "  • UI:        tail -f logs/ui.log"
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo ""

# Wait for user interrupt
while true; do
    sleep 1
done
