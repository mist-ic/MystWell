# PowerShell script for local Docker testing

# Create scripts directory if it doesn't exist
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
if (!(Test-Path $scriptsDir)) {
    New-Item -ItemType Directory -Path $scriptsDir
}

# Build Docker image
Write-Host "Building Docker image..." -ForegroundColor Cyan
docker build -t mystwell-api:local -f ../Dockerfile ..

# Check if build was successful
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed with exit code $LASTEXITCODE" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Run container with environment variables
Write-Host "Running Docker container..." -ForegroundColor Cyan
docker run -p 8080:8080 `
    -e "NODE_ENV=development" `
    -e "SUPABASE_URL=https://crrfkriikclvcddbsczc.supabase.co" `
    -e "SUPABASE_ANON_KEY=your-supabase-anon-key" `
    -e "SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key" `
    --name mystwell-api-local mystwell-api:local

# Display info
Write-Host "Container started. Access the application at: http://localhost:8080" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the container." -ForegroundColor Yellow

# Cleanup command (for reference)
Write-Host "`nTo stop and remove the container later, run:" -ForegroundColor Magenta
Write-Host "docker stop mystwell-api-local && docker rm mystwell-api-local" -ForegroundColor Magenta 