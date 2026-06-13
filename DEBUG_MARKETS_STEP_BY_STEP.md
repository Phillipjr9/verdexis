# Debug: Markets Not Showing - Step by Step

## Step 1: Check Backend is Running

Open browser and go to:
```
http://localhost:4000/api/health
```

You should see JSON response like:
```json
{
  "ok": true,
  "service": "verdexis-api",
  "databaseReady": true
}
```

**If you get "Connection refused":**
- Backend not running
- Start it: `cd server && npm run dev`

---

## Step 2: Test Backend Market Endpoint Directly

Open browser and go to:
```
http://localhost:4000/api/market/coingecko/markets?per_page=5
```

You should see JSON array like:
```json
[
  {
    "id": "bitcoin",
    "symbol": "btc",
    "name": "Bitcoin",
    "current_price": 45000,
    "market_cap": 900000000000,
    ...
  },
  ...
]
```

**If you get empty array `[]`:**
- CoinGecko API not responding
- Go to Step 4

**If you get HTTP 502 or 503 error:**
- Backend can't reach CoinGecko
- Check server logs for errors
- Go to Step 4

---

## Step 3: Check Frontend is Running

Open browser to:
```
http://localhost:5173
```

You should see VERDEXIS home page. If blank page or error:
- Frontend not running
- Start it: `cd app && npm run dev`

---

## Step 4: Test Direct CoinGecko (No Proxy)

In browser console (F12), run:
```javascript
fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=5')
  .then(r => r.json())
  .then(d => console.log('SUCCESS:', d))
  .catch(e => console.error('FAILED:', e))
```

**If SUCCESS:** CoinGecko is reachable, backend might have issue
**If FAILED (CORS error):** That's expected - CORS blocks browser, backend should proxy it
**If FAILED (network):** CoinGecko is down or you're offline

---

## Step 5: Open Markets Page with Console

1. Open Markets page: http://localhost:5173/markets
2. Open DevTools (F12)
3. Go to Console tab
4. Look for logs like:
   ```
   [marketData] fetching fresh crypto list...
   [marketData] fetched 250 coins, caching...
   [Markets] received 250 coins
   ```

**What you might see:**

### ✅ Success (logs show coins):
```
[marketData] fetching fresh crypto list...
[marketData] fetched 250 coins, caching...
[Markets] received 250 coins
```
→ Markets should show 250 coins in table

### ⚠️ API Cooldown:
```
[marketData] API in cooldown, checking for stale cache...
[marketData] no stale cache available
[Markets] received 0 coins
```
→ Wait 15 seconds and refresh page

### ❌ API Failed (CoinGecko unreachable):
```
[marketData] fetching fresh crypto list...
[marketData] getCryptoList failed: Error: CoinGecko API error: 502
[marketData] no data available, returning empty
[Markets] received 0 coins
```
→ Backend can't reach CoinGecko, check Step 4

---

## Step 6: Check Network Tab

In DevTools:
1. Go to Network tab
2. Refresh page
3. Look for request: `/api/market/coingecko/markets`

**Expected:**
- Status: 200
- Response: Array of coins JSON

**If Status 502/503:**
- Click on request
- Go to Response tab
- See what error backend returned

**If request shows error:**
- Copy exact error message
- Check server logs with: `npm run dev 2>&1 | grep market`

---

## Step 7: Check Server Logs

In terminal where backend is running, you should see:
```
[market] ...
```

**Look for errors like:**
- `[market] coingecko failed: ...`
- `[market] timeout`
- `ECONNREFUSED` (can't connect to CoinGecko)

Copy the exact error message.

---

## Quick Fixes

### Fix 1: Restart Everything
```bash
# Terminal 1: Kill backend (Ctrl+C)
# Wait 2 seconds
cd server && npm run dev

# Terminal 2: Kill frontend (Ctrl+C)
# Wait 2 seconds
cd app && npm run dev

# Browser: Refresh (Ctrl+R)
```

### Fix 2: Clear Frontend Cache
In browser console:
```javascript
localStorage.clear()
location.reload()
```

### Fix 3: Add CoinGecko API Key

If CoinGecko keeps failing, get free key from:
https://www.coingecko.com/en/api/documentation

Add to `server/.env`:
```
COINGECKO_API_KEY=your_demo_key_here
COINGECKO_API_TIER=demo
```

Restart backend.

### Fix 4: Check Internet Connection

```bash
# In terminal
ping api.coingecko.com

# Should show responses, not "No route to host"
```

---

## Complete Test Sequence

Run this in order:

```bash
# 1. Check backend health
curl http://localhost:4000/api/health

# 2. Check backend market endpoint
curl http://localhost:4000/api/market/coingecko/markets?per_page=5

# 3. Check CoinGecko directly
curl "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&per_page=5"

# Expected: All three should return JSON arrays
```

---

## Report These Details If Still Not Working

If you complete all steps and markets still don't show, share:

1. **Console logs from Markets page** (F12 → Console → screenshot/text)
2. **Network request response** (F12 → Network → `/api/market/coingecko/markets` → Response tab)
3. **Server logs from backend** (output of `npm run dev`)
4. **Result of test commands above**

This will help identify exactly where the issue is.

---

## Expected Timeline

1. Open Markets page → Should say "Loading…" for 2-3 seconds
2. Console shows: `[marketData] fetched 250 coins`
3. Markets page shows table with coins
4. Prices update every 30 seconds
5. 24h changes show in red/green
6. Sparkline charts visible

If you see "Loading…" forever → API request failing
If you see empty table → Coins array is empty
If you see skeletons then empty → API returned no data
