# Getting Started with AI-Course-Automater

This document provides detailed instructions on how to set up and use the AI-Course-Automater project.

## Overview

AI-Course-Automater is a remote automation project that utilizes various applications and tools to complete courses on a web-based LMS with time-gated assignments. The project integrates:

1. **Nginx Proxy Manager** - For handling HTTP requests and routing
2. **Skyvern AI** - For web automation and course completion

## Setup

### 1. Environment Setup

The project uses Docker for containerization, which ensures consistent environments across different machines.

#### Prerequisites:
- Docker
- Docker Compose
- OpenAI API Key (for Skyvern AI)

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

### Common Issues

1. **Port Conflicts**: If ports 80, 81, or 443 are already in use on your system, you'll need to modify the port mappings in the `docker-compose.yml` file.

2. **SSL Certificate Issues**: SSL certificates are stored in the `letsencrypt` directory. If you encounter SSL-related issues, check this directory for any problems.

3. **Data Persistence**: All data is stored in the `data` directory. If you need to reset the application, you can delete the contents of this directory (but keep the `.gitkeep` file).

4. **Skyvern API Key Issues**: If you encounter issues with the OpenAI API key, check the Skyvern logs using `docker-compose logs skyvern` to see specific error messages.

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