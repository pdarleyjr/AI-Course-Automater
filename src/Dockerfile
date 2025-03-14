# Build stage for backend
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Install Playwright browsers
RUN npx playwright install --with-deps chromium

# Expose the port the app runs on
EXPOSE 8000

# Command to run the application
CMD ["npm", "start"]