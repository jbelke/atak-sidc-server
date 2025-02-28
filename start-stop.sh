#!/bin/bash

# Source the environment variables
set -a
source .env
set +a

# Stop any running containers
docker compose down

# Build and start containers
docker compose up -d --build

# Wait for container to be ready
echo "Waiting for container to be ready..."
sleep 10

# Run the build inside the container
docker exec ${DOCKER_CONTAINER_NAME} yarn build

# Restart PM2 processes
docker exec ${DOCKER_CONTAINER_NAME} pm2 reload all
