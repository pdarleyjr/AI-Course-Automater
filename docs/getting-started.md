# Getting Started with AI-Course-Automater

This document provides detailed instructions on how to set up and use the AI-Course-Automater project.

## Overview

AI-Course-Automater is a remote automation project that utilizes various applications and tools to complete courses on a web-based LMS with time-gated assignments. The project integrates:

1. **Nginx Proxy Manager** - For handling HTTP requests and routing
2. **Skyvern AI** - For web automation and course completion
3. **Playwright** - For scripted web automation and testing
4. **LangChain** - For intelligent automation and content generation

## Setup

### 1. Environment Setup

The project uses Docker for containerization, which ensures consistent environments across different machines.

#### Prerequisites:
- Docker
- Docker Compose
- OpenAI API Key (for Skyvern AI and LangChain)

### 2. Configuration

The project uses Nginx Proxy Manager for handling HTTP requests. After starting the Docker container, you can access the admin interface at http://127.0.0.1:81.

Default login credentials:
-

**Important:** Change these credentials immediately after your first login.
If you've already set up custom credentials, use those instead of the default ones.

#### Skyvern Configuration

Before starting the Docker container, you need to configure Skyvern with your OpenAI API key:

1. Open the `docker-compose.yml` file
2. Locate the `skyvern` service section
3. Replace `<your_openai_key>` with your actual OpenAI API key in the `OPENAI_API_KEY` environment variable

```yaml
- OPENAI_API_KEY=<your_openai_key>
```

#### Playwright Configuration

The Playwright automation is pre-configured in the Docker Compose file. You can customize its behavior by setting environment variables:

1. Open the `docker-compose.yml` file
2. Locate the `playwright` service section
3. Add or modify environment variables as needed:

```yaml
environment:
  - NODE_ENV=development
  - PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
  - HEADLESS=false  # Set to false for headed mode
  - LMS_USERNAME=your_username  # Your LMS credentials
```

#### LangChain Configuration

LangChain is integrated to provide intelligent automation capabilities. Configure it by setting environment variables:

1. Create a `.env` file in the project root directory with the following content:

```
OPENAI_API_KEY=your_openai_api_key
LMS_URL=https://your-lms-url.com
LMS_USERNAME=your_username
LMS_PASSWORD=your_password
```

2. Alternatively, you can set these variables directly in the `docker-compose.yml` file:

```yaml
- OPENAI_API_KEY=your_openai_api_key
```

### 3. Automation Setup

The automation scripts will be developed in the `src` directory. These scripts will interact with the web-based LMS to complete time-gated assignments.

## Usage

### Starting the Container

```bash
# Start the container in detached mode
docker-compose up -d

# Check if the container is running
docker-compose ps
```

### Stopping the Container

```bash
# Stop the container
docker-compose down
```

### Viewing Logs

```bash
# View logs
docker-compose logs

# Follow logs
docker-compose logs -f
```

## Troubleshooting

### Accessing Skyvern UI

After starting the container, you can access the Skyvern UI at:
```
http://localhost:8080
```

The Skyvern API is available at:
```
http://localhost:8000
```

### Accessing Playwright

To work with the Playwright automation:

```bash
# Connect to the Playwright container
docker-compose exec playwright bash
cd /app
```

### Accessing LangChain Services

The project includes both JavaScript and Python implementations of LangChain:

```bash
# Connect to the JavaScript LangChain container
docker-compose exec langchain-js bash
cd /app
```

```bash
# Connect to the Python LangChain container
docker-compose exec langchain-py bash
cd /app
```

### Running LangChain Examples

To run the example scripts that demonstrate LangChain functionality:

```bash
# JavaScript example
docker-compose exec langchain-js bash -c "cd /app && node examples/langchain_example.js"

# Python example
docker-compose exec langchain-py bash -c "cd /app && python examples/langchain_example.py"
```

### Common Issues

1. **Port Conflicts**: If ports 80, 81, or 443 are already in use on your system, you'll need to modify the port mappings in the `docker-compose.yml` file.

2. **SSL Certificate Issues**: SSL certificates are stored in the `letsencrypt` directory. If you encounter SSL-related issues, check this directory for any problems.

3. **Data Persistence**: All data is stored in the `data` directory. If you need to reset the application, you can delete the contents of this directory (but keep the `.gitkeep` file).

4. **Skyvern API Key Issues**: If you encounter issues with the OpenAI API key, check the Skyvern logs using `docker-compose logs skyvern` to see specific error messages.

5. **Playwright Browser Issues**: If you encounter browser-related issues in Playwright, try running with `HEADLESS=false` to see what's happening visually, or check the videos and screenshots in the artifacts directory.

6. **LangChain API Key Issues**: If you encounter issues with LangChain, check that your OpenAI API key is correctly set in the environment variables and that you have sufficient quota for the API calls.

## Project Log

The project maintains a comprehensive log of all activities and progress in the `PROJECT_LOG.md` file at the root of the repository. This log serves as a historical record of the project's development.

### Updating the Project Log

To make it easier to maintain the project log, utility scripts are provided:

#### Windows (PowerShell):
```powershell
# Add a new entry to the log
.\scripts\update-log.ps1 -EntryType "Development" -EntryTitle "Implemented Feature X" -EntryContent "- Added feature X\n- Fixed bug Y\n- Improved performance of Z"
```

#### Linux/macOS (Bash):
```bash
# Add a new entry to the log
./scripts/update-log.sh "Development" "Implemented Feature X" "- Added feature X\n- Fixed bug Y\n- Improved performance of Z"
```

These scripts will automatically add the entry under the current date section, creating a new date section if needed.

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for details on how to contribute to this project.