# Dashboard Visual Design Guide & Mockups

## 🎨 Design System Overview

### Color Palette
```
Primary Green:    #0C8B44 (Actions, positive)
Success Green:    #4CAF50 (Gains, up)
Error Red:        #f44336 (Losses, down)
Warning Orange:   #FF9800 (Alerts, caution)
Info Blue:        #2196F3 (Information)
Neutral Gray:     #737373 (Secondary text)
Light Gray:       #A0A0A0 (Tertiary text)
Dark BG:          #070C0E (Main background)
Card BG:          #0f1619 (Card background)
Border:           #ffffff05 (Subtle borders)
```

### Typography
```
Headlines:    Light weight (300), -0.03em tracking
Body:         Regular weight (400), 0.5rem line-height
Labels:       Medium weight (500), 0.05em tracking
Mono:         Font-mono for numbers/codes
```

### Spacing
```
xs: 0.25rem (1px)
sm: 0.5rem (2px)
md: 1rem (4px)
lg: 1.5rem (6px)
xl: 2rem (8px)
2xl: 3rem (12px)
```

---

## 📐 IMPROVED DASHBOARD LAYOUT

### Desktop View (1280px+)
```
┌─────────────────────────────────────────────────────────────┐
│ HEADER: Greeting + Toolbar                                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ NET WORTH HERO CARD (Full Width)                        │ │
│ │ $125,432.50 | +12.5% | Chart | Range Picker            │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌──────────────┬──────────────┬──────────────┐              │
│ │ P&L Card     │ Best Perf    │ Holdings     │              │
│ │ +$5,234      │ +45.2%       │ 8 assets     │              │
│ └──────────────┴──────────────┴──────────────┘              │
│                                                               │
│ ┌─┬─┬─┬─┬─┬─┐                                               │
│ │D│W│T│Tr│C│A│ Quick Actions (6 buttons)                   │
│ └─┴─┴─┴─┴─┴─┘                                               │
│                                                               │
│ ┌──────────────┬──────────────┬──────────────┐              │
│ │ Morning      │ Performance  │ Portfolio    │              │
│ │ Brief        │ Attribution  │ Health       │              │
│ └──────────────┴──────────────┴──────────────┘              │
│                                                               │
│ ┌──────────────┬──────────────┐                             │
│ │ Risk         │ Allocation   │                             │
│ │ Metrics      │ Status       │                             │
│ └──────────────┴──────────────┘                             │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Portfolio Breakdown (Holdings + Chart)                  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Wallet Balances                                         │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌──────────────┬──────────────┬──────────────┐              │
│ │ AI Insights  │ Alerts       │ Goals        │              │
│ └──────────────┴──────────────┴──────────────┘              │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Category Breakdown                                      │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
│ ┌──────────────┬──────────────┬──────────────┐              │
│ │ Staking      │ DCA          │ Watchlist    │              │
│ └──────────────┴──────────────┴──────────────┘              │
│                                                               │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Market Overview (Top 6 Movers)                          │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Mobile View (375px)
```
┌──────────────────────────┐
│ HEADER                   │
├──────────────────────────┤
│ NET WORTH HERO           │
│ (Full width, stacked)    │
├──────────────────────────┤
│ QUICK STATS (Scrollable) │
│ ← P&L | Best | Holdings →│
├──────────────────────────┤
│ QUICK ACTIONS (2 cols)   │
│ ┌──────┬──────┐          │
│ │ Dep  │ Wth  │          │
│ ├──────┼──────┤          │
│ │ Trd  │ Trn  │          │
│ ├──────┼──────┤          │
│ │ Conv │ Act  │          │
│ └──────┴──────┘          │
├──────────────────────────┤
│ INSIGHTS (Stacked)       │
│ ┌──────────────────────┐ │
│ │ Morning Brief        │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ Performance Attr.    │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ Portfolio Health     │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│ RISK & ALLOCATION        │
│ ┌──────────────────────┐ │
│ │ Risk Metrics         │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ Allocation Status    │ │
│ └──────────────────────┘ │
├──────────────────────────┤
│ ... (rest stacked)       │
└──────────────────────────┘
```

---

## 🎯 COMPONENT SPECIFICATIONS

### 1. Performance Attribution Card

**Dimensions:** 
- Desktop: 1/3 width (400px)
- Mobile: Full width

**Content Layout:**
```
┌─────────────────────────────┐
│ 📊 Performance Attribution  │ View all →
├─────────────────────────────┤
│ Total P&L    │ Win Rate │ Holdings
│ +$5,234      │ 65%      │ 8
│ +12.5%       │ 13 trades│ assets
├─────────────────────────────┤
│ ▲ Top Gainers
│ • BTC +$2,100 (+8.5%)
│ • ETH +$1,200 (+6.2%)
│ • SOL +$450   (+3.1%)
├─────────────────────────────┤
│ ▼ Top Losers
│ • ADA -$200   (-2.1%)
│ • XRP -$150   (-1.8%)
│ • DOGE -$100  (-0.9%)
└─────────────────────────────┘
```

**Colors:**
- Gainers: #4CAF50 (green)
- Losers: #f44336 (red)
- Icons: #FF9800 (orange)

---

### 2. Risk Metrics Card

**Dimensions:**
- Desktop: 1/2 width (600px)
- Mobile: Full width

**Content Layout:**
```
┌──────────────────────────────────┐
│ ⚠️ Risk Metrics        [HIGH]    │
├──────────────────────────────────┤
│ Portfolio Risk: HIGH             │
│ ████████░░░░░░░░░░░░░░░░░░░░░░  │
├──────────────────────────────────┤
│ 7-Day Vol.  │ 30-Day Vol. │ Max DD
│ 8.45%       │ 12.67%      │ 5.23%
│ annualized  │ estimated   │ 7-day
├──────────────────────────────────┤
│ Sharpe Ratio: 0.85 (risk-adjusted)
├──────────────────────────────────┤
│ ⚠️ Your portfolio has high        │
│ volatility. Consider diversifying.│
└──────────────────────────────────┘
```

**Risk Levels:**
- Low: #4CAF50 (0-2%)
- Medium: #FFC107 (2-5%)
- High: #FF9800 (5-10%)
- Very High: #f44336 (10%+)

---

### 3. Allocation Status Card

**Dimensions:**
- Desktop: 1/2 width (600px)
- Mobile: Full width

**Content Layout:**
```
┌──────────────────────────────────┐
│ 📊 Allocation Status  [Rebalance]│
├──────────────────────────────────┤
│ Max Drift: 8.5%                  │
│ ████████░░░░░░░░░░░░░░░░░░░░░░  │
│ ⚠️ Rebalancing recommended       │
├──────────────────────────────────┤
│ Current vs Target                │
│ BTC: 45.2% → 60.0%              │
│ ███████░░░░░░░░░░░░░░░░░░░░░░░  │
│ ETH: 35.1% → 20.0%              │
│ █████░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ SOL: 19.7% → 20.0%              │
│ ██████░░░░░░░░░░░░░░░░░░░░░░░░  │
├──────────────────────────────────┤
│ ✓ Rebalance to maintain your     │
│ desired risk profile.             │
└──────────────────────────────────┘
```

**Visual Elements:**
- Current: #2196F3 (blue)
- Target: #0C8B44/30 (green, faded)
- Drift indicator: #FF9800 (orange)

---

## 🎨 CARD STYLING GUIDE

### Standard Card
```tsx
className="p-6 rounded-xl bg-[#0f1619]/50 border border-[#ffffff05]"
```

### Highlighted Card (Important)
```tsx
className="p-6 rounded-xl bg-gradient-to-br from-[#0C8B44]/10 via-[#0f1619]/50 to-[#6A0DAD]/10 border border-[#0C8B44]/20"
```

### Alert Card (Warning)
```tsx
className="p-4 rounded-xl bg-[#FF9800]/10 border border-[#FF9800]/30"
```

### Success Card
```tsx
className="p-4 rounded-xl bg-[#4CAF50]/10 border border-[#4CAF50]/30"
```

---

## 📊 DATA VISUALIZATION PATTERNS

### Progress Bar
```tsx
<div className="h-2 bg-[#1a1a1a] rounded-full overflow-hidden">
  <div
    className="h-full rounded-full transition-all"
    style={{
      width: `${percentage}%`,
      background: color,
    }}
  />
</div>
```

### Metric Display
```tsx
<div>
  <p className="text-[10px] uppercase text-[#737373] mb-1">Label</p>
  <p className="text-lg font-light text-[#E5E5E5]">Value</p>
  <p className="text-[10px] text-[#737373]">Subtitle</p>
</div>
```

### Comparison Row
```tsx
<div className="flex items-center justify-between text-xs">
  <span className="text-[#E5E5E5]">Label</span>
  <div className="flex items-center gap-2">
    <span className="text-[#A0A0A0]">Current</span>
    <span className="text-[#737373]">→</span>
    <span className="text-[#0C8B44]">Target</span>
  </div>
</div>
```

---

## 🎯 INTERACTION PATTERNS

### Hover States
```tsx
className="hover:border-[#0C8B44]/40 hover:bg-[#0C8B44]/5 transition-all"
```

### Active States
```tsx
className="border-[#0C8B44] bg-[#0C8B44]/10"
```

### Disabled States
```tsx
className="opacity-50 cursor-not-allowed"
```

### Loading States
```tsx
<div className="animate-pulse">
  <Skeleton className="h-4 w-full mb-2" />
  <Skeleton className="h-4 w-3/4" />
</div>
```

---

## 📱 RESPONSIVE BREAKPOINTS

```
Mobile:    < 640px   (sm)
Tablet:    640-1024px (md, lg)
Desktop:   > 1024px  (xl, 2xl)
```

### Grid Adjustments
```tsx
// 1 column on mobile, 2 on tablet, 3 on desktop
className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"

// 2 columns on mobile, 3 on tablet, 6 on desktop
className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
```

---

## 🎨 ANIMATION GUIDELINES

### Smooth Transitions
```tsx
className="transition-all duration-300"
```

### Pulse Animation (Live Data)
```tsx
className="animate-pulse"
```

### Slide In
```tsx
className="animate-in slide-in-from-left"
```

### Fade In
```tsx
className="animate-in fade-in"
```

---

## ♿ ACCESSIBILITY CHECKLIST

- [ ] All interactive elements are keyboard accessible
- [ ] Color contrast ratio > 4.5:1 for text
- [ ] Icons have aria-labels
- [ ] Form inputs have associated labels
- [ ] Focus states are visible
- [ ] Screen reader friendly
- [ ] Reduced motion respected
- [ ] Touch targets > 44x44px on mobile

---

## 🚀 PERFORMANCE TARGETS

| Metric | Target | Current |
|--------|--------|---------|
| Page Load | < 2s | ? |
| Widget Render | < 500ms | ? |
| API Response | < 1s | ? |
| Interaction | < 100ms | ? |
| Lighthouse Score | > 90 | ? |

---

## 📋 IMPLEMENTATION CHECKLIST

- [ ] Copy 3 new component files
- [ ] Update Dashboard.tsx layout
- [ ] Test on desktop (1920px, 1440px, 1280px)
- [ ] Test on tablet (768px, 1024px)
- [ ] Test on mobile (375px, 414px)
- [ ] Verify all colors match design
- [ ] Check spacing and alignment
- [ ] Test keyboard navigation
- [ ] Verify screen reader compatibility
- [ ] Performance test with DevTools
- [ ] Cross-browser testing
- [ ] User acceptance testing

---

## 🎉 DESIGN SYSTEM COMPLETE

This guide ensures consistency across all dashboard components and provides a solid foundation for future enhancements.

