#!/bin/bash

# Stop all MinaID Passport System services

echo "🛑 Stopping MinaID Passport System..."

# Stop Oracle
pkill -f "oracle-server" && echo "✓ Oracle server stopped" || echo "ℹ Oracle not running"

# Stop UI
pkill -f "next dev" && echo "✓ UI server stopped" || echo "ℹ UI not running"

# Clean up PID files
rm -f logs/oracle.pid logs/ui.pid

echo "✅ All services stopped"
