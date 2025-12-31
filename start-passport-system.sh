#!/bin/bash

# MinaID Passport System - Start All Services

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_section() {
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if services are already running
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
        return 0
    else
        return 1
    fi
}

# Cleanup function
cleanup() {
    print_section "🛑 Shutting down services"
    pkill -f "oracle-server" || true
    pkill -f "next dev" || true
    print_success "Services stopped"
}

trap cleanup EXIT INT TERM

# Main
clear
print_section "🚀 Starting MinaID Passport Verification System"
echo ""

# Check prerequisites
if [ ! -f "server/.env" ]; then
    echo "❌ Oracle not configured. Run ./setup-passport-integration.sh first"
    exit 1
fi

if [ ! -f "ui/.env.local" ]; then
    echo "❌ UI not configured. Run ./setup-passport-integration.sh first"
    exit 1
fi

# Start Oracle Server
print_section "📡 Starting Oracle Server (Port 4000)"
cd server

if check_port 4000; then
    print_info "Port 4000 already in use, stopping existing process..."
    pkill -f "oracle-server" || true
    sleep 2
fi

npm run oracle:dev > ../logs/oracle.log 2>&1 &
ORACLE_PID=$!
echo $ORACLE_PID > ../logs/oracle.pid

# Wait for Oracle to initialize
print_info "Waiting for Oracle to initialize..."
sleep 5

if check_port 4000; then
    print_success "Oracle server started (PID: $ORACLE_PID)"
    
    # Get Oracle public key
    ORACLE_KEY=$(curl -s http://localhost:4000/oracle-key | grep -o 'B62q[a-zA-Z0-9]*' || cat oracle-public-key.txt | head -1)
    echo "   🔑 Public Key: ${ORACLE_KEY:0:20}..."
else
    echo "❌ Failed to start Oracle server"
    cat ../logs/oracle.log
    exit 1
fi

cd ..

# Start UI
print_section "🎨 Starting UI Development Server (Port 3000)"
cd ui

if check_port 3000; then
    print_info "Port 3000 already in use, stopping existing process..."
    pkill -f "next dev" || true
    sleep 2
fi

npm run dev > ../logs/ui.log 2>&1 &
UI_PID=$!
echo $UI_PID > ../logs/ui.pid

# Wait for UI to start
print_info "Waiting for UI to start..."
sleep 8

if check_port 3000; then
    print_success "UI server started (PID: $UI_PID)"
else
    echo "❌ Failed to start UI server"
    cat ../logs/ui.log
    exit 1
fi

cd ..

# Display status
print_section "✅ All Services Running"
echo ""
echo "📡 Oracle Server:   http://localhost:4000"
echo "   Status:          $(curl -s http://localhost:4000/health | grep -o 'ok' || echo 'starting...')"
echo "   PID:             $ORACLE_PID"
echo ""
echo "🎨 UI Dashboard:    http://localhost:3000"
echo "   Passport Verify: http://localhost:3000/passport-verify"
echo "   PID:             $UI_PID"
echo ""
echo "📊 Service Logs:"
echo "   Oracle:          tail -f logs/oracle.log"
echo "   UI:              tail -f logs/ui.log"
echo ""
echo "🛑 Stop Services:   Ctrl+C or ./stop-passport-system.sh"
echo ""

print_section "🎉 System Ready!"
echo ""
print_info "Press Ctrl+C to stop all services..."
echo ""

# Keep script running and monitor services
while true; do
    if ! kill -0 $ORACLE_PID 2>/dev/null; then
        echo "❌ Oracle server crashed! Check logs/oracle.log"
        exit 1
    fi
    
    if ! kill -0 $UI_PID 2>/dev/null; then
        echo "❌ UI server crashed! Check logs/ui.log"
        exit 1
    fi
    
    sleep 5
done
