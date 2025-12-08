#!/bin/bash

# Update Environment Variables Script
# Updates Vercel and GitHub with new contract addresses
# Generated: December 8, 2025

# New contract addresses (deployed Dec 8, 2025)
DID_REGISTRY="B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD"
ZKP_VERIFIER="B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw"

echo "📋 New Contract Addresses (Deployed Dec 8, 2025)"
echo "================================================"
echo "DIDRegistry:  $DID_REGISTRY"
echo "ZKPVerifier:  $ZKP_VERIFIER"
echo ""

# ===== VERCEL UPDATE =====
echo "🚀 VERCEL ENVIRONMENT VARIABLES UPDATE"
echo "======================================"
echo ""
echo "Option 1: Using Vercel CLI (Recommended)"
echo "-----------------------------------------"
echo "Run these commands:"
echo ""
echo "vercel env rm NEXT_PUBLIC_DID_REGISTRY_DEVNET production"
echo "vercel env add NEXT_PUBLIC_DID_REGISTRY_DEVNET production"
echo "# When prompted, enter: $DID_REGISTRY"
echo ""
echo "vercel env rm NEXT_PUBLIC_ZKP_VERIFIER_DEVNET production"
echo "vercel env add NEXT_PUBLIC_ZKP_VERIFIER_DEVNET production"
echo "# When prompted, enter: $ZKP_VERIFIER"
echo ""
echo "Option 2: Using Vercel Dashboard"
echo "--------------------------------"
echo "1. Go to: https://vercel.com/suryasundarvadalis-projects/mina-id/settings/environment-variables"
echo "2. Find and edit these variables:"
echo "   - NEXT_PUBLIC_DID_REGISTRY_DEVNET = $DID_REGISTRY"
echo "   - NEXT_PUBLIC_ZKP_VERIFIER_DEVNET = $ZKP_VERIFIER"
echo "3. Save changes"
echo ""

# ===== GITHUB SECRETS UPDATE =====
echo "🔐 GITHUB REPOSITORY SECRETS UPDATE"
echo "===================================="
echo ""
echo "Option 1: Using GitHub CLI (Recommended)"
echo "-----------------------------------------"
echo "Run these commands:"
echo ""
echo "gh secret set NEXT_PUBLIC_DID_REGISTRY_DEVNET --body \"$DID_REGISTRY\""
echo "gh secret set NEXT_PUBLIC_ZKP_VERIFIER_DEVNET --body \"$ZKP_VERIFIER\""
echo ""
echo "Option 2: Using GitHub Web Interface"
echo "------------------------------------"
echo "1. Go to: https://github.com/SuryaSundarVadali/MinaID/settings/secrets/actions"
echo "2. Update or create these secrets:"
echo "   - NEXT_PUBLIC_DID_REGISTRY_DEVNET = $DID_REGISTRY"
echo "   - NEXT_PUBLIC_ZKP_VERIFIER_DEVNET = $ZKP_VERIFIER"
echo "3. Save changes"
echo ""

# ===== VERIFICATION =====
echo "✅ VERIFICATION STEPS"
echo "===================="
echo "After updating environment variables:"
echo ""
echo "1. Redeploy on Vercel:"
echo "   vercel --prod"
echo ""
echo "2. Verify deployment:"
echo "   node verify-deployment.js"
echo ""
echo "3. Test proof generation and transaction signing"
echo ""

# ===== QUICK UPDATE COMMANDS =====
echo "📝 QUICK UPDATE (Copy & Paste)"
echo "=============================="
echo ""
echo "# Vercel CLI commands:"
cat << 'EOF'
vercel env rm NEXT_PUBLIC_DID_REGISTRY_DEVNET production && \
echo "B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD" | vercel env add NEXT_PUBLIC_DID_REGISTRY_DEVNET production && \
vercel env rm NEXT_PUBLIC_ZKP_VERIFIER_DEVNET production && \
echo "B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw" | vercel env add NEXT_PUBLIC_ZKP_VERIFIER_DEVNET production
EOF
echo ""
echo "# GitHub CLI commands:"
cat << 'EOF'
gh secret set NEXT_PUBLIC_DID_REGISTRY_DEVNET --body "B62qqfXbZPJAH3RBqbpKeQfUzWKw7JehiyHDhWCFZB8NLctRxoVPrTD" && \
gh secret set NEXT_PUBLIC_ZKP_VERIFIER_DEVNET --body "B62qjrwq6t1GbMnS9RqTzr3jJpqAR59jSp2YJnmpmjoGH1BqGRPccjw"
EOF
echo ""
