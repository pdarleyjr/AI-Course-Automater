/**
 * Test script for Target Solutions integration
 * This script tests the Target Solutions integration with sample credentials
 */
const { chromium } = require('@playwright/test');
const targetSolutionsIntegration = require('../integrations/target-solutions-integration');
const enhancedStealth = require('../utils/enhanced-stealth');

// Configure logging
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'test-target-solutions' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

/**
 * Test the Target Solutions login
 */
async function testLogin() {
  logger.info('Testing Target Solutions login...');
  
  // Create stealth browser
  const { browser, context } = await enhancedStealth.createStealthBrowser({
    headless: false // Set to true for headless mode
  });
  
  // Create a new page
  const page = await context.newPage();
  
  try {
    // Navigate to login page
    await page.goto(process.env.LMS_URL || 'https://app.targetsolutions.com/auth/index.cfm?action=login.showloginone&customerid=0&customerpath=login&msg=');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    logger.info('Login page loaded. Please enter credentials manually for testing.');
    
    // Wait for manual login
    logger.info('Waiting for manual login...');
    
    // Wait for navigation after login
    await page.waitForNavigation({ timeout: 60000 });
    
    // Check if login was successful
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('.btn-login') && 
             (document.querySelector('#navTop') || 
              document.querySelector('.navbar') || 
              document.querySelector('.optionsRight'));
    });
    
    if (isLoggedIn) {
      logger.info('Login successful!');
      
      // Navigate to My Assignments page
      logger.info('Navigating to My Assignments page...');
      
      // Try to find and click the My Assignments link
      const myAssignmentsLink = page.locator('a:has-text("My Assignments")').first();
      
      if (await myAssignmentsLink.count() > 0) {
        logger.info('Clicking My Assignments link...');
        await myAssignmentsLink.click();
        
        // Wait for navigation
        await page.waitForNavigation({ waitUntil: 'networkidle' });
        
        // Verify we're on the My Assignments page
        const isOnMyAssignmentsPage = await page.evaluate(() => {
          return document.querySelector('h1.header')?.textContent.includes('My Assignments');
        });
        
        if (isOnMyAssignmentsPage) {
          logger.info('Successfully navigated to My Assignments page');
          
          // Take a screenshot
          await page.screenshot({ path: '../artifacts/screenshots/my-assignments.png' });
          logger.info('Screenshot saved to ../artifacts/screenshots/my-assignments.png');
          
          // Wait for user to review
          logger.info('Test completed successfully. Press Ctrl+C to exit.');
          await new Promise(r => setTimeout(r, 30000));
        } else {
          logger.error('Failed to navigate to My Assignments page');
        }
      } else {
        logger.error('My Assignments link not found');
      }
    } else {
      logger.error('Login failed');
    }
  } catch (error) {
    logger.error('Error in test:', error);
  } finally {
    // Close browser
    await browser.close();
  }
}

/**
 * Main test function
 */
async function main() {
  logger.info('Starting Target Solutions integration tests...');
  
  // Test login
  await testLogin();
  
  logger.info('Tests completed');
}

// Run the tests
if (require.main === module) {
  main().catch(error => {
    logger.error('Unhandled error in main function:', error);
    process.exit(1);
  });
}

module.exports = { testLogin, main };