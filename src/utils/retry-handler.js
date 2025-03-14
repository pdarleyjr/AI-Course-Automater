/**
 * Utility functions for intelligent retry and failover mechanisms in LMS automation
 */
const winston = require('winston');
const config = require('../config/default');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'retry-handler' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/retry-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/retry-combined.log` 
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
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries
 * @param {number} options.initialDelay - Initial delay in milliseconds
 * @param {number} options.maxDelay - Maximum delay in milliseconds
 * @param {Function} options.onRetry - Callback function on retry
 * @param {Function} options.shouldRetry - Function to determine if retry should be attempted
 * @returns {Promise<any>} - Result of the function
 */
async function withRetry(fn, options = {}) {
  const {
    maxRetries = config.automation.maxRetries || 3,
    initialDelay = config.automation.retryDelay || 1000,
    maxDelay = 30000,
    onRetry = null,
    shouldRetry = (error) => true
  } = options;

  let lastError;
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      
      // Check if we should retry
      if (attempt > maxRetries || !shouldRetry(error)) {
        break;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt - 1) + Math.random() * 1000,
        maxDelay
      );
      
      logger.warn(`Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms: ${error.message}`);
      
      // Call onRetry callback if provided
      if (onRetry) {
        try {
          await onRetry(error, attempt, delay);
        } catch (callbackError) {
          logger.error('Error in onRetry callback:', callbackError);
        }
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // If we get here, all retries failed
  throw lastError;
}

/**
 * Retry a navigation action with intelligent recovery
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} navigationFn - Navigation function to retry
 * @param {Object} options - Retry options
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether navigation was successful
 */
async function retryNavigation(page, navigationFn, options = {}, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  const defaultOptions = {
    maxRetries: config.automation.maxRetries || 3,
    initialDelay: config.automation.retryDelay || 1000,
    onRetry: async (error, attempt, delay) => {
      sendLog(`Navigation failed (attempt ${attempt}): ${error.message}. Retrying in ${Math.round(delay)}ms...`, 'warning');
      
      // Try to recover from common navigation issues
      try {
        // Check if page is still available
        if (!page.isClosed()) {
          // Check for common error indicators
          const hasErrorPage = await page.evaluate(() => {
            return document.title.includes('Error') || 
                   document.body.innerText.includes('Error') ||
                   document.body.innerText.includes('not found') ||
                   document.body.innerText.includes('unavailable');
          }).catch(() => false);
          
          if (hasErrorPage) {
            sendLog('Error page detected, attempting to go back and retry', 'warning');
            await page.goBack().catch(() => {});
          }
          
          // Check if we need to refresh
          const needsRefresh = await page.evaluate(() => {
            return document.body.innerText.includes('reload') ||
                   document.body.innerText.includes('refresh') ||
                   document.body.innerText.includes('try again');
          }).catch(() => false);
          
          if (needsRefresh) {
            sendLog('Page suggests refreshing, attempting to reload', 'warning');
            await page.reload().catch(() => {});
          }
        }
      } catch (recoveryError) {
        logger.error('Error during navigation recovery:', recoveryError);
      }
    },
    shouldRetry: (error) => {
      // Retry on common navigation errors
      return error.message.includes('timeout') ||
             error.message.includes('net::ERR') ||
             error.message.includes('Navigation failed') ||
             error.message.includes('Target closed') ||
             error.message.includes('frame was detached');
    }
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    await withRetry(async () => {
      return await navigationFn();
    }, mergedOptions);
    
    return true;
  } catch (error) {
    sendLog(`Navigation failed after ${mergedOptions.maxRetries} retries: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Retry an element interaction with intelligent recovery
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @param {Function} interactionFn - Interaction function to retry
 * @param {Object} options - Retry options
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether interaction was successful
 */
async function retryElementInteraction(page, selector, interactionFn, options = {}, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  const defaultOptions = {
    maxRetries: config.automation.maxRetries || 3,
    initialDelay: config.automation.retryDelay || 1000,
    onRetry: async (error, attempt, delay) => {
      sendLog(`Interaction with ${selector} failed (attempt ${attempt}): ${error.message}. Retrying in ${Math.round(delay)}ms...`, 'warning');
      
      // Try to recover from common interaction issues
      try {
        if (!page.isClosed()) {
          // Try to make the element visible if it might be hidden
          await page.evaluate((sel) => {
            const element = document.querySelector(sel);
            if (element) {
              // Scroll element into view
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              // Try to make it visible if it's hidden
              if (getComputedStyle(element).display === 'none') {
                element.style.display = 'block';
              }
              if (getComputedStyle(element).visibility === 'hidden') {
                element.style.visibility = 'visible';
              }
              if (parseFloat(getComputedStyle(element).opacity) === 0) {
                element.style.opacity = '1';
              }
            }
          }, selector).catch(() => {});
          
          // Wait a moment for any animations or visibility changes
          await page.waitForTimeout(500);
        }
      } catch (recoveryError) {
        logger.error('Error during interaction recovery:', recoveryError);
      }
    },
    shouldRetry: (error) => {
      // Retry on common interaction errors
      return error.message.includes('not visible') ||
             error.message.includes('not attached') ||
             error.message.includes('Element is not clickable') ||
             error.message.includes('timeout') ||
             error.message.includes('detached');
    }
  };
  
  const mergedOptions = { ...defaultOptions, ...options };
  
  try {
    await withRetry(async () => {
      // First ensure the element exists
      await page.waitForSelector(selector, { state: 'attached', timeout: 5000 });
      
      // Then perform the interaction
      return await interactionFn();
    }, mergedOptions);
    
    return true;
  } catch (error) {
    sendLog(`Interaction with ${selector} failed after ${mergedOptions.maxRetries} retries: ${error.message}`, 'error');
    
    // Try alternative selectors if provided
    if (options.alternativeSelectors && options.alternativeSelectors.length > 0) {
      sendLog(`Trying alternative selectors for ${selector}`, 'info');
      
      for (const altSelector of options.alternativeSelectors) {
        try {
          sendLog(`Trying alternative selector: ${altSelector}`, 'info');
          
          // Check if the alternative selector exists
          const elementExists = await page.$(altSelector);
          if (elementExists) {
            // Try the interaction with this selector
            await page.waitForSelector(altSelector, { state: 'attached', timeout: 5000 });
            await interactionFn(altSelector);
            
            sendLog(`Successfully interacted with alternative selector: ${altSelector}`, 'success');
            return true;
          }
        } catch (altError) {
          logger.error(`Alternative selector ${altSelector} also failed:`, altError);
        }
      }
    }
    
    return false;
  }
}

/**
 * Safely execute a function with proper cleanup
 * @param {Function} fn - Function to execute
 * @param {Function} cleanup - Cleanup function
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<any>} - Result of the function
 */
async function withCleanup(fn, cleanup, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  try {
    return await fn();
  } catch (error) {
    sendLog(`Error: ${error.message}`, 'error');
    throw error;
  } finally {
    try {
      await cleanup();
    } catch (cleanupError) {
      logger.error('Error during cleanup:', cleanupError);
      if (logCallback) logCallback(`Warning: Cleanup failed: ${cleanupError.message}`, 'warning');
    }
  }
}

/**
 * Attempt to recover from a failed operation with multiple strategies
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} strategies - Recovery strategies
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether recovery was successful
 */
async function attemptRecovery(page, strategies = {}, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  const {
    refresh = true,
    goBack = true,
    checkSession = true,
    checkErrors = true,
    waitAndRetry = true
  } = strategies;
  
  sendLog('Attempting to recover from error...', 'warning');
  
  try {
    // Check for error messages on the page
    if (checkErrors) {
      const errorMessages = await page.evaluate(() => {
        const errorElements = document.querySelectorAll('.error, .alert, .notification, [role="alert"]');
        return Array.from(errorElements).map(el => el.textContent.trim());
      }).catch(() => []);
      
      if (errorMessages.length > 0) {
        sendLog(`Found error messages on page: ${errorMessages.join(', ')}`, 'warning');
      }
    }
    
    // Try refreshing the page
    if (refresh) {
      sendLog('Attempting recovery by refreshing the page...', 'info');
      await page.reload({ timeout: 30000 }).catch(e => logger.error('Error refreshing page:', e));
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      // Check if page looks better after refresh
      const stillHasErrors = await page.evaluate(() => {
        return document.querySelectorAll('.error, .alert, .notification, [role="alert"]').length > 0;
      }).catch(() => true);
      
      if (!stillHasErrors) {
        sendLog('Page refresh appears to have resolved the issue', 'success');
        return true;
      }
    }
    
    // Try going back
    if (goBack) {
      sendLog('Attempting recovery by navigating back...', 'info');
      await page.goBack({ timeout: 30000 }).catch(e => logger.error('Error going back:', e));
      await page.waitForLoadState('domcontentloaded').catch(() => {});
      
      // Check if we're on a different page now
      const currentUrl = await page.url().catch(() => '');
      if (currentUrl && !currentUrl.includes('error')) {
        sendLog('Navigation back appears to have resolved the issue', 'success');
        return true;
      }
    }
    
    // Check if session is still valid
    if (checkSession) {
      sendLog('Checking if session is still valid...', 'info');
      
      // Look for login indicators
      const needsLogin = await page.evaluate(() => {
        return document.querySelector('input[type="password"]') !== null ||
               document.querySelector('form[action*="login"]') !== null ||
               document.title.toLowerCase().includes('login') ||
               document.body.innerText.toLowerCase().includes('session expired') ||
               document.body.innerText.toLowerCase().includes('please log in');
      }).catch(() => false);
      
      if (needsLogin) {
        sendLog('Session appears to have expired, need to log in again', 'warning');
        return false; // Signal that we need to restart from login
      }
    }
    
    // Wait and retry as a last resort
    if (waitAndRetry) {
      sendLog('Waiting before final retry attempt...', 'info');
      await page.waitForTimeout(5000);
      
      // Try to click any "retry" or "continue" buttons
      const retryButtons = [
        'button:has-text("Retry")',
        'button:has-text("Try Again")',
        'button:has-text("Continue")',
        'a:has-text("Retry")',
        'a:has-text("Try Again")',
        'a:has-text("Continue")'
      ];
      
      for (const buttonSelector of retryButtons) {
        const button = await page.$(buttonSelector);
        if (button) {
          sendLog(`Found "${buttonSelector}" button, clicking it...`, 'info');
          await button.click().catch(e => logger.error(`Error clicking ${buttonSelector}:`, e));
          await page.waitForLoadState('domcontentloaded').catch(() => {});
          
          // Check if page looks better after clicking
          const stillHasErrors = await page.evaluate(() => {
            return document.querySelectorAll('.error, .alert, .notification, [role="alert"]').length > 0;
          }).catch(() => true);
          
          if (!stillHasErrors) {
            sendLog('Clicking retry button appears to have resolved the issue', 'success');
            return true;
          }
        }
      }
    }
    
    sendLog('Recovery attempts were unsuccessful', 'error');
    return false;
  } catch (error) {
    logger.error('Error during recovery attempt:', error);
    sendLog(`Error during recovery attempt: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Create a circuit breaker to prevent repeated failures
 * @param {Object} options - Circuit breaker options
 * @returns {Object} - Circuit breaker object
 */
function createCircuitBreaker(options = {}) {
  const {
    maxFailures = 5,
    resetTimeout = 60000,
    onOpen = () => {},
    onClose = () => {},
    onHalfOpen = () => {}
  } = options;
  
  let failures = 0;
  let state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
  let resetTimer = null;
  
  return {
    /**
     * Execute a function through the circuit breaker
     * @param {Function} fn - Function to execute
     * @returns {Promise<any>} - Result of the function
     */
    async execute(fn) {
      if (state === 'OPEN') {
        throw new Error('Circuit breaker is OPEN');
      }
      
      try {
        const result = await fn();
        
        // Success - reset failure count and close circuit if in HALF_OPEN
        if (state === 'HALF_OPEN') {
          state = 'CLOSED';
          failures = 0;
          onClose();
          logger.info('Circuit breaker closed after successful execution in HALF_OPEN state');
        } else if (state === 'CLOSED') {
          failures = 0; // Reset failures on success
        }
        
        return result;
      } catch (error) {
        // Handle failure
        if (state === 'CLOSED') {
          failures++;
          logger.warn(`Circuit breaker failure count: ${failures}/${maxFailures}`);
          
          if (failures >= maxFailures) {
            state = 'OPEN';
            resetTimer = setTimeout(() => {
              state = 'HALF_OPEN';
              onHalfOpen();
              logger.info('Circuit breaker state changed to HALF_OPEN');
            }, resetTimeout);
            
            onOpen();
            logger.error(`Circuit breaker OPEN after ${failures} consecutive failures`);
          }
        } else if (state === 'HALF_OPEN') {
          state = 'OPEN';
          resetTimer = setTimeout(() => {
            state = 'HALF_OPEN';
            onHalfOpen();
            logger.info('Circuit breaker state changed to HALF_OPEN');
          }, resetTimeout);
          
          onOpen();
          logger.error('Circuit breaker OPEN after failure in HALF_OPEN state');
        }
        
        throw error;
      }
    },
    
    /**
     * Get the current state of the circuit breaker
     * @returns {string} - Current state (CLOSED, OPEN, HALF_OPEN)
     */
    getState() {
      return state;
    },
    
    /**
     * Reset the circuit breaker to CLOSED state
     */
    reset() {
      state = 'CLOSED';
      failures = 0;
      if (resetTimer) {
        clearTimeout(resetTimer);
        resetTimer = null;
      }
      logger.info('Circuit breaker manually reset to CLOSED state');
    }
  };
}

module.exports = {
  withRetry,
  retryNavigation,
  retryElementInteraction,
  withCleanup,
  attemptRecovery,
  createCircuitBreaker
};