/**
 * Utility functions for anti-bot detection measures in LMS automation
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
  defaultMeta: { service: 'anti-bot-detection' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/anti-bot-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/anti-bot-combined.log` 
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
 * Apply stealth measures to a browser context
 * @param {import('playwright').BrowserContext} context - Playwright browser context
 * @returns {Promise<void>}
 */
async function applyStealthMeasures(context) {
  try {
    logger.info('Applying stealth measures to browser context');
    
    // Override navigator.webdriver property
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { 
        get: () => undefined 
      });
      
      // Override other automation-related properties
      const originalHasFocus = document.hasFocus;
      document.hasFocus = function() {
        return true;
      };
      
      // Override permissions
      const originalPermissions = navigator.permissions;
      if (originalPermissions) {
        navigator.permissions.query = function(parameters) {
          if (parameters.name === 'notifications' || 
              parameters.name === 'midi' || 
              parameters.name === 'camera' || 
              parameters.name === 'microphone' || 
              parameters.name === 'geolocation') {
            return Promise.resolve({ state: 'granted' });
          }
          return originalPermissions.query(parameters);
        };
      }
      
      // Mask plugins
      if (navigator.plugins) {
        Object.defineProperty(navigator, 'plugins', {
          get: () => {
            const plugins = [];
            for (let i = 0; i < 3; i++) {
              plugins.push({
                name: `Plugin ${i}`,
                description: `Plugin ${i} Description`,
                filename: `plugin${i}.dll`,
                length: 1
              });
            }
            return plugins;
          }
        });
      }
      
      // Mask platform
      if (navigator.platform) {
        Object.defineProperty(navigator, 'platform', {
          get: () => {
            return 'Win32';
          }
        });
      }
    });
    
    // Set a realistic user agent if not already set
    const userAgent = await context.evaluate(() => navigator.userAgent);
    if (userAgent.includes('HeadlessChrome')) {
      await context.setExtraHTTPHeaders({
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      });
      logger.info('Set realistic user agent to replace HeadlessChrome');
    }
    
    logger.info('Stealth measures applied successfully');
  } catch (error) {
    logger.error('Error applying stealth measures:', error);
    // Don't throw - we can continue even if stealth measures fail
  }
}

/**
 * Generate a random delay within a range
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {number} - Random delay in milliseconds
 */
function getRandomDelay(min = 50, max = 200) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Type text with human-like delays
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @param {string} text - Text to type
 * @returns {Promise<void>}
 */
async function humanLikeType(page, selector, text) {
  try {
    logger.info(`Human-like typing into ${selector}`);
    
    // Click the element first
    await page.click(selector);
    
    // Clear existing text if any
    await page.fill(selector, '');
    
    // Type with random delays between keystrokes
    for (const char of text) {
      await page.type(selector, char, { delay: getRandomDelay(50, 150) });
      
      // Occasionally pause for a longer time (simulating thinking)
      if (Math.random() < 0.1) {
        await page.waitForTimeout(getRandomDelay(300, 800));
      }
    }
    
    // Occasionally pause before pressing Enter/Tab (if needed)
    if (Math.random() < 0.3) {
      await page.waitForTimeout(getRandomDelay(300, 1000));
    }
  } catch (error) {
    logger.error(`Error during human-like typing into ${selector}:`, error);
    // Fall back to regular typing
    await page.fill(selector, text);
  }
}

/**
 * Perform human-like scrolling
 * @param {import('playwright').Page} page - Playwright page object
 * @param {number} distance - Scroll distance in pixels (positive for down, negative for up)
 * @param {number} steps - Number of steps to break the scroll into
 * @returns {Promise<void>}
 */
async function humanLikeScroll(page, distance = 500, steps = 8) {
  try {
    logger.debug(`Performing human-like scroll of ${distance}px`);
    
    // Break the scrolling into steps with varying speeds
    const stepSize = distance / steps;
    
    for (let i = 0; i < steps; i++) {
      // Randomize each step slightly
      const currentStep = stepSize * (1 + (Math.random() * 0.4 - 0.2)); // +/- 20%
      
      await page.evaluate((scrollAmount) => {
        window.scrollBy(0, scrollAmount);
      }, currentStep);
      
      // Random delay between scroll steps
      await page.waitForTimeout(getRandomDelay(50, 200));
    }
    
    // Occasionally add a small adjustment scroll (like a human would)
    if (Math.random() < 0.3) {
      await page.waitForTimeout(getRandomDelay(200, 500));
      
      await page.evaluate(() => {
        window.scrollBy(0, Math.random() * 40 - 20); // +/- 20px
      });
    }
  } catch (error) {
    logger.error('Error during human-like scrolling:', error);
    // Fall back to regular scrolling
    await page.evaluate((dist) => {
      window.scrollBy(0, dist);
    }, distance);
  }
}

/**
 * Move mouse in a human-like pattern
 * @param {import('playwright').Page} page - Playwright page object
 * @param {number} targetX - Target X coordinate
 * @param {number} targetY - Target Y coordinate
 * @param {number} steps - Number of steps for the movement
 * @returns {Promise<void>}
 */
async function humanLikeMouseMove(page, targetX, targetY, steps = 10) {
  try {
    logger.debug(`Moving mouse to (${targetX}, ${targetY}) in a human-like pattern`);
    
    // Get current mouse position or use a default starting point
    let currentX, currentY;
    try {
      const position = await page.evaluate(() => {
        return { x: mouseX || 0, y: mouseY || 0 };
      });
      currentX = position.x;
      currentY = position.y;
    } catch {
      // If we can't get the current position, use viewport center
      const viewportSize = await page.viewportSize();
      currentX = viewportSize.width / 2;
      currentY = viewportSize.height / 2;
    }
    
    // Generate a slightly curved path with some randomness
    for (let i = 1; i <= steps; i++) {
      // Calculate the next point with a slight curve
      const ratio = i / steps;
      const xOffset = (targetX - currentX) * ratio;
      const yOffset = (targetY - currentY) * ratio;
      
      // Add some randomness to the path (more in the middle, less at start/end)
      const randomFactor = Math.sin(ratio * Math.PI) * 0.1; // Max 10% deviation
      const randomX = currentX + xOffset + (targetX - currentX) * randomFactor * (Math.random() * 2 - 1);
      const randomY = currentY + yOffset + (targetY - currentY) * randomFactor * (Math.random() * 2 - 1);
      
      // Move to this point
      await page.mouse.move(randomX, randomY);
      
      // Random delay between movements
      await page.waitForTimeout(getRandomDelay(10, 30));
    }
    
    // Ensure we end exactly at the target
    await page.mouse.move(targetX, targetY);
  } catch (error) {
    logger.error(`Error during human-like mouse movement to (${targetX}, ${targetY}):`, error);
    // Fall back to direct movement
    await page.mouse.move(targetX, targetY);
  }
}

/**
 * Click an element in a human-like way
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} selector - Element selector
 * @returns {Promise<boolean>} - Whether the click was successful
 */
async function humanLikeClick(page, selector) {
  try {
    logger.info(`Performing human-like click on ${selector}`);
    
    // Wait for the element to be visible
    await page.waitForSelector(selector, { state: 'visible', timeout: 5000 });
    
    // Get element position and dimensions
    const boundingBox = await page.locator(selector).boundingBox();
    if (!boundingBox) {
      logger.warn(`Element ${selector} has no bounding box, falling back to regular click`);
      await page.click(selector);
      return true;
    }
    
    // Calculate a random point within the element (slightly biased toward the center)
    const centerX = boundingBox.x + boundingBox.width / 2;
    const centerY = boundingBox.y + boundingBox.height / 2;
    
    // Add some randomness, but keep it mostly in the center area
    const randomX = centerX + (Math.random() * 0.6 - 0.3) * boundingBox.width;
    const randomY = centerY + (Math.random() * 0.6 - 0.3) * boundingBox.height;
    
    // Move mouse to the element in a human-like way
    await humanLikeMouseMove(page, randomX, randomY);
    
    // Occasionally pause before clicking (as if reading or thinking)
    if (Math.random() < 0.3) {
      await page.waitForTimeout(getRandomDelay(300, 1000));
    }
    
    // Click the element
    await page.mouse.click(randomX, randomY);
    
    // Occasionally pause after clicking
    if (Math.random() < 0.2) {
      await page.waitForTimeout(getRandomDelay(200, 800));
    }
    
    return true;
  } catch (error) {
    logger.error(`Error during human-like click on ${selector}:`, error);
    
    // Try regular click as fallback
    try {
      await page.click(selector);
      return true;
    } catch (fallbackError) {
      logger.error(`Fallback click also failed on ${selector}:`, fallbackError);
      return false;
    }
  }
}

/**
 * Simulate natural browsing behavior
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function simulateNaturalBrowsing(page) {
  try {
    logger.info('Simulating natural browsing behavior');
    
    // Get viewport size
    const viewportSize = await page.viewportSize();
    if (!viewportSize) return;
    
    // Random scrolling
    const scrollDistance = Math.floor(Math.random() * 500) + 100;
    await humanLikeScroll(page, scrollDistance);
    
    // Random mouse movements
    const randomX = Math.floor(Math.random() * (viewportSize.width * 0.8)) + (viewportSize.width * 0.1);
    const randomY = Math.floor(Math.random() * (viewportSize.height * 0.8)) + (viewportSize.height * 0.1);
    await humanLikeMouseMove(page, randomX, randomY);
    
    // Occasionally hover over a link or button
    if (Math.random() < 0.3) {
      const interactiveElements = await page.$$('a, button, input, select');
      if (interactiveElements.length > 0) {
        const randomElement = interactiveElements[Math.floor(Math.random() * interactiveElements.length)];
        const boundingBox = await randomElement.boundingBox();
        
        if (boundingBox) {
          await humanLikeMouseMove(
            page, 
            boundingBox.x + boundingBox.width / 2, 
            boundingBox.y + boundingBox.height / 2
          );
          
          // Pause as if reading
          await page.waitForTimeout(getRandomDelay(500, 2000));
        }
      }
    }
  } catch (error) {
    logger.error('Error simulating natural browsing behavior:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Handle CAPTCHA if detected
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether CAPTCHA was handled successfully
 */
async function handleCaptcha(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    // Check for common CAPTCHA indicators
    const captchaIndicators = [
      'iframe[src*="recaptcha"]',
      'iframe[src*="captcha"]',
      '.g-recaptcha',
      '.h-captcha',
      '.captcha',
      'img[alt*="captcha" i]',
      'div[class*="captcha" i]',
      'div[id*="captcha" i]',
      'input[name*="captcha" i]'
    ];
    
    let captchaDetected = false;
    
    for (const indicator of captchaIndicators) {
      const hasIndicator = await page.$(indicator);
      if (hasIndicator) {
        captchaDetected = true;
        sendLog(`CAPTCHA detected (${indicator})`, 'warning');
        break;
      }
    }
    
    // Also check for text mentioning CAPTCHA or verification
    if (!captchaDetected) {
      const pageText = await page.evaluate(() => document.body.innerText);
      const captchaTextIndicators = [
        'captcha',
        'verify you are human',
        'prove you are human',
        'robot check',
        'bot check',
        'security check',
        'verification required'
      ];
      
      for (const textIndicator of captchaTextIndicators) {
        if (pageText.toLowerCase().includes(textIndicator)) {
          captchaDetected = true;
          sendLog(`CAPTCHA or verification text detected: "${textIndicator}"`, 'warning');
          break;
        }
      }
    }
    
    if (!captchaDetected) {
      return false; // No CAPTCHA detected
    }
    
    // Try to handle simple checkbox reCAPTCHA
    const recaptchaCheckbox = await page.$('.recaptcha-checkbox');
    if (recaptchaCheckbox) {
      sendLog('Attempting to solve checkbox reCAPTCHA...', 'info');
      
      // Switch to the reCAPTCHA iframe if needed
      const recaptchaFrame = await page.$('iframe[src*="recaptcha"]');
      if (recaptchaFrame) {
        const frame = await recaptchaFrame.contentFrame();
        if (frame) {
          await frame.click('.recaptcha-checkbox');
          
          // Wait to see if it was successful
          await page.waitForTimeout(2000);
          
          // Check if the checkbox is now checked
          const isChecked = await frame.evaluate(() => {
            const checkbox = document.querySelector('.recaptcha-checkbox');
            return checkbox && checkbox.getAttribute('aria-checked') === 'true';
          });
          
          if (isChecked) {
            sendLog('Successfully solved checkbox reCAPTCHA', 'success');
            return true;
          }
        }
      } else {
        // Try clicking directly
        await humanLikeClick(page, '.recaptcha-checkbox');
        await page.waitForTimeout(2000);
      }
    }
    
    // For more complex CAPTCHAs, we need to alert the user
    sendLog('Complex CAPTCHA detected that requires human intervention', 'error');
    sendLog('Please solve the CAPTCHA manually and then resume the automation', 'error');
    
    // Take a screenshot of the CAPTCHA
    const screenshotPath = `../artifacts/screenshots/captcha-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    sendLog(`CAPTCHA screenshot saved to ${screenshotPath}`, 'info');
    
    // In a production system, you might integrate with a CAPTCHA solving service here
    // or implement a way for a human operator to solve it
    
    return false; // We couldn't automatically solve it
  } catch (error) {
    logger.error('Error handling CAPTCHA:', error);
    if (logCallback) logCallback(`Error handling CAPTCHA: ${error.message}`, 'error');
    return false;
  }
}

module.exports = {
  applyStealthMeasures,
  humanLikeType,
  humanLikeScroll,
  humanLikeMouseMove,
  humanLikeClick,
  simulateNaturalBrowsing,
  handleCaptcha,
  getRandomDelay
};