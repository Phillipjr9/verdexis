#!/bin/bash

# Deploy to GitHub and GitLab
# This script commits and pushes to both repositories

COMMIT_MESSAGE="${1:-fix: Update database password and Render configuration}"

echo "================================"
echo "DEPLOY TO GITHUB & GITLAB"
echo "================================"
echo ""

# Check if we're in a git repository
if [ ! -d .git ]; then
    echo "❌ Not in a git repository"
    exit 1
fi

echo "📍 Current directory: $(pwd)"
echo ""

# Step 1: Check git status
echo "[1/5] Checking git status..."
if git status --porcelain | grep -q .; then
    echo "✅ Found changes to commit:"
    git status --short
else
    echo "⚠️  No changes detected"
fi
echo ""

# Step 2: Add all changes
echo "[2/5] Staging changes..."
git add .
if [ $? -eq 0 ]; then
    echo "✅ Changes staged"
else
    echo "❌ Failed to stage changes"
    exit 1
fi
echo ""

# Step 3: Commit
echo "[3/5] Creating commit..."
echo "Message: $COMMIT_MESSAGE"
git commit -m "$COMMIT_MESSAGE"
if [ $? -eq 0 ]; then
    echo "✅ Commit created"
else
    echo "⚠️  Commit skipped (no changes or already committed)"
fi
echo ""

# Step 4: Push to GitHub
echo "[4/5] Pushing to GitHub (origin)..."
git push origin main
if [ $? -eq 0 ]; then
    echo "✅ Pushed to GitHub"
    echo "   → https://github.com/smithjrphillip67/verdexis"
else
    echo "❌ Failed to push to GitHub"
    exit 1
fi
echo ""

# Step 5: Push to GitLab
echo "[5/5] Pushing to GitLab..."
git push gitlab main
if [ $? -eq 0 ]; then
    echo "✅ Pushed to GitLab"
    echo "   → https://gitlab.com/phillipjr9-group/verdexis"
else
    echo "❌ Failed to push to GitLab"
    exit 1
fi
echo ""

echo "================================"
echo "✅ DEPLOYMENT COMPLETE!"
echo "================================"
echo ""

echo "📊 Summary:"
echo "  GitHub:  https://github.com/smithjrphillip67/verdexis"
echo "  GitLab:  https://gitlab.com/phillipjr9-group/verdexis"
echo ""

echo "🚀 Next Steps:"
echo "  1. GitHub will auto-deploy to Render (if configured)"
echo "  2. Check GitHub Actions / GitLab CI/CD status"
echo "  3. Monitor Render deployment logs"
echo "  4. Test health endpoint after deployment"
echo ""

echo "📝 Commit Details:"
git log -1 --oneline
echo ""
