#!/bin/bash

# Database Connection Test Script
# Tests connectivity to AWS RDS PostgreSQL

echo "================================"
echo "VERDEXIS - RDS Connection Test"
echo "================================"
echo ""

# Configuration
DB_HOST="database-2-instance-1.c0xwa6wyga3m.us-east-1.rds.amazonaws.com"
DB_PORT="5432"
DB_USER="postgres"
DB_NAME="postgres"
DB_PASSWORD="S5C<K#5-K)|J8_K:O:o)GZ<mIkI*"

# URL-encoded password for connection string
DB_PASSWORD_ENCODED="S5C%3CK%235-K%29%7CJ8_K%3AO%3Ao%29GZ%3CmIkI%2A"

echo "[1/5] Testing DNS resolution..."
nslookup $DB_HOST > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ DNS resolution successful"
else
    echo "❌ DNS resolution failed"
    exit 1
fi

echo ""
echo "[2/5] Testing port connectivity..."
timeout 5 bash -c "echo > /dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null
if [ $? -eq 0 ]; then
    echo "✅ Port 5432 is open and reachable"
else
    echo "❌ Cannot reach port 5432"
    echo "   Check RDS security group allows 0.0.0.0/0 on port 5432"
    exit 1
fi

echo ""
echo "[3/5] Testing psql availability..."
which psql > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ psql is installed: $(psql --version)"
else
    echo "❌ psql not found. Install PostgreSQL client:"
    echo "   macOS: brew install postgresql"
    echo "   Linux: sudo apt-get install postgresql-client"
    echo "   Windows: Download from https://www.postgresql.org/download/"
    exit 1
fi

echo ""
echo "[4/5] Attempting database connection..."
psql "postgresql://$DB_USER:$DB_PASSWORD_ENCODED@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=require" -c "SELECT 1" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Successfully connected to database"
else
    echo "❌ Connection failed"
    echo ""
    echo "Trying with detailed error output..."
    psql "postgresql://$DB_USER:$DB_PASSWORD_ENCODED@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=require" -c "SELECT 1"
    exit 1
fi

echo ""
echo "[5/5] Testing database version..."
psql "postgresql://$DB_USER:$DB_PASSWORD_ENCODED@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=require" -c "SELECT version();"
if [ $? -eq 0 ]; then
    echo "✅ Database is responsive"
else
    echo "❌ Database query failed"
    exit 1
fi

echo ""
echo "================================"
echo "✅ All tests passed!"
echo "================================"
echo ""
echo "Database Details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  User: $DB_USER"
echo "  Database: $DB_NAME"
echo ""
echo "Connection String (URL-encoded):"
echo "postgresql://$DB_USER:$DB_PASSWORD_ENCODED@$DB_HOST:$DB_PORT/$DB_NAME?sslmode=require"
echo ""
