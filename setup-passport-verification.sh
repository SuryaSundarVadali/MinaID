#!/bin/bash

# MinaID Passport Verification Setup Script
# This script helps you quickly set up the complete passport verification system

set -e  # Exit on any error

echo "🛂 MinaID Passport Verification System Setup"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored messages
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version must be 18 or higher. Current version: $(node -v)"
    exit 1
fi

print_success "Node.js $(node -v) detected"

# Step 1: Install dependencies
echo ""
print_info "Step 1: Installing dependencies..."
echo ""

echo "Installing contracts dependencies..."
cd contracts
npm install
print_success "Contracts dependencies installed"

echo ""
echo "Installing server dependencies..."
cd ../server
npm install
print_success "Server dependencies installed"

# Step 2: Generate Oracle keys
echo ""
print_info "Step 2: Generating Oracle cryptographic keys..."
echo ""

ORACLE_KEYS=$(node -e "
const { PrivateKey } = require('o1js');
const priv = PrivateKey.random();
const pub = priv.toPublicKey();
console.log(priv.toBase58());
console.log(pub.toBase58());
")

ORACLE_PRIVATE_KEY=$(echo "$ORACLE_KEYS" | sed -n '1p')
ORACLE_PUBLIC_KEY=$(echo "$ORACLE_KEYS" | sed -n '2p')

print_success "Oracle keys generated"
echo ""
echo "🔑 IMPORTANT: Save these keys securely!"
echo ""
echo "Private Key (keep secret):"
echo "$ORACLE_PRIVATE_KEY"
echo ""
echo "Public Key (use in contract):"
echo "$ORACLE_PUBLIC_KEY"
echo ""

# Create .env file for server
cat > .env << EOF
# MinaID Oracle Server Configuration
# Generated on $(date)

# CRITICAL: Keep this private key secure!
# Never commit this file to version control
ORACLE_PRIVATE_KEY=$ORACLE_PRIVATE_KEY

# Server configuration
PORT=3001
NODE_ENV=development

# CORS configuration (update for production)
CORS_ORIGIN=http://localhost:3000

# Logging
LOG_LEVEL=info
EOF

print_success "Created server/.env file"

# Step 3: Build contracts
echo ""
print_info "Step 3: Building contracts..."
echo ""

cd ../contracts
npm run build
print_success "Contracts built successfully"

# Step 4: Run tests
echo ""
print_info "Step 4: Running tests..."
echo ""

npm test -- MRZUtils.test.ts
print_success "All tests passed"

# Step 5: Test example script
echo ""
print_info "Step 5: Testing MRZ validation with ICAO specimen..."
echo ""

node build/scripts/example-mrz-validation.js
print_success "Example validation successful"

# Step 6: Create contract configuration
echo ""
print_info "Step 6: Creating contract configuration..."
echo ""

cat > src/config.ts << EOF
/**
 * MinaIDContract Configuration
 * Update these values after deploying the contract
 */

import { PublicKey } from 'o1js';

// Oracle public key (generated during setup)
export const ORACLE_PUBLIC_KEY = PublicKey.fromBase58(
  '$ORACLE_PUBLIC_KEY'
);

// Contract address (update after deployment)
export const CONTRACT_ADDRESS = 'B62qk...'; // TODO: Update after deployment

// Network configuration
export const NETWORK = process.env.NETWORK || 'berkeley';
export const MINA_ENDPOINT = 
  NETWORK === 'mainnet' 
    ? 'https://proxy.berkeley.minaexplorer.com/graphql'
    : 'https://proxy.berkeley.minaexplorer.com/graphql';
EOF

print_success "Created contract configuration"

# Step 7: Setup complete
echo ""
echo "=============================================="
print_success "Setup complete! 🎉"
echo "=============================================="
echo ""
echo "📋 Next Steps:"
echo ""
echo "1. Start the Oracle server:"
echo "   cd server"
echo "   npm run oracle:dev"
echo ""
echo "2. In a new terminal, start the UI:"
echo "   cd ui"
echo "   npm run dev"
echo ""
echo "3. Deploy the MinaIDContract to Mina network:"
echo "   cd contracts"
echo "   # Follow Mina deployment documentation"
echo "   # Update CONTRACT_ADDRESS in src/config.ts"
echo ""
echo "4. Test the complete flow:"
echo "   - Open http://localhost:3000"
echo "   - Scan a passport (physical or ePassport)"
echo "   - Verify with Oracle"
echo "   - Submit to blockchain"
echo ""
echo "📚 Documentation:"
echo "   - PASSPORT_VERIFICATION_README.md - Complete overview"
echo "   - PASSPORT_VERIFICATION_GUIDE.md - Integration guide"
echo "   - server/DEPLOYMENT.md - Deployment instructions"
echo "   - contracts/src/lib/MRZ_README.md - API reference"
echo ""
echo "🔒 Security Reminder:"
echo "   - NEVER commit server/.env to version control"
echo "   - Store ORACLE_PRIVATE_KEY securely"
echo "   - Use different keys for dev/staging/production"
echo "   - Enable HTTPS in production"
echo ""
echo "💬 Need Help?"
echo "   - GitHub Issues: https://github.com/your-repo/minaid/issues"
echo "   - Discord: https://discord.gg/minaid"
echo "   - Documentation: https://docs.minaid.app"
echo ""
print_success "Happy coding! 🚀"
