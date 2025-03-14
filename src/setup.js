/**
 * Setup script to ensure all necessary directories exist
 */
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const mkdir = promisify(fs.mkdir);
const exists = promisify(fs.exists);

// Directories to ensure exist
const directories = [
  '../artifacts/screenshots',
  '../videos',
  '../har',
  '../log',
];

/**
 * Ensure a directory exists, creating it if necessary
 * @param {string} dir - Directory path
 */
async function ensureDirectoryExists(dir) {
  try {
    const dirExists = await exists(dir);
    if (!dirExists) {
      console.log(`Creating directory: ${dir}`);
      await mkdir(dir, { recursive: true });
    }
  } catch (error) {
    console.error(`Error creating directory ${dir}:`, error);
  }
}

/**
 * Main setup function
 */
async function setup() {
  console.log('Setting up directories...');
  
  for (const dir of directories) {
    await ensureDirectoryExists(dir);
  }
  
  console.log('Setup complete!');
}

// Run setup if this file is executed directly
if (require.main === module) {
  setup().catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
}

module.exports = { setup, ensureDirectoryExists };