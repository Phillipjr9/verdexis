## AWS Amplify Deployment Setup

### Problem
AWS Amplify isn't automatically deploying when pushing to GitHub (https://github.com/Phillipjr9/verdexis).

### Solution

#### Option 1: Manual Amplify Console Setup (Recommended for now)

1. **Go to AWS Amplify Console**
   - https://console.aws.amazon.com/amplify/

2. **Select your app** (verdexis)

3. **Check deployment settings:**
   - Click **Deployments** in the left menu
   - Verify GitHub connection is active
   - Check that the repository is: `https://github.com/Phillipjr9/verdexis`
   - Branch should be: `main`

4. **Enable automatic deployments:**
   - Go to **App settings** → **Repository and branches**
   - Make sure `main` branch is connected
   - Enable "Automatic deployments"

5. **Update build settings:**
   - Go to **App settings** → **Build settings**
   - Replace with this configuration:

```yaml
version: 1
applications:
  - appRoot: app
    frontend:
      phases:
        preBuild:
          commands:
            - export NODE_ENV=production
            - npm ci --include=dev
        build:
          commands:
            - export PATH="$PATH:$PWD/node_modules/.bin"
            - npm run build
      artifacts:
        baseDirectory: dist
        files:
          - '**/*'
```

#### Option 2: GitHub Actions Workflow (Automated)

A new workflow file has been created: `.github/workflows/amplify-deploy.yml`

**Setup GitHub Secrets:**

1. Go to GitHub repository settings: https://github.com/Phillipjr9/verdexis/settings/secrets/actions

2. Add these secrets:
   - `AWS_ACCESS_KEY_ID` - Your AWS access key
   - `AWS_SECRET_ACCESS_KEY` - Your AWS secret key
   - `AMPLIFY_APP_ID` - Your Amplify app ID (find in AWS Amplify console)

3. The workflow will automatically trigger on every push to `main`

**To find your Amplify App ID:**
```bash
# Using AWS CLI
aws amplify list-apps --region us-east-1
```

#### Option 3: Webhook Trigger

1. In **AWS Amplify Console** → **App settings** → **Webhook**
2. Copy the webhook URL
3. Add it to GitHub as a webhook in repository settings
4. This triggers deploys on push

### Troubleshooting

**Deployment not starting:**
- Check that GitHub branch `main` is connected in Amplify console
- Verify "Automatic deployments" is enabled
- Check Amplify build logs for errors: **Deployments** → Select failed deployment → **Logs**

**Build failures:**
- Common issues:
  - Missing Node.js dependencies
  - TypeScript compilation errors
  - Missing environment variables
- Check build logs for specific error messages
- Run locally: `npm ci && npm run build` in `app/` directory

**GitHub connection lost:**
- Reconnect GitHub in Amplify console
- Authorize Amplify GitHub App
- Verify repository access permissions

### Current Status

✅ **Pushed to:**
- GitLab: https://gitlab.com/phillipjr9-group/verdexis.git
- GitHub upstream: https://github.com/Phillipjr9/verdexis.git

⚠️ **Amplify deployment:**
- Not automatic yet
- Needs manual setup in AWS Amplify Console
- OR use GitHub Actions workflow (need to set up secrets)

### Next Steps

1. Open AWS Amplify Console
2. Follow "Option 1: Manual Setup" OR "Option 2: GitHub Actions"
3. Test by pushing a small change to `main` branch
4. Monitor deployment in Amplify console

### Quick Deploy Trigger

To manually trigger a deployment in Amplify Console:
1. Go to **Deployments**
2. Click **Redeploy this version** on any previous deployment
3. Or push a new commit to `main` (once automatic deployments are enabled)
