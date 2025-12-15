#!/bin/bash
# update-contract-addresses.sh
# 
# Updates contract addresses across the entire codebase after deployment
# Usage: ./update-contract-addresses.sh <DID_REGISTRY_ADDRESS> <ZKP_VERIFIER_ADDRESS>

set -e

if [ $# -ne 2 ]; then
    echo "Usage: $0 <DID_REGISTRY_ADDRESS> <ZKP_VERIFIER_ADDRESS>"
    echo "Example: $0 B62q... B62q..."
    exit 1
fi

DID_REGISTRY=$1
ZKP_VERIFIER=$2

echo "🔄 Updating contract addresses in codebase..."
echo "  DIDRegistry: $DID_REGISTRY"
echo "  ZKPVerifier: $ZKP_VERIFIER"
echo ""

# Update .env.local
echo "📝 Updating ui/.env.local..."
cat > ui/.env.local << EOF
# MinaID Environment Configuration
# Updated: $(date '+%B %d, %Y')

# ===== Network Configuration =====
NEXT_PUBLIC_NETWORK=devnet

# ===== Smart Contract Addresses =====
# Deployed on Mina Devnet

# Devnet (Default)
NEXT_PUBLIC_DID_REGISTRY_DEVNET=$DID_REGISTRY
NEXT_PUBLIC_ZKP_VERIFIER_DEVNET=$ZKP_VERIFIER

# ===== Application Configuration =====
NEXT_PUBLIC_APP_NAME=MinaID
EOF

# Update ContractInterface.ts DEFAULT_CONFIG
echo "📝 Updating ui/lib/ContractInterface.ts..."
sed -i "s/didRegistryAddress: 'B62[^']*'/didRegistryAddress: '$DID_REGISTRY'/g" ui/lib/ContractInterface.ts
sed -i "s/zkpVerifierAddress: 'B62[^']*'/zkpVerifierAddress: '$ZKP_VERIFIER'/g" ui/lib/ContractInterface.ts

# Update config.json
echo "📝 Updating contracts/config.json..."
if [ -f contracts/config.json ]; then
    node -e "
    const fs = require('fs');
    const config = JSON.parse(fs.readFileSync('contracts/config.json', 'utf8'));
    config.deployedContracts = config.deployedContracts || {};
    config.deployedContracts.devnet = {
        didRegistry: '$DID_REGISTRY',
        zkpVerifier: '$ZKP_VERIFIER',
        deployedAt: new Date().toISOString()
    };
    fs.writeFileSync('contracts/config.json', JSON.stringify(config, null, 2));
    "
fi

echo ""
echo "✅ All files updated!"
echo ""
echo "📋 Next steps:"
echo "  1. Restart the dev server: cd ui && npm run dev"
echo "  2. Clear browser storage: window.DevCleanup.clearAllStorage()"
echo "  3. Hard refresh: Ctrl+Shift+R"
echo ""
echo "🔍 Verify in browser console:"
echo "  await window.DevCleanup.checkRegistrationEligibility()"
echo ""
