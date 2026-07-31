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
   - Add the `VITE_FIREBASE_*` environment variables in Pages (from `app/.env.production`).

4. Local publish (optional):
   - Install `wrangler` locally: `npm install -g wrangler`
   - Run: `npm run deploy:cloudflare` from `app/` (script uses `wrangler pages publish dist`).
