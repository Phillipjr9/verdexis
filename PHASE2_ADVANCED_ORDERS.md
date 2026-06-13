# Phase 2 Part 2: Advanced Orders + Order Book - Implementation Summary

## Overview
Professional trading features:
1. **Advanced Order Types**: Market, Limit, Stop, Trailing Stop, Bracket orders
2. **Order Book Depth**: Real bid/ask visualization with market depth

## What's Implemented

### 1. Database Schema (Updated)
✅ New `Order` model in Prisma schema with fields for:
- Basic: `symbol`, `side` (buy/sell), `type`, `status`
- Pricing: `basePrice`, `limitPrice`, `stopPrice`
- Trailing Stop: `trailAmount`, `trailType` (amount or %)
- Bracket Orders: `takeProfitPrice`, `stopLossPrice`
- Execution: `amount`, `filledAmount`, `timeInForce`
- Lifecycle: `expiresAt`, `filledAt`, `cancelledAt`
- Relationships: `parentOrderId` (links TP/SL to entry order)

### 2. Backend Services to Create

#### A. `server/src/services/advancedOrders.ts`
Core order evaluation logic:
```typescript
- evaluateTrailingStop(order, currentPrice, highPrice): boolean
- evaluateStop(order, currentPrice): boolean
- evaluateLimit(order, currentPrice): boolean
- isExpired(order): boolean
- isClosed(order): boolean
```

#### B. `server/src/services/orderExecutor.ts`
Order execution:
```typescript
- executeMarketOrder(userId, symbol, side, amount, price)
- executeLimitOrder(userId, symbol, side, amount, limitPrice, currentPrice)
- executeTrailingStop(userId, symbol, side, amount, trail, trailType, price, highPrice)
- executeBracketOrder(userId, symbol, side, amount, entry, tp, sl, price)
- updateOrderFromWebSocket(orderId, currentPrice)
```

#### C. `server/src/services/orderBook.ts`
Market depth data:
```typescript
- fetchOrderBook(symbol, depth=20): {bids[], asks[]}
- normalizeDepth(asks, bids): {levels, imbalance, midPrice}
- calculateSpread(asks, bids): {absolute, percentage}
```

#### D. `server/src/routes/orders.ts`
Complete REST API:
```
POST   /api/orders                 - Create order (market/limit/stop/trailing/bracket)
GET    /api/orders                 - List user's orders
GET    /api/orders/:id             - Get order details
PATCH  /api/orders/:id             - Update order (modify price, cancel, etc.)
DELETE /api/orders/:id             - Cancel order
GET    /api/orderbook/:symbol      - Get order book depth
GET    /api/orderbook/:symbol/stats - Market microstructure stats
POST   /api/orders/bracket         - Create bracket order (entry + TP + SL)
POST   /api/orders/trailing-stop   - Create trailing stop order
```

#### E. `server/src/jobs/orderPoller.ts`
Background job (runs every 1-5 seconds):
```
- Query all open orders
- For each order, evaluate trigger conditions (stop price, limit price, trail)
- Execute when conditions met
- Update order status
- Send WebSocket notifications to clients
```

### 3. Frontend Components to Create

#### A. `app/src/components/OrderBookChart.tsx`
Visual order book:
- Bid side (green) + Ask side (red) columns
- Price axis (Y)
- Cumulative volume axis (X)
- Hover to see exact prices/sizes
- Real-time updates via WebSocket

#### B. `app/src/components/AdvancedOrderForm.tsx`
Order creation UI:
- Type selector: Market, Limit, Stop, Trailing Stop, Bracket
- Conditional fields based on order type
- Price input with % indicators
- Risk/reward preview for brackets
- Fee estimation

#### C. `app/src/components/OrdersList.tsx`
Active/recent orders:
- Status badges (open, filled, pending)
- Quick cancel button
- Edit price for limit orders
- Execution price display

#### D. `app/src/pages/Trading.tsx` (Enhanced)
Full trading page with:
- Order book on left
- Chart in center
- Order form on right
- Orders list below
- Real-time updates

### 4. WebSocket Integration

#### Broadcast Messages
```json
{
  "type": "order_filled",
  "data": {
    "orderId": "order-123",
    "filledPrice": 45230.50,
    "filledAmount": 0.5,
    "timestamp": 1704067200000
  }
}

{
  "type": "order_cancelled",
  "data": {
    "orderId": "order-123",
    "reason": "user_requested"
  }
}

{
  "type": "order_expired",
  "data": {
    "orderId": "order-123"
  }
}
```

---

## API Examples

### 1. Create Market Order
```bash
curl -X POST /api/orders \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "symbol": "bitcoin",
    "side": "buy",
    "type": "market",
    "amount": 0.5
  }'

Response: {
  "id": "order-123",
  "status": "filled",
  "filledPrice": 45230.50,
  "filledAmount": 0.5,
  "total": 22615.25
}
```

### 2. Create Limit Order
```bash
curl -X POST /api/orders \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "symbol": "ethereum",
    "side": "buy",
    "type": "limit",
    "amount": 1.0,
    "limitPrice": 2500,
    "timeInForce": "GTC"
  }'

Response: {
  "id": "order-456",
  "status": "open",
  "limitPrice": 2500,
  "amount": 1.0,
  "expiresAt": null
}
```

### 3. Create Trailing Stop
```bash
curl -X POST /api/orders \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "symbol": "solana",
    "side": "sell",
    "type": "trailing_stop",
    "amount": 10,
    "trailAmount": 5,
    "trailType": "percent",
    "basePrice": 150.00
  }'

Response: {
  "id": "order-789",
  "status": "open",
  "type": "trailing_stop",
  "trailAmount": 5,
  "trailType": "percent",
  "highPrice": 150.00
}
```

### 4. Create Bracket Order
```bash
curl -X POST /api/orders/bracket \
  -H "Authorization: Bearer $JWT" \
  -d '{
    "symbol": "bitcoin",
    "side": "buy",
    "amount": 1.0,
    "entryPrice": 45000,
    "takeProfitPrice": 47000,
    "stopLossPrice": 43000
  }'

Response: {
  "entryOrderId": "order-entry",
  "tpOrderId": "order-tp",
  "slOrderId": "order-sl",
  "status": "open"
}
```

### 5. Get Order Book
```bash
curl /api/orderbook/bitcoin

Response: {
  "symbol": "bitcoin",
  "bids": [
    {"price": 45230.00, "size": 0.5},
    {"price": 45225.00, "size": 1.2},
    {"price": 45220.00, "size": 2.1}
  ],
  "asks": [
    {"price": 45235.00, "size": 0.8},
    {"price": 45240.00, "size": 1.5},
    {"price": 45245.00, "size": 3.2}
  ],
  "spread": {
    "absolute": 5.00,
    "percentage": 0.011
  },
  "midPrice": 45232.50,
  "timestamp": 1704067200000
}
```

---

## Database Queries

### Get User's Active Orders
```sql
SELECT * FROM "Order"
WHERE userId = 'user-id' AND status = 'open'
ORDER BY createdAt DESC;
```

### Get Filled Orders (for performance calculation)
```sql
SELECT * FROM "Order"
WHERE userId = 'user-id' AND status = 'filled'
ORDER BY filledAt DESC
LIMIT 50;
```

### Get Open Trailing Stops
```sql
SELECT * FROM "Order"
WHERE userId = 'user-id' AND type = 'trailing_stop' AND status = 'open'
ORDER BY createdAt DESC;
```

---

## Next: Implementation Steps

### Step 1: Database Migration (30 min)
```bash
npm run db:migrate
```
This creates the `Order` table from Prisma schema.

### Step 2: Create Backend Services (2 hours)
1. Copy `advancedOrders.ts` service
2. Copy `orderExecutor.ts` service
3. Copy `orderBook.ts` service
4. Copy `orderPoller.ts` job
5. Create `/api/orders` routes

### Step 3: Register Routes (15 min)
Add to `server/src/index.ts`:
```typescript
import ordersRoutes from './routes/orders.js'
app.use('/api/orders', ordersRoutes)
app.use('/api/orderbook', ordersRoutes)
```

### Step 4: Create Frontend Components (3 hours)
1. `OrderBookChart.tsx` - Visualization
2. `AdvancedOrderForm.tsx` - Order creation
3. `OrdersList.tsx` - Orders view
4. Update `Trading.tsx` page

### Step 5: Test End-to-End (1 hour)
- Create market order → verify fills instantly
- Create limit order → verify stays open
- Create trailing stop → modify price → verify execution
- Check WebSocket messages

---

## Performance Considerations

### Order Evaluation
- Runs every 1-5 seconds (configurable)
- Queries open orders efficiently (indexed on `status`, `symbol`)
- Uses WebSocket to push updates (no polling on frontend)

### Order Book Caching
- Fetches from Coinbase/CoinGecko every 1-2 seconds
- Cached server-side (not every client fetches)
- Updates all connected clients via WebSocket

### Database Indexes
```sql
CREATE INDEX idx_order_user_status ON "Order"(userId, status, createdAt);
CREATE INDEX idx_order_symbol_status ON "Order"(symbol, status);
CREATE INDEX idx_order_parent ON "Order"(parentOrderId);
```

---

## Risk Management

### Order Validation
- ✅ Check user has sufficient balance before execution
- ✅ Validate order amounts/prices (min/max bounds)
- ✅ Prevent duplicate rapid orders (race conditions)
- ✅ Check holding exists before selling

### Execution Safety
- ✅ Atomic database transactions
- ✅ Retry logic for failed executions
- ✅ Audit log every order event
- ✅ Reconciliation job to fix orphaned orders

---

## Files to Create

**Backend (5 files):**
- [ ] `server/src/services/advancedOrders.ts` - Order evaluation logic
- [ ] `server/src/services/orderExecutor.ts` - Execution engine
- [ ] `server/src/services/orderBook.ts` - Market depth service
- [ ] `server/src/jobs/orderPoller.ts` - Background job
- [ ] `server/src/routes/orders.ts` - REST API

**Frontend (4 files):**
- [ ] `app/src/components/OrderBookChart.tsx`
- [ ] `app/src/components/AdvancedOrderForm.tsx`
- [ ] `app/src/components/OrdersList.tsx`
- [ ] Update `app/src/pages/Trading.tsx`

**Docs:**
- [ ] `ADVANCED_ORDERS_API.md` - API reference
- [ ] `ORDER_TYPES_GUIDE.md` - User guide

---

## Testing Scenarios

1. **Market Order**: Buy 1 BTC at market price → instant fill
2. **Limit Order**: Buy 1 BTC @ $40k, current $45k → stays open
3. **Stop Order**: Sell 1 BTC if drops below $40k → triggers on dip
4. **Trailing Stop**: Sell if drops 5% from high → updates as price rises
5. **Bracket Order**: Buy 1 BTC, TP @ $47k, SL @ $43k → executes all

---

## Cost Impact

- **Database**: +1-2 MB for Order table
- **CPU**: ~100ms per order evaluation (runs every 5s)
- **Bandwidth**: ~50-100 bytes per WebSocket update

---

**Status**: 🔄 Ready for implementation
**Estimated completion**: 6-8 hours end-to-end
**Impact**: Competitive parity with Robinhood, Coinbase Pro, Kraken

---

## Want Me to Implement?

Should I create all 9 files with complete working code? Or would you like to:
1. Start with just the backend services?
2. Start with just the frontend components?
3. Full end-to-end implementation?

Let me know and I'll write all the code!
