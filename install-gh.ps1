$ghInstaller = Join-Path $env:TEMP 'gh-setup.exe'
Write-Host "Downloading GitHub CLI..."
Invoke-WebRequest -Uri 'https://github.com/cli/cli/releases/download/v2.68.0/gh_2.68.0_windows_amd64.msi' -OutFile $ghInstaller
Write-Host "Installing GitHub CLI..."
Start-Process -FilePath $ghInstaller -ArgumentList '/quiet' -Wait
Write-Host "Cleaning up..."
Remove-Item $ghInstaller
Write-Host "Installation complete. Verifying..."
gh --version
