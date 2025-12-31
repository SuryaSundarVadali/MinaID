#!/bin/bash

# MinaID Oracle & Passport Service Deployment Script
# This script deploys and tests the complete Oracle server

set -e

echo "🚀 MinaID Oracle & Passport Service Deployment"
echo "================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Change to server directory
cd "$(dirname "$0")"

# Step 1: Check if .env exists
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  No .env file found. Generating Oracle keys...${NC}"
    npm run generate-keys
    echo ""
fi

# Step 2: Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}📦 Installing dependencies...${NC}"
    npm install
    echo ""
fi

# Step 3: Display configuration
echo -e "${GREEN}✅ Configuration loaded${NC}"
echo ""
if [ -f ".env" ]; then
    echo "Environment variables:"
    grep -v "^#" .env | grep -v "^$" | while read line; do
        key=$(echo "$line" | cut -d'=' -f1)
        if [ "$key" = "ORACLE_PRIVATE_KEY" ]; then
            echo "  $key=***hidden***"
        else
            echo "  $line"
        fi
    done
fi
echo ""

# Step 4: Display public key
if [ -f "oracle-public-key.txt" ]; then
    echo -e "${GREEN}🔑 Oracle Public Key:${NC}"
    cat oracle-public-key.txt | grep "^B62"
    echo ""
fi

# Step 5: Start server
echo -e "${GREEN}🎯 Starting Oracle Server...${NC}"
echo ""
echo "Server will start on http://localhost:4000"
echo ""
echo "Available endpoints:"
echo "  - GET  http://localhost:4000/health           (Health check)"
echo "  - GET  http://localhost:4000/oracle-key        (Get Oracle public key)"
echo "  - POST http://localhost:4000/verify-passport   (Verify passport)"
echo "  - POST http://localhost:4000/verify-batch      (Batch verification)"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""
echo "================================================"
echo ""

# Start the server
npm run oracle:dev
