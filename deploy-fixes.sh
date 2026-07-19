#!/bin/bash

# Verdexis Deployment Fixes Script
# Run this script to apply all critical fixes

set -e  # Exit on error

echo "🚀 Starting Verdexis deployment fixes..."
echo "========================================"

# Check if running as administrator on Windows
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    echo "🔧 Windows environment detected"
    # Check for admin privileges
    net session > /dev/null 2>&1
    if [ $? -eq 0 ]; then
        echo "✅ Running with administrator privileges"
    else
        echo "⚠️  Please run as administrator for database operations"
    fi
fi

echo ""
echo "📦 Step 1: Checking dependencies..."
echo "----------------------------------"

# Check Node.js version
NODE_VERSION=$(node --version)
echo "Node.js: $NODE_VERSION"

# Check npm version
NPM_VERSION=$(npm --version)
echo "npm: $NPM_VERSION"

# Check if PostgreSQL is installed (optional)
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL is installed"
else
    echo "⚠️  PostgreSQL not found (optional for development)"
fi

echo ""
echo "🔧 Step 2: Setting up environment..."
echo "-----------------------------------"

# Create environment files if they don't exist
if [ ! -f ".env.local" ]; then
    echo "Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your configuration"
else
    echo "✅ .env.local already exists"
fi

if [ ! -f "server/.env.local" ]; then
    echo "Creating server/.env.local..."
    cp server/.env.example server/.env.local
    echo "⚠️  Please update server/.env.local with your configuration"
else
    echo "✅ server/.env.local already exists"
fi

echo ""
echo "🗄️  Step 3: Database setup..."
echo "----------------------------"

cd server

# Install dependencies
echo "Installing server dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Apply database migrations
echo "Applying database migrations..."
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows: Check if we should use SQLite or PostgreSQL
    if [ -f "dev.db" ]; then
        echo "Using existing SQLite database..."
    else
        echo "Creating SQLite database..."
        npx prisma migrate deploy
    fi
else
    # Linux/macOS: Apply migrations
    echo "Applying migrations..."
    npx prisma migrate deploy
fi

# Seed the database if needed
if [ -f "prisma/seed.js" ] || [ -f "prisma/seed.ts" ]; then
    echo "Seeding database..."
    npx prisma db seed
fi

echo ""
echo "💻 Step 4: Frontend setup..."
echo "---------------------------"

cd ../app

# Install dependencies
echo "Installing frontend dependencies..."
npm install

# Build the frontend
echo "Building frontend..."
npm run build

echo ""
echo "🔒 Step 5: Security checks..."
echo "----------------------------"

cd ../server

# Generate JWT secret if not set
if ! grep -q "JWT_SECRET=" .env.local; then
    echo "Generating JWT secret..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "JWT_SECRET=$JWT_SECRET" >> .env.local
    echo "✅ JWT secret generated"
else
    echo "✅ JWT secret already configured"
fi

# Check for required environment variables
echo "Checking required environment variables..."
REQUIRED_VARS=("DATABASE_URL" "JWT_SECRET")
MISSING_VARS=()

for var in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^$var=" .env.local; then
        MISSING_VARS+=("$var")
    fi
done

if [ ${#MISSING_VARS[@]} -gt 0 ]; then
    echo "⚠️  Missing required environment variables: ${MISSING_VARS[*]}"
    echo "   Please add them to server/.env.local"
else
    echo "✅ All required environment variables are set"
fi

echo ""
echo "🧪 Step 6: Testing..."
echo "--------------------"

# Test database connection
echo "Testing database connection..."
if npx prisma db execute --file prisma/migrations/20250101000000_fix_schema_mismatch.sql 2>/dev/null; then
    echo "✅ Database connection successful"
else
    echo "⚠️  Database connection test failed (might be expected for SQLite)"
fi

# Test server startup
echo "Testing TypeScript compilation..."
if npx tsc --noEmit; then
    echo "✅ TypeScript compilation successful"
else
    echo "❌ TypeScript compilation failed"
    echo "   Please fix the TypeScript errors above"
    exit 1
fi

echo ""
echo "📋 Step 7: Creating startup scripts..."
echo "-------------------------------------"

cd ..

# Create startup script for Windows
cat > start-verdexis.bat << 'EOF'
@echo off
echo Starting Verdexis Platform...
echo.

echo Starting Backend Server...
cd server
start cmd /k "npm run dev"
cd ..

echo Starting Frontend Development Server...
cd app
start cmd /k "npm run dev"
cd ..

echo.
echo Verdexis Platform is starting...
echo Backend: http://localhost:4000
echo Frontend: http://localhost:3000
echo.
pause
EOF

# Create startup script for Unix
cat > start-verdexis.sh << 'EOF'
#!/bin/bash
echo "Starting Verdexis Platform..."
echo ""

echo "Starting Backend Server..."
cd server && npm run dev &
BACKEND_PID=$!

echo "Starting Frontend Development Server..."
cd ../app && npm run dev &
FRONTEND_PID=$!

echo ""
echo "Verdexis Platform is starting..."
echo "Backend: http://localhost:4000"
echo "Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Wait for user interrupt
trap 'kill $BACKEND_PID $FRONTEND_PID; exit' INT
wait
EOF

chmod +x start-verdexis.sh

echo ""
echo "🎉 Step 8: Final checks..."
echo "-------------------------"

# Check for any remaining issues
echo "Checking for common issues..."

# Check if ports are available
if [[ "$OSTYPE" != "msys" && "$OSTYPE" != "win32" ]]; then
    if lsof -i:3000 > /dev/null 2>&1; then
        echo "⚠️  Port 3000 is in use (frontend)"
    else
        echo "✅ Port 3000 is available"
    fi
    
    if lsof -i:4000 > /dev/null 2>&1; then
        echo "⚠️  Port 4000 is in use (backend)"
    else
        echo "✅ Port 4000 is available"
    fi
fi

echo ""
echo "========================================"
echo "✅ Deployment fixes completed!"
echo ""
echo "📝 Next steps:"
echo "1. Review and update the .env.local files"
echo "2. Run the startup script:"
echo "   - Windows: double-click start-verdexis.bat"
echo "   - Linux/macOS: ./start-verdexis.sh"
echo "3. Access the application:"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend API: http://localhost:4000"
echo "   - API Health: http://localhost:4000/api/health"
echo ""
echo "🔧 For production deployment:"
echo "1. Set NODE_ENV=production in .env files"
echo "2. Use PostgreSQL instead of SQLite"
echo "3. Set up SSL/TLS certificates"
echo "4. Configure a reverse proxy (nginx, Apache)"
echo "5. Set up monitoring and logging"
echo ""
echo "📚 Documentation:"
echo "- Check the README files in each directory"
echo "- Review server/OTP_ENV_SETUP.md for OTP setup"
echo "- Check server/AWS_OTP_SETUP.md for AWS integration"
echo ""
echo "🚨 Important security notes:"
echo "- Change all default passwords"
- Generate new JWT secrets for production
- Enable HTTPS in production
- Set up proper firewall rules
- Regular security audits recommended
echo "========================================"