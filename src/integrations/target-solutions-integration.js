/**
 * Integration module for Target Solutions LMS automation
 * Connects the Target Solutions handler with the main automation system
 */
const { chromium } = require('@playwright/test');
const winston = require('winston');
const config = require('../config/default');
const targetSolutionsHandler = require('../utils/target-solutions-handler');
const enhancedStealth = require('../utils/enhanced-stealth');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'target-solutions-integration' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/ts-integration-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/ts-integration-combined.log` 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

/**
 * Run the Target Solutions automation with enhanced capabilities
 * @param {Object} credentials - User credentials
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Result object
 */
async function runTargetSolutionsAutomation(credentials, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Starting Target Solutions automation with enhanced capabilities...', 'info');
    
    // Validate credentials
    if (!credentials.username || !credentials.password) {
      sendLog('Missing required credentials', 'error');
      return { success: false, error: 'Missing required credentials' };
    }
    
    // Check if OpenAI API key is provided
    if (!credentials.apiKey && !process.env.OPENAI_API_KEY) {
      sendLog('Missing OpenAI API key', 'error');
      return { success: false, error: 'Missing OpenAI API key' };
    }
    
    // Set OpenAI API key if provided
    if (credentials.apiKey) {
      process.env.OPENAI_API_KEY = credentials.apiKey;
    }
    
    // Run the Target Solutions automation
    const result = await targetSolutionsHandler.runTargetSolutionsAutomation(credentials, logCallback);
    
    return result;
  } catch (error) {
    logger.error('Error in Target Solutions integration:', error);
    if (logCallback) logCallback(`Error in Target Solutions integration: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Run the Target Solutions automation with multiple browser contexts for parallel processing
 * @param {Object} credentials - User credentials
 * @param {number} maxConcurrent - Maximum number of concurrent assignments to process
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Result object
 */
async function runParallelTargetSolutionsAutomation(credentials, maxConcurrent = 2, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog(`Starting parallel Target Solutions automation (max ${maxConcurrent} concurrent)...`, 'info');
    
    // Validate credentials
    if (!credentials.username || !credentials.password) {
      sendLog('Missing required credentials', 'error');
      return { success: false, error: 'Missing required credentials' };
    }
    
    // Check if OpenAI API key is provided
    if (!credentials.apiKey && !process.env.OPENAI_API_KEY) {
      sendLog('Missing OpenAI API key', 'error');
      return { success: false, error: 'Missing OpenAI API key' };
    }
    
    // Set OpenAI API key if provided
    if (credentials.apiKey) {
      process.env.OPENAI_API_KEY = credentials.apiKey;
    }
    
    // Create stealth browser
    const { browser, context } = await enhancedStealth.createStealthBrowser();
    
    // Create a new page
    const page = await context.newPage();
    
    // Login to Target Solutions
    const loginSuccess = await targetSolutionsHandler.login(page, credentials, logCallback);
    
    if (!loginSuccess) {
      sendLog('Failed to log in to Target Solutions. Aborting automation.', 'error');
      await browser.close();
      return { success: false, error: 'Login failed' };
    }
    
    // Navigate to My Assignments page
    const myAssignmentsSuccess = await targetSolutionsHandler.navigateToMyAssignments(page, logCallback);
    
    if (!myAssignmentsSuccess) {
      sendLog('Failed to navigate to My Assignments page. Aborting automation.', 'error');
      await browser.close();
      return { success: false, error: 'Navigation to My Assignments failed' };
    }
    
    // Get assignments
    const assignments = await targetSolutionsHandler.getAssignments(page, logCallback);
    
    if (assignments.length === 0) {
      sendLog('No assignments found. Automation complete.', 'info');
      await browser.close();
      return { success: true, assignmentsCompleted: 0 };
    }
    
    // Process assignments in parallel
    sendLog(`Found ${assignments.length} assignments. Processing in parallel...`, 'info');
    
    // Limit concurrent assignments
    const actualMaxConcurrent = Math.min(assignments.length, maxConcurrent);
    
    sendLog(`Will process up to ${actualMaxConcurrent} assignments concurrently`, 'info');
    
    let completedCount = 0;
    let inProgress = 0;
    const completionPromises = [];
    
    // Process assignments in batches
    for (let i = 0; i < assignments.length; i++) {
      const assignment = assignments[i];
      
      // Wait if we've reached the maximum concurrent assignments
      if (inProgress >= actualMaxConcurrent) {
        await Promise.race(completionPromises);
      }
      
      // Create a new context for this assignment
      const assignmentContext = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        viewport: { width: 1280, height: 720 }
      });
      
      // Apply stealth mode
      await enhancedStealth.applyStealth(assignmentContext);
      
      // Create a new page for this assignment
      const assignmentPage = await assignmentContext.newPage();
      
      // Increment in-progress counter
      inProgress++;
      
      // Process this assignment
      sendLog(`Starting assignment: ${assignment.name} (due: ${assignment.dueDate})`, 'info');
      
      // Create a promise for this assignment's completion
      const completionPromise = (async () => {
        try {
          // Login for this context
          await targetSolutionsHandler.login(assignmentPage, credentials, logCallback);
          
          // Navigate to the assignment
          await assignmentPage.goto(assignment.url);
          
          // Wait for page to load
          await assignmentPage.waitForLoadState('domcontentloaded');
          
          // Complete the assignment
          const completed = await targetSolutionsHandler.completeAssignment(assignmentPage, assignment, logCallback);
          
          if (completed) {
            completedCount++;
            sendLog(`Assignment completed: ${assignment.name}`, 'success');
          } else {
            sendLog(`Failed to complete assignment: ${assignment.name}`, 'error');
          }
          
          inProgress--;
          
          // Close this context when done
          await assignmentContext.close();
        } catch (error) {
          sendLog(`Error processing assignment ${assignment.name}: ${error.message}`, 'error');
          inProgress--;
          await assignmentContext.close();
        }
      })();
      
      completionPromises.push(completionPromise);
    }
    
    // Wait for all assignments to complete
    await Promise.all(completionPromises);
    
    // Close main browser
    await browser.close();
    
    sendLog(`Target Solutions automation completed. ${completedCount} assignments completed.`, 'success');
    
    return {
      success: true,
      assignmentsCompleted: completedCount,
      totalAssignments: assignments.length
    };
  } catch (error) {
    logger.error('Error in parallel Target Solutions automation:', error);
    if (logCallback) logCallback(`Error in parallel Target Solutions automation: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

/**
 * Initialize the Target Solutions integration
 * @returns {Promise<void>}
 */
async function initialize() {
  try {
    logger.info('Initializing Target Solutions integration...');
    
    // Set up any necessary initialization here
    
    logger.info('Target Solutions integration initialized successfully');
  } catch (error) {
    logger.error('Error initializing Target Solutions integration:', error);
  }
}

// Initialize the integration
initialize().catch(console.error);

module.exports = {
  runTargetSolutionsAutomation,
  runParallelTargetSolutionsAutomation
};