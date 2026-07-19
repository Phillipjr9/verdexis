#!/bin/bash
# Migrate to RDS database
# Run this after updating .env with RDS connection

set -e

echo "Running Prisma migrations on RDS..."
npm run prisma:migrate -- --name "initial-rds-migration"

echo "✅ Migration complete!"
echo ""
echo "Your VERDEXIS backend is now connected to AWS RDS."
echo "Next: Deploy to EC2 and update Amplify CORS settings."
