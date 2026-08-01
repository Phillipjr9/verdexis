Cloudflare Pages deploy instructions

1. Create GitHub repository secrets:
   - `CF_API_TOKEN` — Cloudflare API token with `Pages:Edit` or `Pages:Deploy` permissions.
   - `CF_PAGES_PROJECT_NAME` — the Pages project name (as shown in Cloudflare Pages dashboard).

2. Workflow behavior:
   - The workflow in `.github/workflows/deploy-app-to-cloudflare.yml` runs on push to `main`.
   - It installs and builds the frontend from the `app/` folder, then runs `wrangler pages publish ./app/dist`.

3. If you prefer Cloudflare to build directly from the repo instead:
   - In Pages project settings, set Build command: `cd app && npm ci && npm run build`
   - Set Output directory: `app/dist`
   - Set the Node version to `20` in the Pages build settings (matches `app/package.json`)
   - Add the `VITE_FIREBASE_*` environment variables in Pages (from `app/.env.production`).

4. Recommended Cloudflare Pages environment variables (set in Pages > Settings > Environment Variables):
   - `VITE_API_URL` = https://api.yourdomain.com
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_DATABASE_URL`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_FIREBASE_MEASUREMENT_ID`

5. Re-running the GitHub Actions workflow (if you need to retry the build):
   - Option A: Push an empty commit to `main` (fast):

```bash
git commit --allow-empty -m "retry cloudflare pages build" && git push origin main
```

   - Option B: Re-run the workflow from GitHub Actions UI: open the latest `Build and deploy app to Cloudflare Pages` run and click "Re-run jobs".

4. Local publish (optional):
   - Install `wrangler` locally: `npm install -g wrangler`
   - Run: `npm run deploy:cloudflare` from `app/` (script uses `wrangler pages publish dist`).
   - Do not use `npx wrangler deploy` from this repo. That command uploads the entire `app/` directory as a Worker asset manifest and will fail on Cloudflare's 20,000-file limit.
