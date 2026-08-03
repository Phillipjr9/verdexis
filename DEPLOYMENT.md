# Deployment Guide

This repository is designed to run as a hybrid deployment:

- **Frontend**: `app/` is built and deployed to **Cloudflare Pages**
- **Firebase**: Frontend uses Firebase client SDK for auth and realtime database where configured
- **Backend/API**: `server/` is built and deployed to **AWS ECS/ECR**
- **Database**: AWS **RDS Postgres** for `server/`

## Architecture

1. **Cloudflare Pages** serves the React app from `app/dist`.
2. The frontend uses `import.meta.env.VITE_API_URL` to call the backend API.
3. Firebase runs entirely client-side for auth and realtime Firebase database access.
4. The backend service runs in AWS ECS and connects to Postgres via `DATABASE_URL`.

## Frontend Deployment (Cloudflare Pages)

### Existing workflow

The repo already contains:
- `.github/workflows/deploy-app-to-cloudflare.yml`
- `app/package.json` script: `deploy:cloudflare`

This workflow builds `app/` and runs:

```bash
wrangler pages publish ./app/dist --project-name "$CF_PAGES_PROJECT_NAME" --branch main
```

### Required Cloudflare secrets

Add these GitHub Actions secrets:
- `CF_API_TOKEN`
- `CF_PAGES_PROJECT_NAME`

### Frontend environment variables

In Cloudflare Pages environment settings, set the `VITE_` env vars used by `app/`, including at least:

- `VITE_API_URL`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

If the frontend uses other `VITE_*` values, add those too.

### Example Cloudflare Pages build settings

- Build command: `cd app && npm ci && npm run build`
- Output directory: `app/dist`

## Backend Deployment (AWS ECS/ECR)

### Existing workflow

The repo already contains:
- `.github/workflows/aws-deploy.yml`
- `scripts/push-to-ecr.sh`
- `scripts/deploy-to-ecs.sh`
- `server/Dockerfile`

On `push` to `main`, GitHub Actions will:
1. Configure AWS credentials
2. Login to Amazon ECR
3. Build and push the Docker image
4. Update the ECS service task definition with the new image

### GitHub Actions secrets for AWS

Add these secrets:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_ACCOUNT_ID`

The workflow is hard-coded for `us-east-2` in the current repo. If you change regions, update `.github/workflows/aws-deploy.yml` and the deploy scripts.

### Required backend environment variables

The AWS backend service also needs runtime env vars. Common values include:

- `DATABASE_URL` (Postgres connection string)
- `DATABASE_PROVIDER` = `postgresql`
- `JWT_SECRET`
- `REDIS_URL` (if you use Redis)
- `AWS_REGION`

The ECS task definition or Secrets Manager configuration must supply these to the `server/` container.

> Note: The GitHub action only updates the ECS service image. It does not inject runtime env vars into ECS.

### Example backend deploy commands from GitHub CLI

```bash
gh secret set AWS_ACCESS_KEY_ID --body "<aws-access-key-id>"
gh secret set AWS_SECRET_ACCESS_KEY --body "<aws-secret-access-key>"
gh secret set AWS_ACCOUNT_ID --body "<aws-account-id>"
gh secret set CF_API_TOKEN --body "<cloudflare-api-token>"
gh secret set CF_PAGES_PROJECT_NAME --body "<cloudflare-pages-project-name>"
```

## Local development

### Frontend

```bash
cd app
npm ci
npm run dev
```

### Backend

```bash
cd server
npm ci
npm run dev
```

### Local backend build/test

```bash
cd server
npm run build
npm run start:migrate
```

## Deployment flow

### To deploy the frontend

Push to `main` and Cloudflare Pages workflow will run automatically.

### To deploy the backend

Push to `main` and AWS ECS workflow will run automatically.

## Recommended setup sequence

1. Create the Cloudflare Pages project.
2. Configure Cloudflare Pages environment variables.
3. Add GitHub secrets for `CF_API_TOKEN` and `CF_PAGES_PROJECT_NAME`.
4. Provision AWS ECR/ECS and RDS Postgres, then add `AWS_*` GitHub secrets.
5. Ensure the ECS task definition is configured with `DATABASE_URL` and backend runtime env vars.
6. Push to `main`.

## Notes

- The app uses Firebase config only in the frontend; Firebase is not the backend host.
- `VITE_API_URL` should point to the AWS backend API URL.
- If you prefer Cloudflare Pages to build directly from repo instead of CI, use the Pages project Build command above.

## Helpful links

- Cloudflare Pages docs: https://developers.cloudflare.com/pages/
- AWS ECS docs: https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html
- AWS ECR docs: https://docs.aws.amazon.com/AmazonECR/latest/userguide/what-is-ecr.html
- Firebase web config docs: https://firebase.google.com/docs/web/setup
