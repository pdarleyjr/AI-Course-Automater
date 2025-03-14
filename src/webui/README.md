# AI Course Automater Web UI

A terminal-themed React.js Web Interface for the AI Course Automater project. This UI allows users to provide their TargetSolutions login credentials and OpenAI API key to initiate the course automation process.

## Features

- Terminal-themed user interface
- Secure credential handling
- Real-time logging of automation progress
- Interactive terminal commands
- Docker integration

## Getting Started

### Prerequisites

- Node.js 16+ and npm
- Docker and Docker Compose (for containerized deployment)

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm start
   ```

3. Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

### Building for Production

```bash
npm run build
```

This builds the app for production to the `build` folder.

## Docker Deployment

The Web UI is configured to run in a Docker container as part of the AI Course Automater project.

1. Build and start the container:
   ```bash
   docker-compose up -d webui
   ```

2. Access the UI at [http://localhost:3000](http://localhost:3000)

## Project Structure

```
src/webui/
├── public/                 # Public assets
├── src/                    # Source code
│   ├── components/         # React components
│   │   ├── LoginForm.js    # Secure login form
│   │   ├── LogOutput.js    # Terminal output display
│   │   └── TerminalUI.js   # Terminal UI component
│   ├── services/           # API services
│   │   └── api.js          # API communication
│   ├── App.js              # Main application component
│   ├── App.css             # Application styles
│   ├── index.js            # Entry point
│   └── index.css           # Global styles
├── .dockerignore           # Docker ignore file
├── Dockerfile              # Docker configuration
├── package.json            # Dependencies and scripts
└── README.md               # Documentation
```

## Available Commands

In the terminal interface, you can use the following commands:

- `help` - Show available commands
- `status` - Check automation status
- `stop` - Stop the automation
- `clear` - Clear the terminal

## Integration with Backend

The Web UI communicates with the backend API to:

1. Send user credentials securely
2. Receive real-time status updates
3. Control the automation process

## Security Considerations

- Credentials are only stored in memory during the session
- Passwords and API keys are masked in the UI
- All credentials are erased after use
- Communication with the backend is encrypted

## Contributing

Please refer to the main project's CONTRIBUTING.md file for guidelines on how to contribute to this project.
