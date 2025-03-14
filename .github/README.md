# CI/CD Pipeline Setup

This directory contains the GitHub Actions workflow for the CI/CD pipeline of the AI-Course-Automater project.

## GitHub Secrets Setup

To enable the CI/CD pipeline to push Docker images to Docker Hub, you need to add the following secrets to your GitHub repository:

1. Go to your GitHub repository
2. Click on "Settings" > "Secrets and variables" > "Actions"
3. Click on "New repository secret"
4. Add the following secrets:

   - Name: `DOCKERHUB_USERNAME`
     Value: `pdarleyjr`
   
   - Name: `DOCKERHUB_TOKEN`
     Value: `your-docker-hub-access-token` (Use the token provided separately, never commit tokens to the repository)

## Workflow Overview

The CI/CD pipeline consists of the following stages:

1. **Build and Test**: Checks out the code, installs dependencies, and runs tests.
2. **Build and Push Docker Images**: Builds Docker images for the backend and frontend services and pushes them to Docker Hub.
3. **Deploy**: Placeholder for deployment steps. For a home server setup, consider using Watchtower for automatic container updates.

## Automatic Deployment with Watchtower

For automatic deployment on your home server, you can use Watchtower to automatically update your containers when new images are pushed to Docker Hub.

To set up Watchtower:

```bash
docker run -d \
  --name watchtower \
  -v /var/run/docker.sock:/var/run/docker.sock \
  containrrr/watchtower \
  --interval 30
```

This will check for updates every 30 seconds. You can adjust the interval as needed.