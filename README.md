# AI-Course-Automater

A remote automation project that utilizes various applications and tools to complete courses on a web-based LMS with time-gated assignments.

## Project Structure

```
AI-Course-Automater/
├── data/                 # Persistent data storage for the application
├── docs/                 # Documentation files
├── letsencrypt/          # SSL certificates for secure connections
├── scripts/              # Utility scripts
├── src/                  # Source code for the automation project
└── docker-compose.yml    # Docker configuration file
```

## Quick Setup

### Prerequisites

- Docker: [Docker Install documentation](https://docs.docker.com/get-docker/)
- Docker Compose: [Docker-Compose Install documentation](https://docs.docker.com/compose/install/)

### Installation

1. Clone this repository:
   ```
   git clone https://github.com/yourusername/AI-Course-Automater.git
   cd AI-Course-Automater
   ```

2. Start the Docker container:
   ```
   docker-compose up -d
   ```
   
   If using docker-compose-plugin:
   ```
   docker compose up -d
   ```

3. Access the Admin UI:
   
   When your docker container is running, connect to it on port 81 for the admin interface:
   ```
   http://127.0.0.1:81
   ```

   Default Admin User:
   - Email: admin@example.com
   - Password: changeme

   **Note:** After logging in with the default credentials, you will be prompted to change them. If you've already set up custom credentials, use those instead.

## Development

The project uses Nginx Proxy Manager for handling HTTP requests. The automation scripts will be developed in the `src` directory.

### Project Log

All project progress and activities are tracked in the [PROJECT_LOG.md](PROJECT_LOG.md) file. This log contains a chronological record of all development work, configuration changes, and future plans.

# License

[MIT License](LICENSE)
