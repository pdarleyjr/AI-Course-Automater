/**
 * Utility functions for extracting course context to improve quiz answers
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
  defaultMeta: { service: 'course-context-extractor' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/context-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/context-combined.log` 
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
 * Extract course information from the page to provide context for quiz answers
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<string>} - Extracted course context
 */
async function extractCourseContext(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Extracting course context for better quiz answers...', 'info');
    
    // Get course title
    const courseTitle = await page.evaluate(() => {
      const titleElement = document.querySelector('.course-title h2');
      return titleElement ? titleElement.textContent.trim() : '';
    });
    
    // Get current page content
    const pageContent = await page.evaluate(() => {
      const contentElement = document.querySelector('#lesson-content');
      return contentElement ? contentElement.textContent.trim() : '';
    });
    
    // Try to get previous pages content from browser storage
    const previousContent = await page.evaluate(() => {
      try {
        return sessionStorage.getItem('courseContent') || '';
      } catch (e) {
        return '';
      }
    });
    
    // Combine all content
    let combinedContent = `Course: ${courseTitle}\n\n`;
    
    if (previousContent) {
      combinedContent += `Previous content:\n${previousContent}\n\n`;
    }
    
    combinedContent += `Current page content:\n${pageContent}`;
    
    // Store current content in browser storage for future questions
    await page.evaluate((content) => {
      try {
        // Get existing content
        let existingContent = sessionStorage.getItem('courseContent') || '';
        
        // Add new content (limit to last 10000 characters to avoid storage limits)
        const combinedContent = existingContent + '\n' + content;
        const trimmedContent = combinedContent.slice(-10000);
        
        sessionStorage.setItem('courseContent', trimmedContent);
      } catch (e) {
        // Ignore storage errors
      }
    }, pageContent);
    
    // Extract key terms and definitions
    const keyTerms = await page.evaluate(() => {
      const terms = [];
      const boldElements = document.querySelectorAll('strong, b, h3, h4, h5, h6');
      
      boldElements.forEach(el => {
        terms.push(el.textContent.trim());
      });
      
      return terms.filter(term => term.length > 0).join('\n');
    });
    
    if (keyTerms) {
      combinedContent += `\n\nKey terms:\n${keyTerms}`;
    }
    
    return combinedContent;
  } catch (error) {
    logger.error('Error extracting course context:', error);
    if (logCallback) logCallback(`Error extracting course context: ${error.message}`, 'error');
    return '';
  }
}

/**
 * Clear stored course content from browser storage
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<void>}
 */
async function clearStoredCourseContent(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Clearing stored course content from browser storage...', 'info');
    
    await page.evaluate(() => {
      try {
        sessionStorage.removeItem('courseContent');
      } catch (e) {
        // Ignore storage errors
      }
    });
    
    sendLog('Course content cleared from browser storage', 'success');
  } catch (error) {
    logger.error('Error clearing course content:', error);
    if (logCallback) logCallback(`Error clearing course content: ${error.message}`, 'error');
  }
}

/**
 * Store important information from the current page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<void>}
 */
async function storePageInformation(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Storing important information from current page...', 'info');
    
    // Get page content
    const pageContent = await page.evaluate(() => {
      const contentElement = document.querySelector('#lesson-content');
      return contentElement ? contentElement.textContent.trim() : '';
    });
    
    if (!pageContent) {
      sendLog('No content found on page to store', 'warning');
      return;
    }
    
    // Store in browser storage
    await page.evaluate((content) => {
      try {
        // Get existing content
        let existingContent = sessionStorage.getItem('courseContent') || '';
        
        // Add new content (limit to last 10000 characters to avoid storage limits)
        const combinedContent = existingContent + '\n' + content;
        const trimmedContent = combinedContent.slice(-10000);
        
        sessionStorage.setItem('courseContent', trimmedContent);
      } catch (e) {
        // Ignore storage errors
      }
    }, pageContent);
    
    sendLog('Page information stored successfully', 'success');
  } catch (error) {
    logger.error('Error storing page information:', error);
    if (logCallback) logCallback(`Error storing page information: ${error.message}`, 'error');
  }
}

module.exports = {
  extractCourseContext,
  clearStoredCourseContent,
  storePageInformation
};