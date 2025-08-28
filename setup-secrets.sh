#!/bin/bash

# Setup Google Secret Manager for Mangalm Sales Assistant
# This script creates and manages secrets in Google Secret Manager

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Google Secret Manager Setup${NC}"
echo -e "${BLUE}========================================${NC}"

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

echo -e "${GREEN}Using Project: $PROJECT_ID${NC}\n"

# Enable Secret Manager API
echo -e "${YELLOW}Enabling Secret Manager API...${NC}"
gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID"

# Function to create or update a secret
create_secret() {
    local SECRET_NAME=$1
    local SECRET_VALUE=$2
    local DESCRIPTION=$3
    
    echo -e "${YELLOW}Creating secret: ${SECRET_NAME}${NC}"
    
    # Check if secret exists
    if gcloud secrets describe "$SECRET_NAME" --project="$PROJECT_ID" &>/dev/null; then
        echo -e "  Secret exists. Creating new version..."
        echo -n "$SECRET_VALUE" | gcloud secrets versions add "$SECRET_NAME" \
            --data-file=- \
            --project="$PROJECT_ID"
    else
        echo -e "  Creating new secret..."
        echo -n "$SECRET_VALUE" | gcloud secrets create "$SECRET_NAME" \
            --data-file=- \
            --replication-policy=automatic \
            --project="$PROJECT_ID"
        
        # Add description if provided
        if [ -n "$DESCRIPTION" ]; then
            gcloud secrets update "$SECRET_NAME" \
                --update-labels=description="$DESCRIPTION" \
                --project="$PROJECT_ID"
        fi
    fi
    echo -e "${GREEN}  ✓ Secret ${SECRET_NAME} created/updated${NC}"
}

echo -e "\n${BLUE}Creating Application Secrets${NC}"
echo -e "${BLUE}========================================${NC}\n"

# 1. JWT Secret
echo -e "${YELLOW}1. JWT Secret for authentication${NC}"
JWT_SECRET=$(openssl rand -hex 32)
create_secret "jwt-secret" "$JWT_SECRET" "JWT token signing secret"

# 2. Database Password
echo -e "\n${YELLOW}2. Database Password${NC}"
echo -e "Enter password for Cloud SQL database (or press Enter to generate):"
read -s DB_PASSWORD
if [ -z "$DB_PASSWORD" ]; then
    DB_PASSWORD=$(openssl rand -hex 16)
    echo -e "Generated password: ${GREEN}$DB_PASSWORD${NC}"
    echo -e "${RED}IMPORTANT: Save this password! You'll need it to access the database.${NC}"
fi
create_secret "db-password" "$DB_PASSWORD" "Cloud SQL database password"

# 3. OpenAI API Key (optional)
echo -e "\n${YELLOW}3. OpenAI API Key (for document processing)${NC}"
echo -e "Enter your OpenAI API Key (or press Enter to skip):"
read -s OPENAI_KEY
if [ -n "$OPENAI_KEY" ]; then
    create_secret "openai-api-key" "$OPENAI_KEY" "OpenAI API key for document processing"
fi

# 4. Zoho Integration (optional)
echo -e "\n${YELLOW}4. Zoho Integration Credentials${NC}"
echo -e "Do you want to set up Zoho integration? (y/n):"
read -r SETUP_ZOHO
if [ "$SETUP_ZOHO" = "y" ]; then
    echo "Enter Zoho Client ID:"
    read -r ZOHO_CLIENT_ID
    create_secret "zoho-client-id" "$ZOHO_CLIENT_ID" "Zoho OAuth Client ID"
    
    echo "Enter Zoho Client Secret:"
    read -s ZOHO_CLIENT_SECRET
    create_secret "zoho-client-secret" "$ZOHO_CLIENT_SECRET" "Zoho OAuth Client Secret"
    
    echo "Enter Zoho Refresh Token:"
    read -s ZOHO_REFRESH_TOKEN
    create_secret "zoho-refresh-token" "$ZOHO_REFRESH_TOKEN" "Zoho OAuth Refresh Token"
fi

# Grant Cloud Run service account access to secrets
echo -e "\n${YELLOW}Granting Cloud Run access to secrets...${NC}"

# Get the default service account
SERVICE_ACCOUNT="${PROJECT_ID}-compute@developer.gserviceaccount.com"

# Grant access to each secret
for SECRET in "jwt-secret" "db-password" "openai-api-key" "zoho-client-id" "zoho-client-secret" "zoho-refresh-token"; do
    if gcloud secrets describe "$SECRET" --project="$PROJECT_ID" &>/dev/null; then
        echo -e "Granting access to ${SECRET}..."
        gcloud secrets add-iam-policy-binding "$SECRET" \
            --member="serviceAccount:${SERVICE_ACCOUNT}" \
            --role="roles/secretmanager.secretAccessor" \
            --project="$PROJECT_ID" &>/dev/null
    fi
done

echo -e "${GREEN}✓ Service account granted access to secrets${NC}"

# Display secret URIs for Cloud Run
echo -e "\n${BLUE}========================================${NC}"
echo -e "${GREEN}Secret Manager Setup Complete!${NC}"
echo -e "${BLUE}========================================${NC}"

echo -e "\n${YELLOW}To use these secrets in Cloud Run, use these environment variable values:${NC}"
echo -e "JWT_SECRET=${GREEN}projects/$PROJECT_ID/secrets/jwt-secret:latest${NC}"
echo -e "DB_PASSWORD=${GREEN}projects/$PROJECT_ID/secrets/db-password:latest${NC}"
if [ -n "$OPENAI_KEY" ]; then
    echo -e "OPENAI_API_KEY=${GREEN}projects/$PROJECT_ID/secrets/openai-api-key:latest${NC}"
fi
if [ "$SETUP_ZOHO" = "y" ]; then
    echo -e "ZOHO_CLIENT_ID=${GREEN}projects/$PROJECT_ID/secrets/zoho-client-id:latest${NC}"
    echo -e "ZOHO_CLIENT_SECRET=${GREEN}projects/$PROJECT_ID/secrets/zoho-client-secret:latest${NC}"
    echo -e "ZOHO_REFRESH_TOKEN=${GREEN}projects/$PROJECT_ID/secrets/zoho-refresh-token:latest${NC}"
fi

echo -e "\n${YELLOW}View secrets in the console:${NC}"
echo -e "https://console.cloud.google.com/security/secret-manager?project=$PROJECT_ID"

echo -e "\n${YELLOW}List all secrets:${NC}"
echo -e "gcloud secrets list --project=$PROJECT_ID"

echo -e "\n${YELLOW}Read a secret value:${NC}"
echo -e "gcloud secrets versions access latest --secret=SECRET_NAME --project=$PROJECT_ID"