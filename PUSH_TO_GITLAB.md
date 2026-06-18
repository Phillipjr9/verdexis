# Push to GitLab for Render Deployment

## Quick Setup: GitLab Personal Access Token

### Step 1: Create GitLab Personal Access Token

1. Go to: https://gitlab.com/-/profile/personal_access_tokens
2. Click "Add new token"
3. Fill in:
   - **Token name**: `verdexis-deployment`
   - **Expiration date**: Choose 90 days or longer
   - **Scopes**: Check `write_repository`
4. Click "Create personal access token"
5. **COPY THE TOKEN** (you won't see it again!)

### Step 2: Configure Git with Token

Open Command Prompt and run:

```bash
cd c:\Users\USER\Downloads\VERDEXIS

# Remove old GitLab remote
git remote remove gitlab

# Add GitLab with your username and token
# Replace YOUR_USERNAME with your GitLab username
# Replace YOUR_TOKEN with the token you just copied
git remote add gitlab https://YOUR_USERNAME:YOUR_TOKEN@gitlab.com/phillipjr9-group/verdexis.git

# Verify it was added
git remote -v
```

### Step 3: Push to GitLab

```bash
git push gitlab main
```

Expected output:
```
Enumerating objects...
Counting objects...
Writing objects...
To https://gitlab.com/phillipjr9-group/verdexis.git
   8b3a174..9974a83  main -> main
```

---

## Alternative: Store Token in Git Credentials

If you don't want the token in the URL, use Git credential helper:

```bash
# Configure Git to remember credentials
git config --global credential.helper store

# Try to push (will prompt for username/password)
git push gitlab main

# When prompted:
# Username: your_gitlab_username
# Password: paste_your_personal_access_token
```

---

## After Successful Push

Once pushed to GitLab, Render should auto-deploy (if auto-deploy is enabled).

**Check Render:**
1. Go to: https://dashboard.render.com/
2. Check `verdexis-backend` service
3. Look for "Deploy started" in Events tab
4. Wait 5-10 minutes for build

**Or manually deploy:**
1. Click "Manual Deploy" button
2. Select "Deploy latest commit"
3. Should now show commit `9974a83`

---

## Quick Command Summary

```bash
# 1. Remove old remote
git remote remove gitlab

# 2. Add new remote with token
git remote add gitlab https://YOUR_USERNAME:YOUR_TOKEN@gitlab.com/phillipjr9-group/verdexis.git

# 3. Push
git push gitlab main
```

Replace:
- `YOUR_USERNAME` → Your GitLab username (probably `phillipjr9` or similar)
- `YOUR_TOKEN` → The personal access token you created

---

## Troubleshooting

**Error: "Authentication failed"**
- Token is incorrect or expired
- Create a new token at https://gitlab.com/-/profile/personal_access_tokens
- Make sure `write_repository` scope is checked

**Error: "Permission denied"**
- Your user doesn't have push access to the repo
- Ask the repo owner to add you as a Maintainer or Developer

**Error: "Repository not found"**
- The repo path might be wrong
- Verify at: https://gitlab.com/phillipjr9-group/verdexis
