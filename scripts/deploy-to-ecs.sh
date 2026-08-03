#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 4 ]; then
  echo "Usage: $0 <aws-region> <cluster-name> <service-name> <image-uri>"
  exit 1
fi

AWS_REGION=$1
CLUSTER_NAME=$2
SERVICE_NAME=$3
IMAGE_URI=$4

echo "Fetching current task definition for service $SERVICE_NAME..."
TASK_ARN=$(aws ecs describe-services --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --services "$SERVICE_NAME" --query 'services[0].taskDefinition' --output text)
if [ -z "$TASK_ARN" ] || [ "$TASK_ARN" = "None" ]; then
  echo "Could not find existing task definition for $SERVICE_NAME" >&2
  exit 2
fi

echo "Describing task definition $TASK_ARN"
TASK_DEF_JSON=$(aws ecs describe-task-definition --region "$AWS_REGION" --task-definition "$TASK_ARN" --query 'taskDefinition')

# Remove fields not allowed in register-task-definition
NEW_TASK_DEF=$(echo "$TASK_DEF_JSON" | jq 'del(.status, .revision, .taskDefinitionArn, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

# Replace container image(s)
NEW_TASK_DEF=$(echo "$NEW_TASK_DEF" | jq --arg IMAGE "$IMAGE_URI" '.containerDefinitions |= map(.image = $IMAGE)')

# Register new task definition
echo "Registering new task definition revision..."
NEW_REGISTERED=$(echo "$NEW_TASK_DEF" | aws ecs register-task-definition --region "$AWS_REGION" --cli-input-json file:///dev/stdin <<<"$(cat)")

# The above aws call via stdin may not work in all shells; fallback:
if [ -z "$NEW_REGISTERED" ]; then
  echo "Registering with temporary file fallback"
  TMPFILE=$(mktemp)
  echo "$NEW_TASK_DEF" > "$TMPFILE"
  NEW_REGISTERED=$(aws ecs register-task-definition --region "$AWS_REGION" --cli-input-json file://"$TMPFILE")
  rm -f "$TMPFILE"
fi

NEW_TASK_DEF_ARN=$(echo "$NEW_REGISTERED" | jq -r '.taskDefinition.taskDefinitionArn')
echo "New task definition ARN: $NEW_TASK_DEF_ARN"

echo "Updating service $SERVICE_NAME to use $NEW_TASK_DEF_ARN"
aws ecs update-service --region "$AWS_REGION" --cluster "$CLUSTER_NAME" --service "$SERVICE_NAME" --task-definition "$NEW_TASK_DEF_ARN"

echo "Deployment started. Monitor with: aws ecs describe-services --cluster $CLUSTER_NAME --services $SERVICE_NAME --region $AWS_REGION"
