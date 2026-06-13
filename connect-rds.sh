#!/bin/bash
# RDS Connection Script with IAM Authentication
# Usage: ./connect-rds.sh

set -e

# RDS Configuration
export RDSHOST="database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com"
export RDSPORT=5432
export RDSUSER="postgres"
export RDSREGION="us-east-1"
export RDSDB="postgres"

echo "Generating RDS auth token..."
RDSTOKEN=$(aws rds generate-db-auth-token \
  --hostname $RDSHOST \
  --port $RDSPORT \
  --username $RDSUSER \
  --region $RDSREGION)

echo "Connecting to RDS..."
psql "host=$RDSHOST port=$RDSPORT dbname=$RDSDB user=$RDSUSER sslmode=require password=$RDSTOKEN"
