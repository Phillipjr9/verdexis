#!/usr/bin/env pwsh

# Database Connection Test Script (PowerShell)
# Tests connectivity to AWS RDS PostgreSQL

Write-Host "================================" -ForegroundColor Cyan
Write-Host "VERDEXIS - RDS Connection Test" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Configuration
$DB_HOST = "database-2-instance-1.c0xwa6wyga3m.us-east-1.rds.amazonaws.com"
$DB_PORT = 5432
$DB_USER = "postgres"
$DB_NAME = "postgres"
$DB_PASSWORD = "S5C<K#5-K)|J8_K:O:o)GZ<mIkI*"
$DB_PASSWORD_ENCODED = "S5C%3CK%235-K%29%7CJ8_K%3AO%3Ao%29GZ%3CmIkI%2A"

Write-Host "[1/5] Testing DNS resolution..." -ForegroundColor Yellow
try {
    $result = Resolve-DnsName -Name $DB_HOST -ErrorAction Stop
    Write-Host "✅ DNS resolution successful" -ForegroundColor Green
    Write-Host "   IP: $($result.IPAddress)" -ForegroundColor Gray
}
catch {
    Write-Host "❌ DNS resolution failed" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[2/5] Testing port connectivity..." -ForegroundColor Yellow
$tcpClient = New-Object System.Net.Sockets.TcpClient
try {
    $tcpClient.Connect($DB_HOST, $DB_PORT)
    if ($tcpClient.Connected) {
        Write-Host "✅ Port $DB_PORT is open and reachable" -ForegroundColor Green
    }
    $tcpClient.Close()
}
catch {
    Write-Host "❌ Cannot reach port $DB_PORT" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    Write-Host "   Check RDS security group allows 0.0.0.0/0 on port 5432" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[3/5] Testing psql availability..." -ForegroundColor Yellow
$psqlPath = Get-Command psql -ErrorAction SilentlyContinue
if ($psqlPath) {
    Write-Host "✅ psql is installed" -ForegroundColor Green
    Write-Host "   Path: $($psqlPath.Source)" -ForegroundColor Gray
}
else {
    Write-Host "❌ psql not found" -ForegroundColor Red
    Write-Host "   Install PostgreSQL from: https://www.postgresql.org/download/" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "[4/5] Attempting database connection..." -ForegroundColor Yellow
$connString = "postgresql://$DB_USER`:$DB_PASSWORD_ENCODED@$DB_HOST`:$DB_PORT/$DB_NAME`?sslmode=require"
try {
    $output = & psql $connString -c "SELECT 1" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Successfully connected to database" -ForegroundColor Green
    }
    else {
        Write-Host "❌ Connection failed" -ForegroundColor Red
        Write-Host "   Output: $output" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Connection error" -ForegroundColor Red
    Write-Host "   Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "[5/5] Testing database version..." -ForegroundColor Yellow
try {
    $output = & psql $connString -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Database is responsive" -ForegroundColor Green
        Write-Host "   $output" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ Database query failed" -ForegroundColor Red
        exit 1
    }
}
catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "✅ All tests passed!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Database Details:" -ForegroundColor Cyan
Write-Host "  Host: $DB_HOST" -ForegroundColor Gray
Write-Host "  Port: $DB_PORT" -ForegroundColor Gray
Write-Host "  User: $DB_USER" -ForegroundColor Gray
Write-Host "  Database: $DB_NAME" -ForegroundColor Gray
Write-Host ""
Write-Host "Connection String (URL-encoded):" -ForegroundColor Cyan
Write-Host "postgresql://$DB_USER`:$DB_PASSWORD_ENCODED@$DB_HOST`:$DB_PORT/$DB_NAME`?sslmode=require" -ForegroundColor Yellow
Write-Host ""
Write-Host "Render Environment Variable:" -ForegroundColor Cyan
Write-Host "DATABASE_URL=postgresql://$DB_USER`:$DB_PASSWORD_ENCODED@$DB_HOST`:$DB_PORT/$DB_NAME`?schema=public&sslmode=require" -ForegroundColor Yellow
