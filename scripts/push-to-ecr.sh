#!/usr/bin/env bash
set -euo pipefail

if [ -z "${AWS_REGION:-}" ] || [ -z "${AWS_ACCOUNT_ID:-}" ] || [ -z "${ECR_REPO:-}" ]; then
  echo "Usage: AWS_REGION=... AWS_ACCOUNT_ID=... ECR_REPO=... ./scripts/push-to-ecr.sh [image_tag]"
  exit 1
fi

IMAGE_TAG=${1:-latest}
REPO_URI="$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$ECR_REPO"

echo "Logging in to ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

echo "Building image $REPO_URI:$IMAGE_TAG"
docker build -t "$ECR_REPO:$IMAGE_TAG" -f server/Dockerfile .
docker tag "$ECR_REPO:$IMAGE_TAG" "$REPO_URI:$IMAGE_TAG"

echo "Pushing to $REPO_URI:$IMAGE_TAG"
docker push "$REPO_URI:$IMAGE_TAG"

echo "Image pushed: $REPO_URI:$IMAGE_TAG"
echo "$REPO_URI:$IMAGE_TAG"
