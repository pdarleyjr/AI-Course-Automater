/**
 * Enhanced stealth utilities for avoiding bot detection in Target Solutions automation
 */
const { chromium } = require('@playwright/test');
const winston = require('winston');
const config = require('../config/default');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'enhanced-stealth' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/stealth-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/stealth-combined.log` 
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
 * Apply stealth mode to a browser context
 * @param {import('playwright').BrowserContext} context - Playwright browser context
 * @returns {Promise<void>}
 */
async function applyStealth(context) {
  try {
    logger.info('Applying stealth mode to browser context');
    
    // Override navigator properties to appear more like a real browser
    await context.addInitScript(() => {
      // Override webdriver property
      Object.defineProperty(navigator, 'webdriver', {
        get: () => false,
        configurable: true
      });
      
      // Override plugins to include some standard ones
      Object.defineProperty(navigator, 'plugins', {
        get: () => {
          return {
            length: 3,
            item: () => null,
            namedItem: () => null,
            refresh: () => {}
          };
        },
        configurable: true
      });
      
      // Override languages
      Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
        configurable: true
      });
      
      // Override permissions
      if (navigator.permissions) {
        const originalQuery = navigator.permissions.query;
        navigator.permissions.query = (parameters) => 
          parameters.name === 'notifications' 
            ? Promise.resolve({ state: 'prompt' }) 
            : originalQuery(parameters);
      }
    });
    
    logger.info('Stealth mode applied successfully');
  } catch (error) {
    logger.error('Error applying stealth mode:', error);
  }
}

/**
 * Generate a random delay within a range
 * @param {number} minMs - Minimum delay in milliseconds
 * @param {number} maxMs - Maximum delay in milliseconds
 * @returns {number} - Random delay in milliseconds
 */
function getRandomDelay(minMs = 500, maxMs = 2000) {
  // Ensure parameters are valid
  minMs = Math.max(0, minMs);
  maxMs = Math.max(minMs, maxMs);
  
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

/**
 * Create a browser context with anti-bot detection measures
 * @param {Object} options - Browser launch options
 * @returns {Promise<Object>} - Browser and context objects
 */
async function createStealthBrowser(options = {}) {
  try {
    logger.info('Creating stealth browser');
    
    // Default options
    const defaultOptions = {
      headless: process.env.HEADLESS !== 'false',
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials'
      ]
    };
    
    // Merge with provided options
    const mergedOptions = { ...defaultOptions, ...options };
    
    // Launch browser
    const browser = await chromium.launch(mergedOptions);
    
    // Create context with specific options to avoid detection
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 720 },
      hasTouch: false
    });
    
    // Apply stealth mode
    await applyStealth(context);
    
    return { browser, context };
  } catch (error) {
    logger.error('Error creating stealth browser:', error);
    throw error;
  }
}

/**
 * Simulate human-like typing with variable speed
 * @param {import('playwright').Locator} locator - Playwright locator for the input element
 * @param {string} text - Text to type
 * @param {Object} options - Options for typing
 * @returns {Promise<void>}
 */
async function humanLikeType(locator, text, options = {}) {
  try {
    // Default options
    options = {
      clearFirst: true,
      clickFirst: true,
      delayAfter: true,
      ...options
    };
    
    // Clear the field first if requested
    if (options.clearFirst) {
      await locator.clear();
      
      // Add a small delay after clearing
      await new Promise(r => setTimeout(r, getRandomDelay(100, 300)));
    }
    
    // Click the field first to ensure focus
    if (options.clickFirst) {
      await locator.click();
    }
    
    // Type the text character by character with variable delays
    for (const char of text) {
      // Random delay between keystrokes
      await locator.press(char);
      await new Promise(r => setTimeout(r, getRandomDelay(50, 150)));
    }
    
    // Add a small delay after typing
    if (options.delayAfter) {
      await new Promise(r => setTimeout(r, getRandomDelay(200, 500)));
    }
  } catch (error) {
    logger.error('Error during human-like typing:', error);
    // Fall back to regular typing
    await locator.fill(text);
  }
}

/**
 * Simulate human-like clicking with variable positioning
 * @param {import('playwright').Locator} locator - Playwright locator for the element
 * @param {Object} options - Options for the click
 * @returns {Promise<void>}
 */
async function humanLikeClick(locator, options = {}) {
  try {
    // Get the bounding box of the element
    const box = await locator.boundingBox();
    if (!box) {
      // Fall back to regular click if we can't get the bounding box
      await locator.click(options);
      return;
    }
    
    // Calculate a random position within the element, slightly favoring the center
    const x = box.x + box.width * (0.4 + Math.random() * 0.2);
    const y = box.y + box.height * (0.4 + Math.random() * 0.2);
    
    // Get the page from the locator
    const page = await locator.page();
    
    // Move the mouse to the element with a human-like curve
    await page.mouse.move(
      page.viewportSize().width / 2,
      page.viewportSize().height / 2,
      { steps: 5 }
    );
    
    await page.mouse.move(x, y, { steps: 10 });
    
    // Small delay before clicking
    await new Promise(r => setTimeout(r, getRandomDelay(50, 150)));
    
    // Click
    await page.mouse.click(x, y);
    
    // Small delay after clicking
    await new Promise(r => setTimeout(r, getRandomDelay(100, 300)));
  } catch (error) {
    logger.error('Error during human-like clicking:', error);
    // Fall back to regular clicking
    await locator.click(options);
  }
}

/**
 * Simulate human-like scrolling
 * @param {import('playwright').Page} page - Playwright page
 * @param {number} distance - Scroll distance in pixels
 * @param {Object} options - Scrolling options
 * @returns {Promise<void>}
 */
async function humanLikeScroll(page, distance, options = {}) {
  try {
    // Default options
    const { smooth = true, steps = 10, delay = 20 } = options;
    
    if (smooth && steps > 1) {
      // Smooth scrolling in steps
      const stepSize = Math.floor(distance / steps);
      for (let i = 0; i < steps; i++) {
        await page.evaluate(step => window.scrollBy(0, step), stepSize);
        await new Promise(r => setTimeout(r, delay));
      }
    } else {
      // Single scroll
      await page.evaluate(dist => window.scrollBy(0, dist), distance);
    }
  } catch (error) {
    logger.error('Error during human-like scrolling:', error);
    // Fall back to regular scrolling
    await page.evaluate(dist => window.scrollBy(0, dist), distance);
  }
}

/**
 * Apply Target Solutions specific anti-detection measures
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function applyTargetSolutionsAntiDetection(page) {
  try {
    logger.info('Applying Target Solutions specific anti-detection measures');
    
    // Add additional scripts to evade Target Solutions specific detection
    await page.addInitScript(() => {
      // Override document.hidden to always return false
      Object.defineProperty(document, 'hidden', {
        get: () => false,
        configurable: true
      });
      
      // Override document.visibilityState to always return 'visible'
      Object.defineProperty(document, 'visibilityState', {
        get: () => 'visible',
        configurable: true
      });
      
      // Override window.innerWidth and window.innerHeight to match a common resolution
      Object.defineProperty(window, 'innerWidth', {
        get: () => 1280,
        configurable: true
      });
      
      Object.defineProperty(window, 'innerHeight', {
        get: () => 720,
        configurable: true
      });
    });
    
    logger.info('Target Solutions specific anti-detection measures applied successfully');
  } catch (error) {
    logger.error('Error applying Target Solutions anti-detection measures:', error);
  }
}

module.exports = {
  applyStealth,
  getRandomDelay,
  createStealthBrowser,
  humanLikeType,
  humanLikeClick,
  humanLikeScroll,
  applyTargetSolutionsAntiDetection
};