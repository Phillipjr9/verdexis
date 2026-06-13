# RDS Connectivity Troubleshooting

## Error: Can't reach database server

### Quick Checklist:

1. **RDS Instance Status**
   ```bash
   aws rds describe-db-instances --db-instance-identifier database-1 --query 'DBInstances[0].DBInstanceStatus'
   ```
   Should return: `available`

2. **Security Group Allows Inbound PostgreSQL**
   ```bash
   # Find RDS security group
   aws rds describe-db-instances --db-instance-identifier database-1 \
     --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId'
   
   # Check inbound rules (should allow 5432)
   aws ec2 describe-security-groups --group-ids sg-xxxxx
   ```

3. **Network Accessibility**
   ```bash
   # Test from your machine (requires psql installed)
   psql -h database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com -U postgres -d postgres
   ```

4. **Check RDS Endpoint**
   ```bash
   aws rds describe-db-instances --db-instance-identifier database-1 \
     --query 'DBInstances[0].Endpoint'
   ```

### Solution: Update RDS Security Group

**Via AWS Console:**
1. Go to RDS > Databases > database-1
2. Click the Security Group (VPC security groups section)
3. Go to Inbound Rules
4. Add rule:
   - Type: PostgreSQL
   - Port: 5432
   - Source: Your IP (or 0.0.0.0/0 for testing, then restrict later)
5. Save

**Via AWS CLI:**
```bash
# Find your security group
SG_ID=$(aws rds describe-db-instances --db-instance-identifier database-1 \
  --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' --output text)

# Get your current IP
YOUR_IP=$(curl -s https://checkip.amazonaws.com)

# Add inbound rule
aws ec2 authorize-security-group-ingress \
  --group-id $SG_ID \
  --protocol tcp \
  --port 5432 \
  --cidr $YOUR_IP/32
```

### Test Connection After Fix:

```bash
# With password auth
psql -h database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com \
  -U postgres \
  -d postgres \
  -c "SELECT 1"

# Or with IAM token
RDSTOKEN=$(aws rds generate-db-auth-token \
  --hostname database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com \
  --port 5432 \
  --username postgres \
  --region us-east-1)

psql "host=database-1.cluster-c0xwa6wyga3m.us-east-1.rds.amazonaws.com port=5432 dbname=postgres user=postgres sslmode=require password=$RDSTOKEN" -c "SELECT 1"
```

### If Still Not Working:

1. **Check RDS is actually running:**
   ```bash
   aws rds describe-db-instances --db-instance-identifier database-1 \
     --query 'DBInstances[0].[DBInstanceStatus,DBInstanceIdentifier,Endpoint.Address]'
   ```

2. **Check for DB Parameter Group issues:**
   ```bash
   aws rds describe-db-instances --db-instance-identifier database-1 \
     --query 'DBInstances[0].DBParameterGroups'
   ```

3. **Review RDS Events:**
   ```bash
   aws rds describe-events --source-identifier database-1 --max-records 10
   ```

4. **Temporarily allow from anywhere (TEST ONLY):**
   ```bash
   aws ec2 authorize-security-group-ingress \
     --group-id $SG_ID \
     --protocol tcp \
     --port 5432 \
     --cidr 0.0.0.0/0
   ```

### Common Issues:

| Issue | Solution |
|-------|----------|
| `connection refused` | Security group doesn't allow port 5432 |
| `timeout` | Network connectivity issue or RDS in wrong VPC |
| `authentication failed` | Wrong password or user doesn't exist |
| `database "verdexis" does not exist` | Need to create database first |

### Next Steps:

After fixing connectivity:
```bash
npm run prisma:migrate -- --name init
```
