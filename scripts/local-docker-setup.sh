#!/bin/bash

# Change to the project root directory
cd "$(dirname "$0")/.."

# Build Docker image
echo -e "\033[0;36mBuilding Docker image...\033[0m"
docker build -t mystwell-api:local .

# Check if build was successful
if [ $? -ne 0 ]; then
    echo -e "\033[0;31mDocker build failed with exit code $?\033[0m"
    exit $?
fi

# Run container with environment variables
echo -e "\033[0;36mRunning Docker container...\033[0m"
docker run -p 8080:8080 \
    -e "NODE_ENV=development" \
    -e "SUPABASE_URL=https://crrfkriikclvcddbsczc.supabase.co" \
    -e "SUPABASE_ANON_KEY=your-supabase-anon-key" \
    -e "SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key" \
    --name mystwell-api-local mystwell-api:local

# Display info
echo -e "\033[0;32mContainer started. Access the application at: http://localhost:8080\033[0m"
echo -e "\033[0;33mPress Ctrl+C to stop the container.\033[0m"

# Cleanup command (for reference)
echo -e "\n\033[0;35mTo stop and remove the container later, run:\033[0m"
echo -e "\033[0;35mdocker stop mystwell-api-local && docker rm mystwell-api-local\033[0m" 