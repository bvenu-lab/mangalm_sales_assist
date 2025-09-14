# Cloud SQL Database Setup

## Quick Setup Commands

Run these commands to initialize your Cloud SQL database:

```bash
# 1. Connect to Cloud SQL instance
gcloud sql connect mangalm-db --user=postgres --project=sales-assist-pilot

# 2. Create database (if not exists)
CREATE DATABASE mangalm_sales;

# 3. Connect to the database
\c mangalm_sales

# 4. Run the initialization script
\i database/cloud-init.sql
```

## Alternative: Using Cloud Shell

1. Open Cloud Shell in GCP Console
2. Clone your repository:
```bash
git clone https://github.com/eswears/mangalm_sales_assist.git
cd mangalm_sales_assist
```

3. Connect to Cloud SQL:
```bash
gcloud sql connect mangalm-db --user=postgres --database=mangalm_sales
```

4. Paste the contents of `database/cloud-init.sql`

## Verify Database is Working

```bash
# Test from Cloud Shell
gcloud sql connect mangalm-db --user=postgres --database=mangalm_sales

# Run test query
SELECT * FROM stores LIMIT 1;
```

## Troubleshooting API 500 Errors

If APIs return 500 errors, check:

1. **Database exists**: Ensure `mangalm_sales` database exists
2. **Tables exist**: Run the cloud-init.sql script
3. **Service logs**: Check Cloud Run logs for connection errors
```bash
gcloud run logs read mangalm-api-gateway --project=sales-assist-pilot
```

4. **Cloud SQL connection**: Verify services have Cloud SQL client permissions
```bash
gcloud projects add-iam-policy-binding sales-assist-pilot \
  --member="serviceAccount:445344153219-compute@developer.gserviceaccount.com" \
  --role="roles/cloudsql.client"
```

## Test API Endpoints

After database setup, test the APIs:

```bash
# Test stores endpoint
curl https://mangalm-api-gateway-445344153219.us-west1.run.app/api/stores

# Test health endpoint
curl https://mangalm-api-gateway-445344153219.us-west1.run.app/health
```

## Expected Response

If working correctly, you should see:
```json
[
  {
    "id": 1,
    "store_id": "STORE001",
    "name": "Test Store 1",
    "city": "New York",
    "state": "NY",
    "segment": "Premium"
  }
]
```