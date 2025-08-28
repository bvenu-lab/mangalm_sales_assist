# Google Secret Manager Guide for Mangalm Sales Assistant

## What is Google Secret Manager?

Google Secret Manager is a secure and convenient storage system for API keys, passwords, certificates, and other sensitive data. It's **not a physical location** but a cloud service that you access through:

- **Google Cloud Console (Web UI)**
- **gcloud CLI commands**
- **Application code using Google Cloud libraries**

## 🌐 Accessing Secret Manager

### Option 1: Web Console (Easiest)
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select your project
3. Navigate to **Security** → **Secret Manager**
4. URL: `https://console.cloud.google.com/security/secret-manager`

### Option 2: Command Line
```bash
# List all secrets
gcloud secrets list

# View a specific secret's metadata
gcloud secrets describe secret-name

# Read a secret's value
gcloud secrets versions access latest --secret=secret-name
```

## 🚀 Quick Setup

Run one of these scripts to set up all required secrets:

### Windows:
```cmd
setup-secrets.bat
```

### Linux/Mac:
```bash
chmod +x setup-secrets.sh
./setup-secrets.sh
```

## 📝 Manual Secret Creation

If you prefer to create secrets manually:

### 1. Enable API
```bash
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Secrets
```bash
# JWT Secret
echo -n "your-jwt-secret-here" | gcloud secrets create jwt-secret --data-file=-

# Database Password
echo -n "your-db-password" | gcloud secrets create db-password --data-file=-

# OpenAI API Key (optional)
echo -n "your-openai-key" | gcloud secrets create openai-api-key --data-file=-
```

### 3. Grant Access to Cloud Run
```bash
# Replace PROJECT_ID with your actual project ID
SERVICE_ACCOUNT="PROJECT_ID-compute@developer.gserviceaccount.com"

gcloud secrets add-iam-policy-binding jwt-secret \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"

gcloud secrets add-iam-policy-binding db-password \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/secretmanager.secretAccessor"
```

## 🔗 Using Secrets in Cloud Run

Secrets are referenced in your `cloudbuild.yaml` like this:

```yaml
--set-secrets=JWT_SECRET=jwt-secret:latest,DB_PASSWORD=db-password:latest
```

In your application code, they appear as regular environment variables:
```javascript
const jwtSecret = process.env.JWT_SECRET;
const dbPassword = process.env.DB_PASSWORD;
```

## 📋 Required Secrets for Mangalm

| Secret Name | Description | Required |
|-------------|-------------|----------|
| `jwt-secret` | JWT token signing key | ✅ Yes |
| `db-password` | Cloud SQL database password | ✅ Yes |
| `openai-api-key` | OpenAI API key for document processing | ⚠️ Optional |
| `zoho-client-id` | Zoho OAuth Client ID | ⚠️ Optional |
| `zoho-client-secret` | Zoho OAuth Client Secret | ⚠️ Optional |
| `zoho-refresh-token` | Zoho OAuth Refresh Token | ⚠️ Optional |

## 🔍 Viewing Your Secrets

### In Google Cloud Console:
1. Go to https://console.cloud.google.com/security/secret-manager
2. You'll see a list of all your secrets
3. Click on any secret to view versions and metadata
4. Use "View secret value" to see the actual content

### With gcloud CLI:
```bash
# List all secrets
gcloud secrets list

# Get secret value
gcloud secrets versions access latest --secret=jwt-secret

# View secret metadata
gcloud secrets describe jwt-secret
```

## 🔒 Security Best Practices

1. **Never commit secrets to code** - Always use Secret Manager
2. **Use least privilege** - Only grant access to services that need it
3. **Rotate secrets regularly** - Create new versions periodically
4. **Monitor access** - Check audit logs for secret access
5. **Use automatic replication** - Ensures high availability

## 🆘 Troubleshooting

### "Secret not found" error:
- Verify the secret name is correct
- Ensure you're in the right GCP project
- Check if the secret exists: `gcloud secrets list`

### "Permission denied" error:
- Verify the service account has `secretmanager.secretAccessor` role
- Check IAM permissions in the Cloud Console

### "Secret version not found":
- Use `:latest` to get the most recent version
- List versions: `gcloud secrets versions list SECRET_NAME`

## 📞 Need Help?

- **GCP Documentation**: https://cloud.google.com/secret-manager/docs
- **Console**: https://console.cloud.google.com/security/secret-manager
- **Support**: Use `gcloud help secrets` for CLI help