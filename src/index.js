/**
 * Main entry point for the AI-Course-Automater project
 */
const { chromium } = require('@playwright/test');
const skyvernApi = require('./utils/skyvern-api');
const langchainUtils = require('./utils/langchain-utils');
const lmsAutomation = require('./core/lms-automation');

// Configure logging
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-course-automater' },
  transports: [
    new winston.transports.File({ filename: '../log/error.log', level: 'error' }),
    new winston.transports.File({ filename: '../log/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

/**
 * Main function to run the automation
 */
async function main() {
  logger.info('Starting AI-Course-Automater');
  
  try {
    // Check Skyvern API status
    logger.info('Checking Skyvern API status');
    const apiStatus = await skyvernApi.getApiStatus();
    logger.info('Skyvern API status:', apiStatus);
    
    // Launch browser
    logger.info('Launching browser');
    const browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
    });
    
    // Create a new browser context
    const context = await browser.newContext({
      recordVideo: {
        dir: '../videos/',
        size: { width: 1280, height: 720 },
      },
    });
    
    // Create a new page
    const page = await context.newPage();
    
    // Navigate to a page
    logger.info('Navigating to Skyvern UI');
    await page.goto(process.env.SKYVERN_UI_URL || 'http://localhost:8080');
    
    // Take a screenshot
    await page.screenshot({ path: '../artifacts/screenshots/skyvern-ui.png' });
    logger.info('Screenshot saved to ../artifacts/screenshots/skyvern-ui.png');
    
    // Example of using LangChain to analyze a sample assignment
    logger.info('Testing LangChain integration with a sample assignment');
    const sampleAssignment = `
      Assignment: Introduction to Artificial Intelligence
      
      In this assignment, you will explore the fundamentals of artificial intelligence.
      Write a 500-word essay discussing the ethical implications of AI in healthcare.
      
      Consider the following points:
      - Patient privacy and data security
      - Decision-making autonomy
      - Potential biases in AI algorithms
      - The role of human oversight
      
      Due date: March 20, 2025
    `;
    
    // Assess the assignment using LangChain
    const assessment = await langchainUtils.assessAssignment(sampleAssignment);
    logger.info('LangChain assessment of sample assignment:', assessment);
    
    // Generate a response to the assignment
    const response = await langchainUtils.generateAssignmentResponse(sampleAssignment);
    logger.info('Generated response sample (first 100 chars):', response.substring(0, 100) + '...');
    
    // Close browser
    await browser.close();
    logger.info('Browser closed');
    
    logger.info('AI-Course-Automater completed successfully');
  } catch (error) {
    logger.error('Error in AI-Course-Automater:', error);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in main function:', error);
    process.exit(1);
  });
}

module.exports = { main };