#!/bin/sh

# Install backend dependencies
echo "Installing backend dependencies..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing npm packages..."
  npm install
else
  echo "node_modules already exists, checking for updates..."
  npm install --check-files
fi

# Install any missing dependencies
echo "Installing required packages..."
npm install express cors ws uuid winston @playwright/test axios dotenv langchain pg

# Install nodemon for development
echo "Installing development dependencies..."
npm install -D nodemon

echo "Backend dependencies installation complete!"