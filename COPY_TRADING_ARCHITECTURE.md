# Copy Trading Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         PHASE 1: BACKEND                         │
│                    (What We Just Built ✅)                       │
└─────────────────────────────────────────────────────────────────┘

┌──────────────┐         ┌──────────────┐         ┌──────────────┐
│   Database   │◄────────│   API Routes │◄────────│    Client    │
│  (3 Tables)  │         │  (9 Endpoints)│         │ (Phase 2 🔜) │
└──────────────┘         └──────────────┘         └──────────────┘
       │                         │
       │                         │
       ▼                         ▼
TraderProfile          GET /leaderboard
CopyRelationship       GET /trader/:id
CopyTrade              GET /my-profile
                       PATCH /my-profile
                       POST /follow
                       POST /unfollow
                       GET /following
                       GET /followers
                       GET /my-copy-trades
```

---

## Database Relationships

```
┌─────────────┐
│    User     │
│  (existing) │
└─────┬───────┘
      │
      ├─────────────────┐
      │                 │
      │                 │
      ▼                 ▼
┌─────────────┐   ┌─────────────────┐
│TraderProfile│   │CopyRelationship │
│ (1:1)       │   │ (many:many)     │
└─────────────┘   └────────┬────────┘
                           │
                           │
                           ▼
                    ┌─────────────┐
                    │  CopyTrade  │
                    │  (history)  │
                    └─────────────┘
```

---

## User Flow: Becoming a Trader

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: User Enables Copy Trading                           │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              PATCH /api/copy-trading/my-profile
              {
                "displayName": "CryptoKing",
                "bio": "10 years trading experience",
                "isPublic": true,           ← Makes profile visible
                "allowCopying": true,       ← Enables copying
                "minCopyAmount": 500,       ← Min. $500 to copy
                "maxCopiers": 50,           ← Max 50 copiers
                "performanceFee": 10        ← 10% fee on profits
              }
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: User Makes Trades                                   │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              POST /api/trades (existing endpoint)
              {
                "symbol": "BTC",
                "side": "buy",
                "amount": 0.1,
                "price": 100000
              }
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Performance Tracked (Phase 3 🔜)                    │
│ - Calculate ROI (30d, 90d, all-time)                        │
│ - Calculate win rate                                         │
│ - Update rank on leaderboard                                │
└─────────────────────────────────────────────────────────────┘
```

---

## User Flow: Copying a Trader

```
┌─────────────────────────────────────────────────────────────┐
│ Step 1: Follower Browses Leaderboard                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              GET /api/copy-trading/leaderboard?period=30d
                           │
                           ▼
              Returns: Top 50 traders sorted by ROI
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 2: Follower Clicks "Copy This Trader"                  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              POST /api/copy-trading/follow
              {
                "traderId": "clx123...",
                "allocationUsd": 1000,      ← Invest $1000
                "allocationPercent": 100    ← Copy 100% of trades
              }
                           │
                           ▼
              ✅ CopyRelationship created
              ✅ Trader's activeCopiers++
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 3: Trader Makes a Trade                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
              POST /api/trades (existing)
              {
                "symbol": "ETH",
                "side": "buy",
                "amount": 2
              }
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Step 4: Follower's Trade Copied (Phase 3 🔜)                │
│ - Calculate follower's amount:                              │
│   $1000 allocation × 100% = $1000                           │
│ - If trader bought $5000 of ETH                             │
│   Follower buys: ($1000/$5000) × 2 ETH = 0.4 ETH           │
│ - Create CopyTrade record                                   │
│ - Execute trade via existing /api/trades                    │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Leaderboard Query
```
Client
  │
  ├─► GET /api/copy-trading/leaderboard
  │
Server
  │
  ├─► SELECT * FROM TraderProfile
  │   WHERE isPublic = true AND allowCopying = true
  │   ORDER BY roi30d DESC
  │   LIMIT 50
  │
Database
  │
  └─► Returns: [
        {
          displayName: "CryptoWhale",
          roi30d: 45.2%,
          winRate: 78%,
          activeCopiers: 23,
          verified: true
        },
        ...
      ]
```

### Follow/Unfollow Flow
```
Client
  │
  ├─► POST /api/copy-trading/follow
  │   Body: { traderId, allocationUsd }
  │
Server
  │
  ├─► Validate:
  │   ✓ User not copying themselves
  │   ✓ Trader exists and allows copying
  │   ✓ Amount >= minCopyAmount
  │   ✓ Trader hasn't hit maxCopiers
  │
  ├─► INSERT INTO CopyRelationship
  │   (followerId, traderId, allocationUsd, status='active')
  │
  ├─► UPDATE TraderProfile
  │   SET activeCopiers = activeCopiers + 1
  │   WHERE userId = traderId
  │
Database
  │
  └─► Returns: { relationship: {...}, success: true }
```

---

## Performance Calculation (Phase 3)

```
┌─────────────────────────────────────────────────────────────┐
│ ROI Calculation (Return on Investment)                      │
└─────────────────────────────────────────────────────────────┘

ROI = (Current Portfolio Value - Initial Investment) / Initial Investment

Example:
- Started with: $10,000
- Current value: $14,500
- ROI = ($14,500 - $10,000) / $10,000 = 45%

Calculate for:
- roi30d: Last 30 days
- roi90d: Last 90 days
- roiAllTime: Since account creation
```

```
┌─────────────────────────────────────────────────────────────┐
│ Win Rate Calculation                                         │
└─────────────────────────────────────────────────────────────┘

Win Rate = (Profitable Trades / Total Trades) × 100

Example:
- Total trades: 100
- Profitable: 78
- Losing: 22
- Win Rate = (78 / 100) × 100 = 78%
```

---

## Security & Validation

### Input Validation
```typescript
// Follow a trader
POST /api/copy-trading/follow
{
  "traderId": "clx123...",        // ✓ Must be valid user ID
  "allocationUsd": 500,           // ✓ Must be >= trader's minCopyAmount
  "allocationPercent": 100        // ✓ Must be 0-100
}

Checks:
1. ✓ User authenticated (JWT valid)
2. ✓ User not copying themselves
3. ✓ Trader exists and allows copying
4. ✓ Amount meets minimum
5. ✓ Trader hasn't hit maxCopiers limit
6. ✓ User has sufficient balance (Phase 3)
7. ✓ Not already following this trader
```

### Rate Limiting
```
Already implemented in server/src/app.ts:
- 600 requests/minute per user
- Applies to all /api/copy-trading/* endpoints
```

---

## Indexing Strategy

### Database Indexes (for Performance)

```sql
-- Fast leaderboard queries
CREATE INDEX TraderProfile_isPublic_allowCopying_idx 
  ON TraderProfile(isPublic, allowCopying);

-- Sort by ROI
CREATE INDEX TraderProfile_roi30d_idx 
  ON TraderProfile(roi30d DESC);

-- Find user's followers
CREATE INDEX CopyRelationship_traderId_status_idx 
  ON CopyRelationship(traderId, status);

-- Find user's following
CREATE INDEX CopyRelationship_followerId_status_idx 
  ON CopyRelationship(followerId, status);

-- Copy trade history
CREATE INDEX CopyTrade_followerId_createdAt_idx 
  ON CopyTrade(followerId, createdAt DESC);
```

---

## Phase Roadmap

### ✅ Phase 1: Backend Foundation (DONE)
- Database schema
- API endpoints
- Trader profiles
- Follow/unfollow
- Leaderboard

### 🔜 Phase 2: Frontend UI (Next)
- Leaderboard page
- Trader detail page
- Copy trading dashboard
- Settings integration

### 🔮 Phase 3: Auto-Copying (Future)
- Listen for trades
- Calculate proportional amounts
- Execute copy trades
- Update statistics

### 🔮 Phase 4: Monetization (Future)
- Performance fee calculation
- Payment processing
- Payout schedules
- Tax reporting

### 🔮 Phase 5: Advanced Features (Future)
- Real-time notifications
- Stop-loss for copying
- Copy limits per asset
- Smart rebalancing
- Social feed

---

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────┐
│ Unit Tests (TODO)                                            │
└─────────────────────────────────────────────────────────────┘
- Test each API endpoint independently
- Mock database queries
- Validate input sanitization
- Check error handling

┌─────────────────────────────────────────────────────────────┐
│ Integration Tests (TODO)                                     │
└─────────────────────────────────────────────────────────────┘
- Test full follow → trade → copy flow
- Verify database transactions
- Check for race conditions
- Test concurrent requests

┌─────────────────────────────────────────────────────────────┐
│ Load Tests (TODO)                                            │
└─────────────────────────────────────────────────────────────┘
- 1000 users browsing leaderboard simultaneously
- 100 traders making trades at same time
- Database query performance under load
```

---

## Monitoring & Metrics

### Key Metrics to Track (Phase 4)

```
Business Metrics:
- Total traders (isPublic=true, allowCopying=true)
- Total copiers (active CopyRelationships)
- Total AUM (sum of all allocationUsd)
- Average copy amount
- Top traders by copiers
- Revenue from performance fees

Technical Metrics:
- API response times
- Database query performance
- Error rates per endpoint
- Cache hit rates
- WebSocket connections (when added)
```

---

This architecture is designed to be **scalable**, **safe**, and **incremental**. Each phase builds on the previous one without breaking existing functionality. 🚀
