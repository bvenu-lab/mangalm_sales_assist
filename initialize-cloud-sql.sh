#!/bin/bash
# Initialize Cloud SQL database with schema

PROJECT_ID="sales-assist-pilot"
INSTANCE_NAME="mangalm-db"
DATABASE_NAME="mangalm_sales"
REGION="us-west1"

echo "Initializing Cloud SQL database..."

# Create database if it doesn't exist
gcloud sql databases create $DATABASE_NAME \
  --instance=$INSTANCE_NAME \
  --project=$PROJECT_ID || echo "Database already exists"

# Run initialization scripts in order
for script in database/init/*.sql; do
  if [[ ! "$script" == *"clear-all-tables.sql"* ]]; then
    echo "Running $script..."
    gcloud sql import sql $INSTANCE_NAME gs://YOUR_BUCKET/$script \
      --database=$DATABASE_NAME \
      --project=$PROJECT_ID || echo "Script $script failed or already applied"
  fi
done

echo "Database initialization complete"