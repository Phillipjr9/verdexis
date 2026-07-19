#!/bin/bash
# Market Data Diagnostic Script
# Run this to check if all market data endpoints are responding

echo "=== VERDEXIS Market Data Diagnostic ==="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Backend health
echo -e "${YELLOW}Test 1: Backend Health${NC}"
if curl -s http://localhost:4000/api/health | grep -q "verdexis-api"; then
  echo -e "${GREEN}✓ Backend running${NC}"
else
  echo -e "${RED}✗ Backend not responding (expected on http://localhost:4000)${NC}"
  echo "  Start it with: npm run dev"
  exit 1
fi
echo ""

# Test 2: CoinGecko Markets Endpoint
echo -e "${YELLOW}Test 2: CoinGecko Markets (Backend Proxy)${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:4000/api/market/coingecko/markets?per_page=5)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  COUNT=$(echo "$BODY" | grep -o '"id"' | wc -l)
  echo -e "${GREEN}✓ Markets endpoint working${NC}"
  echo "  Returned $COUNT coins"
  echo "  Sample: $(echo "$BODY" | grep -o '"name":"[^"]*"' | head -1)"
else
  echo -e "${RED}✗ Markets endpoint failed (HTTP $HTTP_CODE)${NC}"
  echo "  Response: $BODY"
fi
echo ""

# Test 3: Direct CoinGecko Access
echo -e "${YELLOW}Test 3: Direct CoinGecko API${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" -A "Mozilla/5.0" "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=5")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ CoinGecko API accessible${NC}"
else
  echo -e "${YELLOW}⚠ CoinGecko HTTP $HTTP_CODE (may be rate limited)${NC}"
fi
echo ""

# Test 4: Coinbase Exchange Fallback
echo -e "${YELLOW}Test 4: Coinbase Exchange Fallback${NC}"
RESPONSE=$(curl -s -w "\n%{http_code}" https://api.exchange.coinbase.com/products/BTC-USD/ticker)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
  PRICE=$(echo "$BODY" | grep -o '"price":"[^"]*"' | head -1 | cut -d'"' -f4)
  echo -e "${GREEN}✓ Coinbase Exchange working${NC}"
  echo "  BTC Price: \$$PRICE"
else
  echo -e "${RED}✗ Coinbase Exchange failed (HTTP $HTTP_CODE)${NC}"
fi
echo ""

# Test 5: Frontend Proxy
echo -e "${YELLOW}Test 5: Frontend API Proxy${NC}"
if [ -n "$VITE_PORT" ]; then
  PORT=$VITE_PORT
else
  PORT=5173
fi

RESPONSE=$(curl -s -w "\n%{http_code}" http://localhost:$PORT/api/market/coingecko/markets?per_page=5)
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}✓ Frontend proxy working${NC}"
  echo "  Frontend running on port $PORT"
else
  echo -e "${YELLOW}⚠ Frontend not responding on port $PORT${NC}"
  echo "  Check if: npm run dev is running in app/"
fi
echo ""

# Summary
echo -e "${YELLOW}=== Summary ===${NC}"
echo -e "${GREEN}If all tests show ✓, markets should display live data.${NC}"
echo ""
echo "Troubleshooting:"
echo "1. Backend not running? → cd server && npm run dev"
echo "2. Frontend not running? → cd app && npm run dev"
echo "3. CoinGecko rate limited? → Set COINGECKO_API_KEY in server/.env"
echo "4. Still seeing empty markets? → Check browser console (F12) for errors"
echo ""
