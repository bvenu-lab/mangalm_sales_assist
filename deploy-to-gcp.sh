#!/bin/bash

# GCP Deployment Script for Mangalm Sales Assistant
# This script helps deploy the application to Google Cloud Platform

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Mangalm Sales Assistant - GCP Deployment${NC}"
echo "=========================================="

# Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo -e "${RED}Error: gcloud CLI is not installed${NC}"
    echo "Please install the Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# Get project ID
PROJECT_ID=$(gcloud config get-value project)
if [ -z "$PROJECT_ID" ]; then
    echo -e "${YELLOW}No project set. Please enter your GCP Project ID:${NC}"
    read -r PROJECT_ID
    gcloud config set project "$PROJECT_ID"
fi

echo -e "${GREEN}Using Project: $PROJECT_ID${NC}"

# Set variables
REGION="us-west1"
REPO="mangalm-services"

# Enable required APIs
echo -e "\n${YELLOW}Enabling required Google Cloud APIs...${NC}"
gcloud services enable \
    cloudbuild.googleapis.com \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    secretmanager.googleapis.com \
    cloudresourcemanager.googleapis.com \
    --project="$PROJECT_ID"

# Create Artifact Registry repository if it doesn't exist
echo -e "\n${YELLOW}Creating Artifact Registry repository...${NC}"
gcloud artifacts repositories create $REPO \
    --repository-format=docker \
    --location=$REGION \
    --description="Mangalm Services Docker Images" \
    --project="$PROJECT_ID" 2>/dev/null || echo "Repository already exists"

# Configure docker authentication
echo -e "\n${YELLOW}Configuring Docker authentication...${NC}"
gcloud auth configure-docker ${REGION}-docker.pkg.dev

# Create Cloud SQL instance (if needed)
echo -e "\n${YELLOW}Do you want to create a Cloud SQL instance? (y/n)${NC}"
read -r CREATE_SQL
if [ "$CREATE_SQL" = "y" ]; then
    INSTANCE_NAME="mangalm-db"
    gcloud sql instances create $INSTANCE_NAME \
        --database-version=POSTGRES_14 \
        --tier=db-f1-micro \
        --region=$REGION \
        --network=default \
        --database-flags=max_connections=100 \
        --project="$PROJECT_ID"
    
    # Create database
    gcloud sql databases create mangalm_sales \
        --instance=$INSTANCE_NAME \
        --project="$PROJECT_ID"
    
    echo -e "${GREEN}Cloud SQL instance created${NC}"
fi

# Set up environment variables
echo -e "\n${YELLOW}Setting up environment variables...${NC}"

# Create secrets in Secret Manager for sensitive data
echo -e "Creating secrets in Secret Manager..."

# JWT Secret
echo -n "production-jwt-secret-$(openssl rand -hex 32)" | \
    gcloud secrets create jwt-secret --data-file=- --replication-policy=automatic 2>/dev/null || \
    echo "Secret jwt-secret already exists"

# Database password
echo -n "postgres-password-$(openssl rand -hex 16)" | \
    gcloud secrets create db-password --data-file=- --replication-policy=automatic 2>/dev/null || \
    echo "Secret db-password already exists"

# Trigger Cloud Build
echo -e "\n${YELLOW}Do you want to trigger Cloud Build deployment now? (y/n)${NC}"
read -r TRIGGER_BUILD
if [ "$TRIGGER_BUILD" = "y" ]; then
    echo -e "${GREEN}Starting Cloud Build...${NC}"
    gcloud builds submit \
        --config=cloudbuild.yaml \
        --substitutions=_REGION=$REGION,_REPO=$REPO,_ENV=production \
        --project="$PROJECT_ID"
fi

echo -e "\n${GREEN}Deployment configuration complete!${NC}"
echo -e "Next steps:"
echo -e "1. Update your database connection strings in the services"
echo -e "2. Configure service-to-service authentication"
echo -e "3. Set up monitoring and logging"
echo -e "4. Configure custom domains (optional)"

echo -e "\n${YELLOW}Service URLs will be:${NC}"
echo -e "- Frontend: https://mangalm-sales-frontend-${PROJECT_ID}.${REGION}.run.app"
echo -e "- API Gateway: https://mangalm-api-gateway-${PROJECT_ID}.${REGION}.run.app"