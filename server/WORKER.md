This worker centralizes background jobs for Verdexis.

How to run (development):

```bash
npm --prefix server run worker
```

What it does:
- Starts scheduled background jobs (yield distribution, limit resets, price tracking, price alerts)
- Schedules the email digest to run once at startup and then daily
- Initializes Redis (optional) and Push notification service (if configured)

Notes:
- The worker is safe to import; it only starts when executed directly with `tsx src/worker.ts`.
- Background jobs are implemented in `server/src/backgroundJobs.ts` and the email digest in `server/src/emailDigestService.ts`.
