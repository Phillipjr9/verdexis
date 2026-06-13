# Live Markets Data - Troubleshooting

## Issue: Markets page showing empty or not loading

### Quick Checklist

1. **Backend running?**
   ```bash
   npm run dev
   # Should show: [verdexis-api] listening on http://0.0.0.0:4000
   ```

2. **Frontend running?**
   ```bash
   cd app
   npm run dev
   # Should show: VITE v5.x ... Local: http://localhost:5173
   ```

3. **Check browser console** (F12)
   - Open Markets page
   - Look for errors in Console tab
   - Check Network tab for `/api/market/coingecko/markets` requests

### Common Issues & Fixes

#### Issue 1: CoinGecko API Cooldown Active
**Symptom**: Markets page loads but shows empty list

**Root Cause**: The `marketData` service has a 45-second cooldown after API failures

**Fix**: 
Clear the cooldown by waiting or restarting frontend:
```bash
# Kill the frontend dev server (Ctrl+C)
# Wait 5 seconds
# Restart it
npm run dev
```

#### Issue 2: Backend not proxying CoinGecko
**Symptom**: Network tab shows `/api/market/coingecko/markets` returning 502/503

**Root Cause**: Backend can't reach CoinGecko API

**Fix**:
```bash
# Check server logs for:
# [market] coingecko failed: ...

# Try accessing directly:
curl "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=10"
# Should return JSON

# If blocked, try with user-agent:
curl -A "Mozilla/5.0" "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=10"
```

#### Issue 3: Vite Proxy Not Working
**Symptom**: Frontend shows CORS error or 404 on `/api/market/...`

**Root Cause**: Vite dev proxy misconfigured

**Fix**:
Check `app/vite.config.ts` has:
```typescript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:4000',
      changeOrigin: true,
    }
  }
}
```

If missing, restart Vite.

#### Issue 4: Markets Page Cached Bad Data
**Symptom**: Markets page always empty even after restart

**Root Cause**: Browser localStorage has corrupted data

**Fix**:
Clear in DevTools Console:
```javascript
// Clear all VERDEXIS data
Object.keys(localStorage).forEach(k => {
  if (k.includes('verdexis')) localStorage.removeItem(k)
})

// Reload page
location.reload()
```

### Debug Steps

**Step 1: Check Backend Market Endpoint**
```bash
curl http://localhost:4000/api/market/coingecko/markets?per_page=5
```

Expected response:
```json
[
  {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "current_price": 45000,
    ...
  },
  ...
]
```

If you get error, check server logs.

**Step 2: Check Frontend API Call**
Open browser DevTools (F12) → Console:
```javascript
// Manually test the fetch
fetch('/api/market/coingecko/markets?per_page=5')
  .then(r => r.json())
  .then(d => console.log('DATA:', d))
  .catch(e => console.error('ERROR:', e))
```

**Step 3: Check CoinGecko Directly**
```bash
curl -A "Mozilla/5.0" "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=5"
```

If CoinGecko returns 429 (rate limited), wait 30 seconds and try again.

### Enable Debug Logging

**Backend - Add to `marketData.getCryptoList()` in `app/src/lib/marketData.ts`:**

```typescript
async getCryptoList(): Promise<CryptoQuote[]> {
  const cacheKey = 'crypto_list'
  const cached = this.getCached<CryptoQuote[]>(cacheKey, this.cryptoCacheDuration)
  if (cached) {
    console.debug('[marketData] returning cached crypto list:', cached.length)
    return cached
  }

  if (this.isApiCoolingDown()) {
    console.warn('[marketData] API in cooldown, returning stale data')
    ...
  }

  try {
    console.debug('[marketData] fetching fresh crypto list...')
    const response = await fetch(...)
    ...
  } catch (error) {
    console.error('[marketData] getCryptoList failed:', error)
    this.markApiFailed()
    ...
  }
}
```

Then check browser Console for debug messages.

### Network Issues

**If CoinGecko blocked:**

Set a CoinGecko API key in `server/.env`:
```env
COINGECKO_API_KEY=your_demo_key
COINGECKO_API_TIER=demo
```

Keys available free at: https://www.coingecko.com/api/documentation

**If still blocked:**

The fallback is Coinbase Exchange (hardcoded, no key needed):
- Check `server/src/routes/market.ts`
- Function `fetchOne()` calls Coinbase for prices
- Should work even if CoinGecko is down

### Production Checklist

- [ ] CoinGecko API key configured in `server/.env`
- [ ] Backend successfully reaching CoinGecko (check server logs)
- [ ] Frontend successfully reaching backend at `/api/market`
- [ ] Markets page loads with 250+ coins
- [ ] Prices update every 30 seconds
- [ ] No 502/503 errors in Network tab

### Test Data Flow

```
User opens Markets page
    ↓
Frontend: GET /api/market/coingecko/markets?per_page=250
    ↓
Backend: Requests https://api.coingecko.com/api/v3/coins/markets
    ↓
CoinGecko returns 250 coin objects
    ↓
Backend caches for 30 seconds
    ↓
Frontend receives data
    ↓
Renders table with prices + 7d sparkline
    ↓
Every 30s: Frontend refetches
    ↓
Every 1s: Live ticker updates individual prices from Coinbase WebSocket
```

### Support Commands

```bash
# Check backend is running
curl http://localhost:4000/api/health

# Check backend can reach CoinGecko
curl http://localhost:4000/api/market/tickers?ids=bitcoin,ethereum

# Check specific endpoint
curl http://localhost:4000/api/market/coingecko/markets?per_page=5

# Monitor server logs
npm run dev 2>&1 | grep market

# Test with verbose output
curl -v http://localhost:4000/api/market/coingecko/markets?per_page=5
```

### Still Not Working?

Check these files:
1. `server/src/routes/market.ts` - Backend endpoint logic
2. `app/src/lib/marketData.ts` - Frontend fetch + caching logic
3. `app/src/pages/Markets.tsx` - UI rendering
4. `app/vite.config.ts` - Dev proxy configuration
5. `server/.env` - API keys and configuration

Then share:
1. Browser console errors (screenshot or text)
2. Server logs from `npm run dev`
3. Network tab response for `/api/market/coingecko/markets`
