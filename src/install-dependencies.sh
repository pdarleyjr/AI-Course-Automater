#!/bin/bash
# Script to install all dependencies for the AI-Course-Automater project

echo "Installing Node.js dependencies..."
npm install

echo "Installing Playwright dependencies..."
npm install --save-dev @playwright/test
npx playwright install

echo "Installing LangChain dependencies..."
npm install langchain

# Check if Python is available
if command -v python3 &>/dev/null; then
    echo "Installing Python dependencies..."
    pip3 install -U langchain langchain-openai playwright
    python3 -m playwright install
else
    echo "Python not found. Skipping Python dependencies."
fi

echo "All dependencies installed successfully!"