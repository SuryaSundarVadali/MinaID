#!/bin/bash

# MinaID First-Time Setup Script
# Run this script once to set up the entire MinaID development environment

set -e  # Exit on error

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_header() {
    echo ""
    echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║                                        ║${NC}"
    echo -e "${BLUE}║         MinaID Setup Script            ║${NC}"
    echo -e "${BLUE}║                                        ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
    echo ""
}

print_step() {
    echo -e "\n${BLUE}▶${NC} $1"
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

# Check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        echo "Please install Node.js 18 or higher from: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ required. Current: $(node -v)"
        exit 1
    fi
    print_success "Node.js $(node -v)"
    
    # Check npm
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    print_success "npm $(npm -v)"
    
    # Check git
    if ! command -v git &> /dev/null; then
        print_warning "Git is not installed (optional)"
    else
        print_success "git $(git --version | cut -d' ' -f3)"
    fi
}

# Install contract dependencies
install_contracts() {
    print_step "Installing contract dependencies..."
    cd contracts
    
    if [ -d "node_modules" ]; then
        print_warning "Dependencies already installed, skipping..."
    else
        npm install
        print_success "Contract dependencies installed"
    fi
    
    cd ..
}

# Install UI dependencies
install_ui() {
    print_step "Installing UI dependencies..."
    cd ui
    
    if [ -d "node_modules" ]; then
        print_warning "Dependencies already installed, skipping..."
    else
        npm install
        print_success "UI dependencies installed"
    fi
    
    cd ..
}

# Install server dependencies
install_server() {
    print_step "Installing WebSocket server dependencies..."
    cd server
    
    if [ -d "node_modules" ]; then
        print_warning "Dependencies already installed, skipping..."
    else
        npm install
        print_success "Server dependencies installed"
    fi
    
    cd ..
}

# Build contracts
build_contracts() {
    print_step "Building smart contracts..."
    cd contracts
    npm run build
    print_success "Contracts built successfully"
    cd ..
}

# Generate cache
generate_cache() {
    print_step "Generating circuit cache..."
    echo ""
    print_warning "This will take approximately 5-10 minutes"
    echo "You can skip this and generate it later by running:"
    echo "  cd contracts && npm run generate-cache"
    echo ""
    
    read -p "Generate cache now? (y/N) " -n 1 -r
    echo
    
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        cd contracts
        npm run generate-cache
        npm run copy-cache
        print_success "Cache generated and copied to UI"
        cd ..
    else
        print_warning "Skipping cache generation"
        echo "Note: You'll need to generate cache before using proof features"
    fi
}

# Create environment files
create_env_files() {
    print_step "Creating environment files..."
    
    # UI .env.local
    if [ ! -f "ui/.env.local" ]; then
        cat > ui/.env.local << EOF
# Network Configuration
NEXT_PUBLIC_NETWORK=devnet
NEXT_PUBLIC_MINA_ENDPOINT=https://api.minascan.io/node/devnet/v1/graphql
NEXT_PUBLIC_ARCHIVE_ENDPOINT=https://api.minascan.io/archive/devnet/v1/graphql

# WebSocket Server
NEXT_PUBLIC_WS_URL=ws://localhost:8080/minaid

# Contract Addresses (update after deployment)
NEXT_PUBLIC_DID_REGISTRY=B62qjuEhj9YjZyKTD75ywH7vY73DgUTC5bVxSCo3meirg8nGnV3CYjk
NEXT_PUBLIC_ZKP_VERIFIER=B62qrfTGCDP1KEx1PQa6mWGjV2b8wckbdcQRhi2Mu3AGfRYrjjnnfxW
EOF
        print_success "Created ui/.env.local"
    else
        print_warning "ui/.env.local already exists, skipping..."
    fi
}

# Create logs directory
create_logs_dir() {
    if [ ! -d "logs" ]; then
        mkdir logs
        print_success "Created logs directory"
    fi
}

# Display next steps
show_next_steps() {
    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}║         Setup Complete! 🎉             ║${NC}"
    echo -e "${GREEN}║                                        ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BLUE}Next Steps:${NC}"
    echo ""
    echo "1. Start development environment:"
    echo -e "   ${YELLOW}./run-dev.sh${NC}"
    echo ""
    echo "2. Open your browser:"
    echo -e "   ${YELLOW}http://localhost:3000${NC}"
    echo ""
    echo "3. Install Auro Wallet extension:"
    echo -e "   ${YELLOW}https://www.aurowallet.com/${NC}"
    echo ""
    echo "4. Get test tokens from faucet:"
    echo -e "   ${YELLOW}https://faucet.minaprotocol.com/${NC}"
    echo ""
    echo -e "${BLUE}Optional:${NC}"
    echo ""
    echo "• Generate deployment keys:"
    echo -e "   ${YELLOW}cd contracts && npm run generate-keys devnet${NC}"
    echo ""
    echo "• Deploy contracts to devnet:"
    echo -e "   ${YELLOW}cd contracts && npm run deploy devnet${NC}"
    echo ""
    echo "• Generate circuit cache (if not done):"
    echo -e "   ${YELLOW}cd contracts && npm run generate-cache && npm run copy-cache${NC}"
    echo ""
    echo -e "${BLUE}Documentation:${NC}"
    echo "  • README.md           - Project overview"
    echo "  • DEPLOYMENT.md       - Deployment guide"
    echo "  • PRODUCTION_FEATURES.md - Production features"
    echo "  • API_REFERENCE.md    - API documentation"
    echo ""
    echo -e "${GREEN}Happy coding! 🚀${NC}"
    echo ""
}

# Main execution
print_header

check_prerequisites
install_contracts
install_ui
install_server
build_contracts
create_env_files
create_logs_dir
generate_cache
show_next_steps
