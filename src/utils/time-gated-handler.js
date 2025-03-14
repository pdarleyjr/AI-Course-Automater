/**
 * Utility functions for handling time-gated content in LMS automation
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
  defaultMeta: { service: 'time-gated-handler' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/time-gated-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/time-gated-combined.log` 
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
 * Detect time requirements on a page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Time requirement details
 */
async function detectTimeRequirements(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Checking for time requirements on the page...');

    // Check for common time requirement indicators
    const timeIndicators = [
      { selector: '.timer', attribute: 'textContent' },
      { selector: '.countdown', attribute: 'textContent' },
      { selector: '.time-remaining', attribute: 'textContent' },
      { selector: '.progress-bar[aria-valuenow]', attribute: 'aria-valuenow' },
      { selector: 'progress', attribute: 'value' },
      { selector: '[data-time-required]', attribute: 'data-time-required' },
      { selector: '.time-lock-message', attribute: 'textContent' }
    ];

    let timeRequirement = null;

    for (const indicator of timeIndicators) {
      const element = await page.$(indicator.selector);
      if (element) {
        let value;
        if (indicator.attribute === 'textContent') {
          value = await element.textContent();
        } else {
          value = await element.getAttribute(indicator.attribute);
        }

        // Try to extract time information (minutes/seconds)
        const timeMatch = value.match(/(\d+)\s*(min|minute|second|sec|hour|hr)/i);
        if (timeMatch) {
          const amount = parseInt(timeMatch[1], 10);
          const unit = timeMatch[2].toLowerCase();
          
          let milliseconds = 0;
          if (unit.startsWith('min')) {
            milliseconds = amount * 60 * 1000;
          } else if (unit.startsWith('sec')) {
            milliseconds = amount * 1000;
          } else if (unit.startsWith('hour') || unit === 'hr') {
            milliseconds = amount * 60 * 60 * 1000;
          }

          timeRequirement = {
            detected: true,
            milliseconds,
            text: value,
            source: indicator.selector
          };
          
          sendLog(`Detected time requirement: ${value} (${milliseconds}ms)`, 'info');
          break;
        }
      }
    }

    // If no explicit timer found, check for video elements
    if (!timeRequirement) {
      const videoElement = await page.$('video');
      if (videoElement) {
        // Get video duration
        const duration = await page.evaluate(() => {
          const video = document.querySelector('video');
          return video ? video.duration : 0;
        });

        if (duration > 0) {
          timeRequirement = {
            detected: true,
            milliseconds: Math.ceil(duration * 1000),
            text: `Video (${Math.ceil(duration)} seconds)`,
            source: 'video',
            isVideo: true
          };
          
          sendLog(`Detected video with duration: ${Math.ceil(duration)} seconds`, 'info');
        }
      }
    }

    // If still no time requirement detected, use a default based on content type
    if (!timeRequirement) {
      // Check if this looks like a content page (reading material)
      const contentLength = await page.evaluate(() => {
        const content = document.querySelector('.content, .lesson-content, article, .course-material');
        return content ? content.textContent.length : 0;
      });

      if (contentLength > 0) {
        // Estimate reading time (average reading speed: ~200 words per minute, ~5 characters per word)
        const wordCount = contentLength / 5;
        const readingTimeMinutes = Math.max(1, Math.ceil(wordCount / 200));
        
        timeRequirement = {
          detected: false,
          milliseconds: readingTimeMinutes * 60 * 1000,
          text: `Estimated reading time: ${readingTimeMinutes} minute(s)`,
          source: 'content-length-estimate'
        };
        
        sendLog(`No explicit time requirement found. Estimated reading time: ${readingTimeMinutes} minute(s)`, 'info');
      } else {
        // Default fallback
        timeRequirement = {
          detected: false,
          milliseconds: 30 * 1000, // 30 seconds default
          text: 'Default time requirement',
          source: 'default'
        };
        
        sendLog('No time requirement detected. Using default: 30 seconds', 'info');
      }
    }

    return timeRequirement;
  } catch (error) {
    logger.error('Error detecting time requirements:', error);
    if (logCallback) logCallback(`Error detecting time requirements: ${error.message}`, 'error');
    
    // Return a safe default
    return {
      detected: false,
      milliseconds: 30 * 1000, // 30 seconds default
      text: 'Default time requirement (error occurred)',
      source: 'error-fallback'
    };
  }
}

/**
 * Wait for the required time with periodic updates
 * @param {number} durationMs - Duration to wait in milliseconds
 * @param {Function} logCallback - Callback for sending logs to the client
 * @param {import('playwright').Page} page - Playwright page object for keeping session alive
 * @returns {Promise<void>}
 */
async function waitWithUpdates(durationMs, logCallback = null, page = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    // Randomize the wait time slightly to appear more human-like
    const randomizedDuration = durationMs + (Math.random() * 2000 - 1000); // +/- 1 second
    
    sendLog(`Waiting for ${Math.ceil(randomizedDuration / 1000)} seconds to satisfy time requirement...`);
    
    const startTime = Date.now();
    const updateInterval = 10000; // Update every 10 seconds
    const keepAliveInterval = 60000; // Keep session alive every 60 seconds
    
    let waited = 0;
    
    while (waited < randomizedDuration) {
      // Wait for the next interval
      const nextWait = Math.min(updateInterval, randomizedDuration - waited);
      await new Promise(r => setTimeout(r, nextWait));
      
      waited = Date.now() - startTime;
      const remainingSeconds = Math.max(Math.ceil((randomizedDuration - waited) / 1000), 0);
      
      // Send progress update
      if (remainingSeconds > 0) {
        sendLog(`...waiting ${remainingSeconds}s more for time requirement`, 'info');
      }
      
      // Keep the session alive with a small action if needed
      if (page && waited % keepAliveInterval < updateInterval) {
        await keepSessionAlive(page);
      }
    }
    
    sendLog('Time requirement satisfied!', 'success');
  } catch (error) {
    logger.error('Error during wait period:', error);
    if (logCallback) logCallback(`Error during wait period: ${error.message}`, 'error');
  }
}

/**
 * Keep the session alive with minimal actions
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<void>}
 */
async function keepSessionAlive(page) {
  try {
    // Perform a minimal action to keep the session alive
    // Options:
    // 1. Small scroll
    // 2. Move mouse slightly
    // 3. Focus on an element
    
    const action = Math.floor(Math.random() * 3);
    
    switch (action) {
      case 0:
        // Small scroll
        await page.evaluate(() => {
          window.scrollBy(0, Math.random() * 10 - 5);
        });
        break;
      case 1:
        // Move mouse slightly
        const viewportSize = await page.viewportSize();
        if (viewportSize) {
          await page.mouse.move(
            Math.random() * viewportSize.width * 0.8 + viewportSize.width * 0.1,
            Math.random() * viewportSize.height * 0.8 + viewportSize.height * 0.1
          );
        }
        break;
      case 2:
        // Focus on a random element
        await page.evaluate(() => {
          const elements = document.querySelectorAll('a, button, input');
          if (elements.length > 0) {
            const randomElement = elements[Math.floor(Math.random() * elements.length)];
            randomElement.focus();
          }
        });
        break;
    }
    
    logger.debug('Kept session alive with minimal action');
  } catch (error) {
    logger.error('Error keeping session alive:', error);
    // Don't throw - this is a non-critical operation
  }
}

/**
 * Handle video content on the page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether video was handled successfully
 */
async function handleVideoContent(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    // Check if there's a video on the page
    const hasVideo = await page.evaluate(() => {
      return !!document.querySelector('video');
    });

    if (!hasVideo) {
      return false;
    }

    sendLog('Video content detected. Ensuring playback...', 'info');

    // Try to play the video
    await page.evaluate(() => {
      const video = document.querySelector('video');
      if (video && video.paused) {
        // Try to unmute if muted (some sites require this)
        video.muted = false;
        
        // Try to play
        const playPromise = video.play();
        if (playPromise !== undefined) {
          playPromise.catch(e => {
            // Auto-play may be prevented
            console.error('Error playing video:', e);
            
            // If autoplay is blocked, try with muted (most browsers allow muted autoplay)
            if (e.name === 'NotAllowedError') {
              video.muted = true;
              video.play().catch(e2 => console.error('Error playing muted video:', e2));
            }
          });
        }
      }
    });

    // Check if there's a play button to click
    const playButton = await page.$('button.play-button, .vjs-play-button, .video-play, [aria-label="Play"], .ytp-play-button');
    if (playButton) {
      sendLog('Clicking play button...', 'info');
      await playButton.click();
    }

    // Check if video is playing
    const isPlaying = await page.evaluate(() => {
      const video = document.querySelector('video');
      return video && !video.paused && !video.ended && video.currentTime > 0;
    });

    if (isPlaying) {
      sendLog('Video is now playing', 'success');
      
      // Get video duration
      const duration = await page.evaluate(() => {
        const video = document.querySelector('video');
        return video ? video.duration : 0;
      });
      
      if (duration > 0 && duration !== Infinity) {
        sendLog(`Video duration: ${Math.ceil(duration)} seconds`, 'info');
        
        // Check if we can speed up playback (if allowed)
        if (config.automation.speedUpVideos) {
          await page.evaluate(() => {
            const video = document.querySelector('video');
            if (video) {
              // Set to 1.5x speed if possible
              video.playbackRate = 1.5;
            }
          });
          
          const actualRate = await page.evaluate(() => {
            const video = document.querySelector('video');
            return video ? video.playbackRate : 1;
          });
          
          if (actualRate > 1) {
            sendLog(`Increased video playback speed to ${actualRate}x`, 'info');
          }
        }
        
        // Monitor video progress
        let lastReportedProgress = 0;
        const startTime = Date.now();
        const checkInterval = Math.min(30000, duration * 1000 / 4); // Check at least 4 times during video
        
        while (true) {
          await new Promise(r => setTimeout(r, checkInterval));
          
          const progress = await page.evaluate(() => {
            const video = document.querySelector('video');
            if (!video) return 1; // If video element disappeared, consider it complete
            
            if (video.ended) return 1;
            return video.currentTime / video.duration;
          });
          
          // If progress is significantly different from last report, log it
          if (Math.abs(progress - lastReportedProgress) > 0.2) {
            sendLog(`Video progress: ${Math.round(progress * 100)}%`, 'info');
            lastReportedProgress = progress;
          }
          
          // Check if video has ended or if we've waited longer than the video duration
          if (progress >= 0.99 || Date.now() - startTime > duration * 1000 * 1.1) {
            sendLog('Video playback completed', 'success');
            break;
          }
          
          // Keep session alive
          await keepSessionAlive(page);
        }
      } else {
        // For videos with unknown duration, wait for a reasonable time
        sendLog('Video has unknown duration. Waiting for 2 minutes...', 'info');
        await waitWithUpdates(120000, logCallback, page);
      }
      
      return true;
    } else {
      sendLog('Unable to play video automatically. Waiting for default time...', 'warning');
      await waitWithUpdates(60000, logCallback, page); // Wait for 1 minute as fallback
      return false;
    }
  } catch (error) {
    logger.error('Error handling video content:', error);
    if (logCallback) logCallback(`Error handling video content: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Check if a "Next" button or similar is enabled
 * @param {import('playwright').Page} page - Playwright page object
 * @returns {Promise<boolean>} - Whether the next button is enabled
 */
async function isNextButtonEnabled(page) {
  try {
    // Common selectors for "Next" buttons
    const nextButtonSelectors = [
      'button:has-text("Next")',
      'a:has-text("Next")',
      '.next-button',
      '.btn-next',
      '[aria-label="Next"]',
      '.pagination-next',
      'button:has-text("Continue")',
      'a:has-text("Continue")'
    ];
    
    for (const selector of nextButtonSelectors) {
      const button = await page.$(selector);
      if (button) {
        // Check if the button is enabled
        const isDisabled = await button.evaluate(el => {
          return el.disabled || 
                 el.getAttribute('aria-disabled') === 'true' || 
                 el.classList.contains('disabled') ||
                 getComputedStyle(el).opacity < 0.5;
        });
        
        return !isDisabled;
      }
    }
    
    return false; // No next button found
  } catch (error) {
    logger.error('Error checking next button state:', error);
    return false; // Assume not enabled on error
  }
}

/**
 * Wait until the "Next" button becomes enabled
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @param {number} timeoutMs - Maximum time to wait in milliseconds
 * @returns {Promise<boolean>} - Whether the button became enabled within the timeout
 */
async function waitForNextButtonEnabled(page, logCallback = null, timeoutMs = 300000) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Waiting for "Next" button to become enabled...', 'info');
    
    const startTime = Date.now();
    const checkInterval = 10000; // Check every 10 seconds
    
    while (Date.now() - startTime < timeoutMs) {
      if (await isNextButtonEnabled(page)) {
        sendLog('"Next" button is now enabled!', 'success');
        return true;
      }
      
      // Keep session alive and wait
      await keepSessionAlive(page);
      await new Promise(r => setTimeout(r, checkInterval));
      
      // Log progress periodically
      if ((Date.now() - startTime) % 60000 < checkInterval) {
        const minutesWaited = Math.floor((Date.now() - startTime) / 60000);
        sendLog(`Still waiting for "Next" button to become enabled (${minutesWaited} minute(s) elapsed)...`, 'info');
      }
    }
    
    sendLog('Timed out waiting for "Next" button to become enabled', 'warning');
    return false;
  } catch (error) {
    logger.error('Error waiting for next button:', error);
    if (logCallback) logCallback(`Error waiting for "Next" button: ${error.message}`, 'error');
    return false;
  }
}

module.exports = {
  detectTimeRequirements,
  waitWithUpdates,
  keepSessionAlive,
  handleVideoContent,
  isNextButtonEnabled,
  waitForNextButtonEnabled
};