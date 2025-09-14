#!/bin/bash
# Prepare document-processor for Cloud Run deployment
# This script swaps to a minimal package.json to avoid heavy dependencies

if [ "$NODE_ENV" = "production" ] || [ "$CLOUD_BUILD" = "true" ]; then
  echo "Preparing for Cloud Run deployment..."
  if [ -f "package-cloud.json" ]; then
    mv package.json package-local.json
    mv package-cloud.json package.json
    echo "Using cloud package.json"
  fi
fi