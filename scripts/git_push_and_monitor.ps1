param(
  [string]$remote = 'origin',
  [string]$branch = 'main'
)

Write-Host "Pushing to $remote/$branch..."
git push $remote $branch

if ($LASTEXITCODE -ne 0) {
  Write-Error "git push failed"
  exit $LASTEXITCODE
}

# Open GitHub Actions page for the repo (assumes origin is github)
$originUrl = git remote get-url $remote 2>$null
if ($originUrl -match 'github.com[:/](.+?)(?:\.git)?$') {
  $repo = $Matches[1]
  $actionsUrl = "https://github.com/$repo/actions"
  Write-Host "Opening GitHub Actions: $actionsUrl"
  Start-Process $actionsUrl
} else {
  Write-Host "Could not parse origin URL; open your CI/hosting dashboard to inspect deployment logs." 
}
