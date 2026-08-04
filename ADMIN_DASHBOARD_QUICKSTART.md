# Admin Dashboard - Quick Start Guide

## What's New

Your admin dashboard now features **real-time charts and monitoring** to track everything happening on your platform.

## Accessing the Dashboard

### Option 1: Main Admin Dashboard (with Charts)
```
Navigate to: /admin
```
- See charts at the top
- Full admin console below
- Toggle charts on/off with the "Show/Hide Charts" button

### Option 2: Full Analytics Page
```
Navigate to: /admin/analytics
```
- Dedicated analytics view
- Time range selector (24h, 7d, 30d)
- 6 detailed charts
- Summary statistics grid
- Manual refresh button

## Dashboard Sections

### 1. KPI Cards (Quick Metrics)
Shows 4 key performance indicators:
- **Total Users** - With 24h signup trend
- **Active Holdings** - With trade count
- **Deposits (24h)** - Compared to withdrawals
- **Pending Review** - KYC + holds + pending deposits

Each card shows:
- Current value
- Trend indicator (↑ green or ↓ red)
- Related metric

### 2. Charts Available

#### User Distribution
- Bar chart showing total users, admins, and suspended accounts
- Helps identify account status breakdown

#### Activity Overview
- Pie chart of holdings, trades, and alerts
- Shows where user activity is concentrated

#### Transaction Flow (24h)
- Area chart of deposits, withdrawals, and pending
- Visualizes money movement patterns

#### Compliance Status
- Bar chart of KYC pending vs accounts on hold
- Identifies compliance workload

#### User Growth Trend
- Line chart tracking user count over selected period
- Spot growth patterns

#### Transaction Volume
- Composed chart comparing deposits vs withdrawals
- Identify deposit/withdrawal imbalances

#### User Status Distribution
- Pie chart of active vs suspended users
- Quick compliance overview

#### KYC Pipeline
- Line chart of pending KYC reviews
- Track verification backlog

### 3. Summary Statistics
12 key metrics in a grid:
- Total Users
- Admins
- Suspended (red)
- Holdings
- Trades
- Alerts
- Deposits (24h) - green
- Withdrawals (24h) - red
- Signups (24h) - green
- KYC Pending - orange
- On Hold - orange
- Pending Deposits - orange

## Features

### Auto-Refresh
- Charts update automatically every 30 seconds
- No manual refresh needed
- Stays current while you work

### Time Range Selection (Analytics Page)
- **24h** - Hourly data points
- **7d** - Daily data points
- **30d** - Daily data points

### Manual Refresh
- Click the refresh icon to update immediately
- Useful when you need current data right now

### Color Coding
- 🟢 **Green** - Positive metrics (signups, deposits)
- 🔴 **Red** - Negative metrics (suspended, withdrawals)
- 🟠 **Orange** - Warnings (KYC pending, on hold)
- 🔵 **Blue** - Neutral metrics (holdings, trades)

### Responsive Design
- Works on desktop, tablet, and mobile
- Charts adapt to screen size
- Touch-friendly controls

## Common Tasks

### Monitor User Growth
1. Go to `/admin`
2. Look at "Total Users" KPI card
3. Check "User Growth Trend" chart for pattern
4. See "Signups (24h)" in summary stats

### Track Compliance Issues
1. Go to `/admin/analytics`
2. Check "Compliance Status" pie chart
3. Review "KYC Pipeline" line chart
4. See "KYC Pending" and "On Hold" in summary

### Monitor Transaction Flow
1. Go to `/admin`
2. Check "Deposits (24h)" KPI card
3. View "Transaction Flow" area chart
4. Compare deposits vs withdrawals in analytics

### Check Trading Activity
1. Go to `/admin/analytics`
2. Look at "Trading Activity" bar chart
3. See "Total Trades" in summary stats
4. Check "Activity Overview" pie chart

### Identify Suspended Accounts
1. Go to `/admin`
2. Check "Suspended" stat in console
3. Click the stat to filter users
4. Review suspended accounts list

## Tips & Tricks

### Quick Navigation
- From `/admin`, click "Analytics" button for full analytics
- From `/admin/analytics`, use breadcrumb to go back
- All charts are clickable links to relevant admin pages

### Data Interpretation
- **Upward trends** = Growing platform activity
- **Downward trends** = Declining engagement
- **Spikes** = Unusual activity (investigate)
- **Flat lines** = Stable metrics

### Performance Monitoring
- Watch "Pending Deposits" - high numbers = approval backlog
- Monitor "KYC Pending" - high numbers = compliance workload
- Track "Suspended" - high numbers = security issues

### Troubleshooting
- Charts not updating? Click refresh button
- Data looks stale? Wait 30 seconds for auto-refresh
- Need historical data? Use time range picker on analytics page

## Keyboard Shortcuts

- **Refresh**: Click the refresh icon (⟳)
- **Toggle Charts**: Click "Show/Hide Charts" button
- **Change Time Range**: Click 24h / 7d / 30d buttons

## Mobile Usage

- Swipe left/right to scroll charts
- Tap KPI cards for more details
- Use landscape mode for better chart visibility
- All controls are touch-optimized

## Exporting Data

Coming soon:
- Download analytics as CSV
- Export charts as images
- Schedule automated reports

## Support

For issues or feature requests:
1. Check the charts are loading (no error messages)
2. Verify you have admin role
3. Try refreshing the page
4. Check browser console for errors

## Next Steps

1. **Explore the Dashboard** - Spend 5 minutes clicking around
2. **Set Bookmarks** - Save `/admin` and `/admin/analytics`
3. **Monitor Daily** - Check charts during your admin routine
4. **Customize** - Adjust refresh intervals or colors as needed

---

**Last Updated:** 2024
**Version:** 1.0
