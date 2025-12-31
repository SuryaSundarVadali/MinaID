#!/bin/bash

# MinaID Passport System - Status Dashboard

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

print_header() {
    echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${BLUE}║  MinaID Passport Verification System Status   ║${NC}"
    echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_service() {
    local port=$1
    local name=$2
    
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        local pid=$(lsof -Pi :$port -sTCP:LISTEN -t)
        echo -e "${GREEN}✓${NC} $name (Port $port) - ${GREEN}RUNNING${NC} (PID: $pid)"
        return 0
    else
        echo -e "${RED}✗${NC} $name (Port $port) - ${RED}STOPPED${NC}"
        return 1
    fi
}

check_file() {
    local file=$1
    local name=$2
    
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓${NC} $name"
        return 0
    else
        echo -e "${RED}✗${NC} $name - ${RED}NOT FOUND${NC}"
        return 1
    fi
}

test_endpoint() {
    local url=$1
    local name=$2
    
    if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
        if [ "$response" = "200" ]; then
            echo -e "${GREEN}✓${NC} $name - ${GREEN}OK${NC} (HTTP $response)"
            return 0
        else
            echo -e "${YELLOW}⚠${NC} $name - ${YELLOW}UNHEALTHY${NC} (HTTP $response)"
            return 1
        fi
    else
        echo -e "${RED}✗${NC} $name - ${RED}NO RESPONSE${NC}"
        return 1
    fi
}

get_oracle_key() {
    if [ -f "server/oracle-public-key.txt" ]; then
        cat server/oracle-public-key.txt | head -1
    elif [ -f "server/.env" ]; then
        grep "ORACLE_PRIVATE_KEY" server/.env | head -1 | cut -d'=' -f2 | cut -c1-20
    else
        echo "Not configured"
    fi
}

get_contract_address() {
    if [ -f "ui/.env.local" ]; then
        grep "NEXT_PUBLIC_CONTRACT_ADDRESS" ui/.env.local | cut -d'=' -f2
    else
        echo "Not configured"
    fi
}

# Main
clear
print_header

echo -e "${CYAN}📡 Service Status${NC}"
echo "─────────────────────────────────────────────────"
ORACLE_RUNNING=0
UI_RUNNING=0

check_service 4000 "Oracle Server" && ORACLE_RUNNING=1
check_service 3000 "UI Development Server" && UI_RUNNING=1
echo ""

echo -e "${CYAN}📋 Configuration Status${NC}"
echo "─────────────────────────────────────────────────"
check_file "server/.env" "Oracle Environment (.env)"
check_file "server/oracle-public-key.txt" "Oracle Public Key File"
check_file "ui/.env.local" "UI Environment (.env.local)"
check_file "contracts/build/src/MinaIDContract.js" "Compiled Contracts"
echo ""

if [ $ORACLE_RUNNING -eq 1 ]; then
    echo -e "${CYAN}🧪 Oracle Endpoint Health${NC}"
    echo "─────────────────────────────────────────────────"
    test_endpoint "http://localhost:4000/health" "Health Check"
    test_endpoint "http://localhost:4000/oracle-key" "Public Key Endpoint"
    echo ""
fi

echo -e "${CYAN}🔑 Oracle Configuration${NC}"
echo "─────────────────────────────────────────────────"
ORACLE_KEY=$(get_oracle_key)
if [ "$ORACLE_KEY" != "Not configured" ]; then
    echo -e "Public Key: ${GREEN}${ORACLE_KEY:0:20}...${NC}"
    
    if [ $ORACLE_RUNNING -eq 1 ]; then
        API_KEY=$(curl -s http://localhost:4000/oracle-key 2>/dev/null | grep -o 'B62q[a-zA-Z0-9]*' | head -1)
        if [ ! -z "$API_KEY" ]; then
            echo -e "API Response: ${GREEN}${API_KEY:0:20}...${NC}"
            
            if [ "${ORACLE_KEY:0:20}" = "${API_KEY:0:20}" ]; then
                echo -e "Key Match: ${GREEN}✓ VERIFIED${NC}"
            else
                echo -e "Key Match: ${RED}✗ MISMATCH${NC}"
            fi
        fi
    fi
else
    echo -e "${YELLOW}⚠ Run './setup-passport-integration.sh' first${NC}"
fi
echo ""

echo -e "${CYAN}📜 Smart Contract${NC}"
echo "─────────────────────────────────────────────────"
CONTRACT_ADDRESS=$(get_contract_address)
if [ ! -z "$CONTRACT_ADDRESS" ] && [ "$CONTRACT_ADDRESS" != "Not configured" ]; then
    echo -e "Address: ${GREEN}${CONTRACT_ADDRESS:0:30}...${NC}"
    echo -e "Network: ${GREEN}Berkeley Testnet${NC}"
else
    echo -e "${YELLOW}⚠ Contract not deployed yet${NC}"
    echo -e "   Run: ${CYAN}npm run deploy:contract${NC}"
fi
echo ""

echo -e "${CYAN}🌐 Access URLs${NC}"
echo "─────────────────────────────────────────────────"
if [ $UI_RUNNING -eq 1 ]; then
    echo -e "Dashboard:       ${GREEN}http://localhost:3000${NC}"
    echo -e "Passport Verify: ${GREEN}http://localhost:3000/passport-verify${NC}"
else
    echo -e "Dashboard:       ${YELLOW}http://localhost:3000${NC} (stopped)"
    echo -e "Passport Verify: ${YELLOW}http://localhost:3000/passport-verify${NC} (stopped)"
fi

if [ $ORACLE_RUNNING -eq 1 ]; then
    echo -e "Oracle API:      ${GREEN}http://localhost:4000${NC}"
    echo -e "Oracle Health:   ${GREEN}http://localhost:4000/health${NC}"
else
    echo -e "Oracle API:      ${YELLOW}http://localhost:4000${NC} (stopped)"
    echo -e "Oracle Health:   ${YELLOW}http://localhost:4000/health${NC} (stopped)"
fi
echo ""

echo -e "${CYAN}📊 System Logs${NC}"
echo "─────────────────────────────────────────────────"
if [ -f "logs/oracle.log" ]; then
    LOG_SIZE=$(du -h logs/oracle.log | cut -f1)
    echo -e "Oracle Log: ${GREEN}logs/oracle.log${NC} ($LOG_SIZE)"
    echo -e "   View: ${CYAN}tail -f logs/oracle.log${NC}"
else
    echo -e "Oracle Log: ${YELLOW}Not available${NC}"
fi

if [ -f "logs/ui.log" ]; then
    LOG_SIZE=$(du -h logs/ui.log | cut -f1)
    echo -e "UI Log:     ${GREEN}logs/ui.log${NC} ($LOG_SIZE)"
    echo -e "   View: ${CYAN}tail -f logs/ui.log${NC}"
else
    echo -e "UI Log:     ${YELLOW}Not available${NC}"
fi
echo ""

echo -e "${CYAN}⚡ Quick Actions${NC}"
echo "─────────────────────────────────────────────────"
if [ $ORACLE_RUNNING -eq 0 ] && [ $UI_RUNNING -eq 0 ]; then
    echo -e "Start System:   ${CYAN}./start-passport-system.sh${NC}"
    echo -e "Or:             ${CYAN}npm start${NC}"
elif [ $ORACLE_RUNNING -eq 1 ] || [ $UI_RUNNING -eq 1 ]; then
    echo -e "Stop System:    ${CYAN}./stop-passport-system.sh${NC}"
    echo -e "Or:             ${CYAN}npm stop${NC}"
    echo -e "Restart:        ${CYAN}npm stop && npm start${NC}"
fi

echo -e "Test Oracle:    ${CYAN}./server/test-endpoints.sh${NC}"
echo -e "Deploy Contract:${CYAN}npm run deploy:contract${NC}"
echo -e "View Docs:      ${CYAN}cat PASSPORT_INTEGRATION_GUIDE.md${NC}"
echo ""

if [ $ORACLE_RUNNING -eq 1 ] && [ $UI_RUNNING -eq 1 ]; then
    echo -e "${GREEN}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         ✅ SYSTEM FULLY OPERATIONAL            ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════╝${NC}"
elif [ $ORACLE_RUNNING -eq 1 ] || [ $UI_RUNNING -eq 1 ]; then
    echo -e "${YELLOW}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${YELLOW}║      ⚠️  SYSTEM PARTIALLY OPERATIONAL          ║${NC}"
    echo -e "${YELLOW}╚════════════════════════════════════════════════╝${NC}"
else
    echo -e "${RED}╔════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║              ⛔ SYSTEM OFFLINE                  ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════╝${NC}"
fi
