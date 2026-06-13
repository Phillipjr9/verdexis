#!/bin/bash
# Quick market data debug script

echo "Testing market data endpoints..."
echo ""

# Test 1: Backend health
echo "1. Checking backend health..."
curl -s http://localhost:4000/api/health | jq . || echo "FAILED"
echo ""

# Test 2: Market tickers
echo "2. Testing /api/market/tickers..."
curl -s "http://localhost:4000/api/market/tickers?ids=bitcoin,ethereum" | jq . || echo "FAILED"
echo ""

# Test 3: CoinGecko markets proxy
echo "3. Testing /api/market/coingecko/markets..."
curl -s "http://localhost:4000/api/market/coingecko/markets?per_page=5" | jq . || echo "FAILED"
echo ""

# Test 4: Direct CoinGecko (no proxy)
echo "4. Testing direct CoinGecko..."
curl -s "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=5" | jq . || echo "FAILED - CoinGecko unreachable"
echo ""

echo "If all tests show data, markets should work in the UI."
