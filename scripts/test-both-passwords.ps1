#!/usr/bin/env pwsh

# Test both database passwords to find which one works

Write-Host "================================" -ForegroundColor Cyan
Write-Host "DATABASE PASSWORD VERIFICATION" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

$DB_HOST = "database-2-instance-1.c0xwa6wyga3m.us-east-1.rds.amazonaws.com"
$DB_PORT = 5432
$DB_USER = "postgres"
$DB_NAME = "postgres"

# Password 1: From server/.env
$PASSWORD1_ENCODED = "S5C%3CK%235-K%29%7CJ8_K%3AO%3Ao%29GZ%3CmIkI%2A"
$PASSWORD1_DECODED = "S5C<K#5-K)|J8_K:O:o)GZ<mIkI*"

# Password 2: You said this is "Render database"
$PASSWORD2_ENCODED = "d%28HMeY%245D%24%5BttK%5B4wX05%29OI7%2AIrT"
$PASSWORD2_DECODED = "d(HMeY`$5D`$[ttK[4wX05)OI7*IrT"

Write-Host "Testing Password 1 (from server/.env)..." -ForegroundColor Yellow
Write-Host "Password: $PASSWORD1_DECODED" -ForegroundColor Gray

$connString1 = "postgresql://$DB_USER`:$PASSWORD1_ENCODED@$DB_HOST`:$DB_PORT/$DB_NAME`?sslmode=require"
try {
    $output1 = & psql $connString1 -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PASSWORD 1 WORKS!" -ForegroundColor Green
        Write-Host ""
        Write-Host "CORRECT DATABASE_URL FOR RENDER:" -ForegroundColor Green
        Write-Host "postgresql://postgres:$PASSWORD1_ENCODED@$DB_HOST`:$DB_PORT/$DB_NAME`?schema=public&sslmode=require" -ForegroundColor Yellow
        Write-Host ""
        exit 0
    } else {
        Write-Host "❌ Password 1 failed" -ForegroundColor Red
        Write-Host "Error: $output1" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Password 1 failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Testing Password 2 (Render database)..." -ForegroundColor Yellow
Write-Host "Password: $PASSWORD2_DECODED" -ForegroundColor Gray

$connString2 = "postgresql://$DB_USER`:$PASSWORD2_ENCODED@$DB_HOST`:$DB_PORT/$DB_NAME`?sslmode=require"
try {
    $output2 = & psql $connString2 -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ PASSWORD 2 WORKS!" -ForegroundColor Green
        Write-Host ""
        Write-Host "CORRECT DATABASE_URL FOR RENDER:" -ForegroundColor Green
        Write-Host "postgresql://postgres:$PASSWORD2_ENCODED@$DB_HOST`:$DB_PORT/$DB_NAME`?schema=public&sslmode=require" -ForegroundColor Yellow
        Write-Host ""
        exit 0
    } else {
        Write-Host "❌ Password 2 failed" -ForegroundColor Red
        Write-Host "Error: $output2" -ForegroundColor Gray
    }
} catch {
    Write-Host "❌ Password 2 failed: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================" -ForegroundColor Red
Write-Host "❌ BOTH PASSWORDS FAILED" -ForegroundColor Red
Write-Host "================================" -ForegroundColor Red
Write-Host ""
Write-Host "SOLUTIONS:" -ForegroundColor Yellow
Write-Host "1. Check AWS RDS Console for correct password"
Write-Host "2. Reset RDS password in AWS Console"
Write-Host "3. Check if RDS is publicly accessible"
Write-Host "4. Verify security group allows port 5432"
Write-Host ""
