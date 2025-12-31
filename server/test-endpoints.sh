#!/bin/bash

# Test script for MinaID Oracle Server
# Tests all endpoints to ensure proper functionality

echo "🧪 MinaID Oracle Server - Endpoint Tests"
echo "=========================================="
echo ""

BASE_URL="http://localhost:4000"

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASSED=0
FAILED=0

test_endpoint() {
    local name=$1
    local method=$2
    local url=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing $name... "
    
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "\n%{http_code}" "$BASE_URL$url")
    else
        response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$url" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$http_code" -eq "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
        echo "$body" | python3 -m json.tool 2>/dev/null || echo "$body"
        echo ""
        ((PASSED++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected HTTP $expected_status, got $http_code)"
        echo "$body"
        echo ""
        ((FAILED++))
    fi
}

echo "1️⃣  Health Check Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Health Check" "GET" "/health" "" 200

echo ""
echo "2️⃣  Oracle Public Key Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_endpoint "Get Oracle Key" "GET" "/oracle-key" "" 200

echo ""
echo "3️⃣  Passport Verification Endpoint (Valid ICAO Specimen)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
VALID_PASSPORT_DATA='{
  "passportData": {
    "passportNumber": "L898902C3",
    "birthDate": "740812",
    "expiryDate": "251215",
    "nationality": "UTO",
    "fullName": "ERIKSSON ANNA MARIA",
    "mrzLine1": "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
    "mrzLine2": "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
    "verificationType": "physical"
  }
}'
test_endpoint "Verify Valid Passport" "POST" "/verify-passport" "$VALID_PASSPORT_DATA" 200

echo ""
echo "4️⃣  Passport Verification Endpoint (Invalid Checksum)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
INVALID_PASSPORT_DATA='{
  "passportData": {
    "passportNumber": "L898902C3",
    "birthDate": "740812",
    "expiryDate": "251215",
    "nationality": "UTO",
    "fullName": "TEST USER",
    "mrzLine1": "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
    "mrzLine2": "L898902C36UTO7408122F1204159ZE184226B<<<<<99",
    "verificationType": "physical"
  }
}'
test_endpoint "Verify Invalid Passport" "POST" "/verify-passport" "$INVALID_PASSPORT_DATA" 200

echo ""
echo "5️⃣  Batch Verification Endpoint"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
BATCH_DATA='{
  "requests": [
    {
      "passportData": {
        "passportNumber": "L898902C3",
        "birthDate": "740812",
        "expiryDate": "251215",
        "nationality": "UTO",
        "fullName": "ERIKSSON ANNA MARIA",
        "mrzLine1": "P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<",
        "mrzLine2": "L898902C36UTO7408122F1204159ZE184226B<<<<<10",
        "verificationType": "physical"
      }
    }
  ]
}'
test_endpoint "Batch Verification" "POST" "/verify-batch" "$BATCH_DATA" 200

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Test Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed!${NC}"
    exit 1
fi
