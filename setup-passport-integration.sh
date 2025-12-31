#!/bin/bash

# MinaID Passport Integration - Complete Setup Script

set -e

echo "🚀 MinaID Passport Integration Setup"
echo "======================================"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Step 1: Setup Oracle Server
echo "Step 1: Setting up Oracle Server"
echo "--------------------------------"
cd server

if [ ! -f ".env" ]; then
    print_info "Generating Oracle keys..."
    npm install
    npm run generate-keys
    print_success "Oracle keys generated and .env created"
else
    print_success "Oracle .env already exists"
fi

# Get Oracle public key
ORACLE_PUBLIC_KEY=$(grep "ORACLE_PRIVATE_KEY" .env | head -1 | cut -d'=' -f2)
if [ -f "oracle-public-key.txt" ]; then
    ORACLE_PUBLIC_KEY=$(grep "B62q" oracle-public-key.txt | head -1)
fi

print_success "Oracle configured"
echo ""

# Step 2: Setup UI Environment
echo "Step 2: Setting up UI Environment"
echo "---------------------------------"
cd ../ui

if [ ! -f ".env.local" ]; then
    print_info "Creating UI environment file..."
    cat > .env.local << EOF
# MinaID Environment Configuration
NEXT_PUBLIC_ORACLE_URL=http://localhost:4000
NEXT_PUBLIC_ORACLE_PUBLIC_KEY=${ORACLE_PUBLIC_KEY}
NEXT_PUBLIC_CONTRACT_ADDRESS=
NEXT_PUBLIC_MINA_NETWORK=berkeley
NEXT_PUBLIC_MINA_GRAPHQL=https://proxy.berkeley.minaexplorer.com/graphql
NEXT_PUBLIC_ENABLE_PASSPORT_VERIFICATION=true
NEXT_PUBLIC_ENABLE_EPASSPORT_NFC=false
EOF
    print_success "UI .env.local created"
else
    print_success "UI .env.local already exists"
fi

npm install
print_success "UI dependencies installed"
echo ""

# Step 3: Setup Contracts
echo "Step 3: Setting up Smart Contracts"
echo "----------------------------------"
cd ../contracts

npm install
print_success "Contract dependencies installed"

print_info "Building contracts..."
npm run build
print_success "Contracts compiled"
echo ""

# Step 4: Instructions
echo "═══════════════════════════════════════"
echo "✅ Setup Complete!"
echo "═══════════════════════════════════════"
echo ""
echo "📋 Oracle Public Key:"
echo "   ${ORACLE_PUBLIC_KEY}"
echo ""
echo "🚀 Next Steps:"
echo ""
echo "1️⃣  Start Oracle Server:"
echo "   cd server"
echo "   npm run oracle:dev"
echo ""
echo "2️⃣  Start UI (in new terminal):"
echo "   cd ui"
echo "   npm run dev"
echo ""
echo "3️⃣  Open Browser:"
echo "   http://localhost:3000/passport-verify"
echo ""
echo "4️⃣  Optional - Deploy Contract:"
echo "   cd contracts"
echo "   export DEPLOYER_PRIVATE_KEY=your_key"
echo "   npx ts-node scripts/deploy-with-oracle.ts"
echo ""
echo "📚 Documentation:"
echo "   - Server:    server/DEPLOYMENT_STATUS.md"
echo "   - UI:        ui/README.md"
echo "   - Contracts: contracts/src/lib/MRZ_README.md"
echo ""
print_success "Ready to verify passports! 🎉"
