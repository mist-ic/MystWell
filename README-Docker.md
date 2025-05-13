# MystWell API Docker Configuration

This README explains how to use Docker to deploy the MystWell API with FFmpeg.

## Overview

The MystWell API has been configured to run as a Docker container with the following features:

- FFmpeg pre-installed for audio processing
- Node.js 20 LTS runtime
- Automatic environment variable configuration
- Support for both local development and Azure deployment

## Quick Start

### Local Development

1. Make sure you have Docker installed on your machine
2. Clone this repository
3. Run the setup script:
   - Windows: `.\scripts\local-docker-setup.ps1`
   - Linux/Mac: `./scripts/local-docker-setup.sh`
4. Access the API at `http://localhost:8080`

### Azure Deployment

See the comprehensive guide at [docs/docker-deployment-guide.md](docs/docker-deployment-guide.md)

## Docker Image Details

The Docker image includes:

- Node.js 20 LTS
- FFmpeg (latest version)
- NPM packages as specified in package.json
- Custom startup configuration

## Environment Variables

The following environment variables are required:

```
SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
REDIS_HOST
REDIS_PORT
REDIS_PASSWORD
GOOGLE_PROJECT_ID
GOOGLE_SPEECH_RECOGNIZER_NAME
GOOGLE_GEMINI_API_KEY
GOOGLE_APPLICATION_CREDENTIALS_JSON
```

## Manual Build and Run

To manually build and run the Docker image:

```bash
# Build the image
docker build -t mystwell-api:local .

# Run the container
docker run -p 8080:8080 \
  -e SUPABASE_URL=your-supabase-url \
  -e SUPABASE_ANON_KEY=your-anon-key \
  -e SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
  mystwell-api:local
```

## Troubleshooting

Common issues:

1. **FFmpeg missing**: The Docker configuration should automatically install FFmpeg. If issues persist, verify the Dockerfile has the correct FFmpeg installation steps.

2. **Environment variables**: Ensure all required environment variables are properly configured.

3. **Port conflicts**: If port 8080 is already in use, modify the port mapping to use a different port: `-p 8081:8080`.

4. **Azure connection issues**: Verify the Azure Container Registry credentials and service connections are correctly configured.

For more details, see the logs in the Docker container:

```bash
docker logs mystwell-api-local
```

## Continuous Integration

The repository includes configurations for:

- GitHub Actions workflow (`.github/workflows/docker-deploy.yml`)
- Azure DevOps Pipelines (`azure-pipelines.yml`)

Choose the CI/CD system that best fits your workflow. 