# Docker Deployment Guide for Azure

This guide explains how to set up a Docker container with FFmpeg for the MystWell API in Azure App Service.

## Prerequisites

1. Azure CLI installed
2. GitHub account with access to the repository
3. Azure subscription with contributor access

## Step 1: Create Azure Container Registry (ACR)

```bash
# Login to Azure
az login

# Create a resource group (if it doesn't exist)
az group create --name mystwellresources --location centralindia

# Create Azure Container Registry
az acr create --resource-group mystwellresources --name mystacr --sku Basic --admin-enabled true
```

## Step 2: Set up GitHub Secrets

Add these secrets to your GitHub repository:

1. Go to your GitHub repository > Settings > Secrets > Actions
2. Add the following secrets:

- `AZURE_REGISTRY_USERNAME`: The username for your ACR (get with `az acr credential show --name mystacr --query "username" -o tsv`)
- `AZURE_REGISTRY_PASSWORD`: The password for your ACR (get with `az acr credential show --name mystacr --query "passwords[0].value" -o tsv`)

## Step 3: Configure App Service for Docker

```bash
# Create App Service Plan (if it doesn't exist)
az appservice plan create --name mystwell-plan --resource-group mystwellresources --is-linux --sku B1

# Create Web App with placeholder image
az webapp create --resource-group mystwellresources --plan mystwell-plan --name mystwell-api \
  --deployment-container-image-name hello-world
```

## Step 4: Configure Environment Variables

Add your application settings to the web app:

```bash
az webapp config appsettings set --resource-group mystwellresources --name mystwell-api \
  --settings \
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=true \
  SUPABASE_URL=REDACTED_SUPABASE_URL \
  SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
  SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... \
  REDIS_HOST=mystcache.redis.cache.windows.net \
  REDIS_PORT=6380 \
  REDIS_PASSWORD=your-redis-password \
  GOOGLE_PROJECT_ID=mystwell \
  GOOGLE_SPEECH_RECOGNIZER_NAME=projects/mystwell/locations/asia-southeast1/recognizers/scribechirp0 \
  GOOGLE_GEMINI_API_KEY=your-gemini-api-key \
  GOOGLE_APPLICATION_CREDENTIALS_JSON=@Microsoft.KeyVault(VaultName=mistykv;SecretName=google-speech-cred)
```

## Step 5: Trigger GitHub Workflow

Push to main branch or manually trigger the workflow:

1. Go to GitHub repository > Actions
2. Select "Docker Build and Deploy"
3. Click "Run workflow"

## Step 6: Verify Deployment

1. Check GitHub Actions for successful build and deploy
2. Visit your web app URL: https://mystwell-api.azurewebsites.net
3. Check logs for successful startup and FFmpeg availability

## Troubleshooting

If you encounter issues:

1. Check the Azure App Service logs
2. Confirm ACR credentials are correct
3. Verify environment variables are properly set
4. Inspect Docker build logs in GitHub Actions

## Local Testing

To test the Docker container locally:

```bash
docker build -t mystwell-api:local .
docker run -p 8080:8080 mystwell-api:local
``` 