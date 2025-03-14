# Automation Source Code

This directory contains the source code for the AI-Course-Automater project.

## Structure

The automation code will be organized as follows:

```
src/
├── config/         # Configuration files
├── core/           # Core automation logic
├── handlers/       # Event handlers
├── models/         # Data models
├── services/       # External service integrations
├── utils/          # Utility functions
└── index.js        # Main entry point
```

## Development

When developing automation scripts, consider the following:

1. **Modularity**: Keep code modular and focused on specific tasks
2. **Error Handling**: Implement robust error handling
3. **Logging**: Add comprehensive logging for debugging
4. **Testing**: Write tests for critical functionality
5. **Documentation**: Document code and functionality

## Getting Started

To start developing automation scripts:

1. Create the necessary directory structure
2. Set up configuration files
3. Implement core functionality
4. Test thoroughly

## Technologies

The automation project will use:

- JavaScript/Node.js for scripting
- Playwright for web automation
- Axios for API requests
- Winston for logging

## Playwright Automation

This project uses Playwright for web automation. Playwright is a powerful framework that allows testing and automation across all modern browsers (Chromium, Firefox, and WebKit).

### Directory Structure

The Playwright-specific files are organized as follows:

```
src/
├── playwright.config.js  # Playwright configuration
├── tests/                # Playwright test files
│   └── example.spec.js   # Example test
└── core/
    └── lms-automation.js # Core LMS automation logic
```

### Running Tests

To run Playwright tests:

```bash
# Inside the Docker container
cd /app
npm test

# Run with UI mode
npm run test:ui

# Run with headed browsers
npm run test:headed

# Generate code with Playwright Codegen
npm run codegen
```

### Viewing Reports

After running tests, you can view the HTML report:

```bash
npm run report
```

The report will be available in the `artifacts/playwright-report` directory.

### Using Playwright with Skyvern

The Playwright automation is configured to work alongside Skyvern. While Skyvern provides AI-powered automation, Playwright gives you more fine-grained control for specific automation tasks.

You can use both tools together:

1. Use Skyvern for complex, AI-driven tasks
2. Use Playwright for scripted, deterministic automation

The `utils/skyvern-api.js` file provides helper functions to interact with the Skyvern API from your Playwright scripts.