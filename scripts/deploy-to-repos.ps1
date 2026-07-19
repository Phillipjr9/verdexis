#!/usr/bin/env pwsh

# Deploy to GitHub and GitLab
# This script commits and pushes to both repositories

param(
    [Parameter(Mandatory=$false)]
    [string]$CommitMessage = "fix: Update database password and Render configuration"
)

Write-Host "================================" -ForegroundColor Cyan
Write-Host "DEPLOY TO GITHUB & GITLAB" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if we're in a git repository
if (-not (Test-Path .git)) {
    Write-Host "❌ Not in a git repository" -ForegroundColor Red
    exit 1
}

Write-Host "📍 Current directory: $(Get-Location)" -ForegroundColor Gray
Write-Host ""

# Step 1: Check git status
Write-Host "[1/5] Checking git status..." -ForegroundColor Yellow
$status = & git status --porcelain
if ($status) {
    Write-Host "✅ Found changes to commit:" -ForegroundColor Green
    Write-Host $status -ForegroundColor Gray
} else {
    Write-Host "⚠️  No changes detected" -ForegroundColor Yellow
}
Write-Host ""

# Step 2: Add all changes
Write-Host "[2/5] Staging changes..." -ForegroundColor Yellow
& git add .
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Changes staged" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to stage changes" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 3: Commit
Write-Host "[3/5] Creating commit..." -ForegroundColor Yellow
Write-Host "Message: $CommitMessage" -ForegroundColor Gray
& git commit -m "$CommitMessage"
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Commit created" -ForegroundColor Green
} else {
    Write-Host "⚠️  Commit skipped (no changes or already committed)" -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Push to GitHub
Write-Host "[4/5] Pushing to GitHub (origin)..." -ForegroundColor Yellow
& git push origin main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Pushed to GitHub" -ForegroundColor Green
    $githubUrl = "https://github.com/smithjrphillip67/verdexis"
    Write-Host "   → $githubUrl" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to push to GitHub" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 5: Push to GitLab
Write-Host "[5/5] Pushing to GitLab..." -ForegroundColor Yellow
& git push gitlab main
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Pushed to GitLab" -ForegroundColor Green
    $gitlabUrl = "https://gitlab.com/phillipjr9-group/verdexis"
    Write-Host "   → $gitlabUrl" -ForegroundColor Cyan
} else {
    Write-Host "❌ Failed to push to GitLab" -ForegroundColor Red
    exit 1
}
Write-Host ""

Write-Host "================================" -ForegroundColor Green
Write-Host "✅ DEPLOYMENT COMPLETE!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""

Write-Host "📊 Summary:" -ForegroundColor Cyan
Write-Host "  GitHub:  https://github.com/smithjrphillip67/verdexis" -ForegroundColor Green
Write-Host "  GitLab:  https://gitlab.com/phillipjr9-group/verdexis" -ForegroundColor Green
Write-Host ""

Write-Host "🚀 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. GitHub will auto-deploy to Render (if configured)"
Write-Host "  2. Check GitHub Actions / GitLab CI/CD status"
Write-Host "  3. Monitor Render deployment logs"
Write-Host "  4. Test health endpoint after deployment"
Write-Host ""

Write-Host "📝 Commit Details:" -ForegroundColor Cyan
$lastCommit = & git log -1 --oneline
Write-Host "  $lastCommit" -ForegroundColor Gray
Write-Host ""
