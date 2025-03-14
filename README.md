# AI-Course-Automater

A remote automation project that utilizes various applications and tools to complete courses on a web-based LMS with time-gated assignments.

## Project Structure

```
AI-Course-Automater/
├── data/                 # Persistent data storage for the application
├── docs/                 # Documentation files
├── letsencrypt/          # SSL certificates for secure connections
├── scripts/              # Utility scripts
├── log/                  # Log files from the automation processes
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

3. Set up environment variables:
   
   Create a `.env` file in the project root with the following variables:
   ```
   OPENAI_API_KEY=your_openai_api_key
   LMS_URL=https://your-lms-url.com
   LMS_USERNAME=your_username
   LMS_PASSWORD=your_password
   ```
4. Install dependencies:
   
   The project includes a script to install all necessary dependencies:
   ```bash
   cd src
   chmod +x install-dependencies.sh
   ./install-dependencies.sh
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

## Components

The project consists of several key components:

### Nginx Proxy Manager

Handles HTTP requests and provides a web interface for managing proxies, hosts, and SSL certificates.

### Skyvern

AI-powered browser automation platform that helps with complex web interactions.

### Playwright

Browser automation library used for navigating and interacting with web pages.

### LangChain Integration

LangChain is integrated to provide intelligent automation capabilities:

- Analyzing course content and extracting key information
- Generating responses for text-based assignments
- Answering multiple-choice questions intelligently
- Assessing assignments to determine their type and requirements

For detailed information about the LangChain integration, see [src/LANGCHAIN_INTEGRATION.md](src/LANGCHAIN_INTEGRATION.md).

## Development

### Running Examples

To run the JavaScript examples:
```
cd src
node examples/langchain_example.js
```

To run the Python examples:
```
cd src
python examples/langchain_example.py
```

### Troubleshooting Dependencies

If you encounter errors related to missing modules (e.g., `Cannot find module '@playwright/test'`), run:
```bash
npm install --save-dev @playwright/test
```

### Project Log

All project progress and activities are tracked in the [PROJECT_LOG.md](PROJECT_LOG.md) file. This log contains a chronological record of all development work, configuration changes, and future plans.

# License

[MIT License](LICENSE)
