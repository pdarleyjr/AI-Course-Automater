#!/bin/bash
# Shell script to check the status of the Docker container

echo -e "\033[0;36mChecking Docker container status...\033[0m"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "\033[0;31mDocker is not running. Please start Docker.\033[0m"
    exit 1
fi

echo -e "\033[0;32mDocker is running.\033[0m"

# Check if the container is running
if ! container_status=$(docker-compose ps --services --filter "status=running" 2>&1); then
    echo -e "\033[0;31mError checking container status: $container_status\033[0m"
    exit 1
fi

if echo "$container_status" | grep -q "app"; then
    echo -e "\033[0;32mContainer is running.\033[0m"
    
    # Get container details
    container_details=$(docker-compose ps)
    echo -e "\n\033[0;36mContainer Details:\033[0m"
    echo "$container_details"
    
    echo -e "\n\033[0;33mAccess the admin interface at: http://127.0.0.1:81\033[0m"
else
    echo -e "\033[0;31mContainer is not running.\033[0m"
    echo -e "\033[0;33mStart the container with: docker-compose up -d\033[0m"
fi