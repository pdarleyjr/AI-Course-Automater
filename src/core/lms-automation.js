/**
 * Core LMS automation functionality with enhanced capabilities
 */
const { chromium } = require('@playwright/test');
const config = require('../config/default');
const langchainUtils = require('../utils/langchain-utils');
const timeGatedHandler = require('../utils/time-gated-handler');
const antiBot = require('../utils/anti-bot-detection');
const retryHandler = require('../utils/retry-handler');
const quizHandler = require('../utils/quiz-handler');
const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'lms-automation' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/lms-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/lms-combined.log` 
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Ensure screenshots directory exists
const screenshotsDir = path.resolve(__dirname, '../../artifacts/screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

/**
 * Login to the LMS with enhanced anti-bot measures
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} credentials - User credentials
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether login was successful
 */
async function loginToLMS(page, credentials, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  try {
    sendLog(`Navigating to LMS: ${config.lms.url}`);
    
    // Use retry navigation for more reliable page loading
    const navSuccess = await retryHandler.retryNavigation(
      page,
      async () => {
        await page.goto(config.lms.url);
      },
      {
        maxRetries: 3,
        initialDelay: 2000
      },
      logCallback
    );
    
    if (!navSuccess) {
      sendLog('Failed to navigate to LMS URL after multiple attempts', 'error');
      return false;
    }
    
    // Wait for login form to be visible
    sendLog('Waiting for login form');
    await page.waitForSelector('input[name="username"]', { timeout: 10000 })
      .catch(async () => {
        // If username field not found, try alternative selectors
        sendLog('Username field not found, trying alternative selectors', 'warning');
        await page.waitForSelector('input[type="text"][id*="user"], input[type="text"][id*="email"], input[type="email"]', { timeout: 5000 });
      });
    
    // Fill in login credentials with human-like typing
    sendLog('Filling login credentials');
    
    // Find username field
    const usernameSelector = await page.evaluate(() => {
      const selectors = [
        'input[name="username"]',
        'input[id*="username"]',
        'input[id*="user"]',
        'input[id*="email"]',
        'input[type="email"]',
        'input[type="text"]:not([id*="password"])'
      ];
      
      for (const selector of selectors) {
        if (document.querySelector(selector)) {
          return selector;
        }
      }
      
      return 'input[name="username"]'; // Default
    });
    
    // Find password field
    const passwordSelector = await page.evaluate(() => {
      const selectors = [
        'input[name="password"]',
        'input[id*="password"]',
        'input[type="password"]'
      ];
      
      for (const selector of selectors) {
        if (document.querySelector(selector)) {
          return selector;
        }
      }
      
      return 'input[name="password"]'; // Default
    });
    
    // Use human-like typing for username and password
    await antiBot.humanLikeType(page, usernameSelector, credentials.username || config.lms.username);
    await antiBot.humanLikeType(page, passwordSelector, credentials.password || config.lms.password);
    
    // Find and click login button
    sendLog('Submitting login form');
    
    // Find login button
    const loginButtonSelector = await page.evaluate(() => {
      const selectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Sign In")',
        'button:has-text("Log In")',
        'a:has-text("Login")',
        'a:has-text("Sign In")',
        'a:has-text("Log In")',
        '.login-button',
        '.signin-button',
        '#login-button',
        '#signin-button'
      ];
      
      for (const selector of selectors) {
        const element = document.querySelector(selector);
        if (element && element.offsetParent !== null) { // Check if visible
          return selector;
        }
      }
      
      return 'button[type="submit"]'; // Default
    });
    
    // Use human-like clicking
    await antiBot.humanLikeClick(page, loginButtonSelector);
    
    // Wait for dashboard to load with retry
    sendLog('Waiting for dashboard to load');
    
    // Try multiple dashboard indicators
    const dashboardSelectors = [
      '.dashboard',
      '.home-page',
      '.course-list',
      '.my-courses',
      'a:has-text("My Courses")',
      'a:has-text("Dashboard")',
      '.user-dashboard',
      '.welcome-message'
    ];
    
    let dashboardLoaded = false;
    
    for (const selector of dashboardSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        dashboardLoaded = true;
        sendLog(`Dashboard loaded (detected ${selector})`, 'success');
        break;
      } catch (err) {
        // Continue to next selector
      }
    }
    
    if (!dashboardLoaded) {
      // Check if we're still on the login page (login failed)
      const stillOnLoginPage = await page.evaluate(() => {
        return document.querySelector('input[type="password"]') !== null;
      });
      
      if (stillOnLoginPage) {
        // Check for error messages
        const errorMessage = await page.evaluate(() => {
          const errorElements = document.querySelectorAll('.error, .alert, .notification, [role="alert"]');
          for (const el of errorElements) {
            return el.textContent.trim();
          }
          return null;
        });
        
        if (errorMessage) {
          sendLog(`Login failed: ${errorMessage}`, 'error');
        } else {
          sendLog('Login failed: Still on login page', 'error');
        }
        
        return false;
      }
      
      // If we're not on the login page but didn't detect dashboard, assume success
      sendLog('Dashboard not detected, but no longer on login page. Assuming login successful.', 'warning');
    }
    
    sendLog('Successfully logged in to LMS', 'success');
    
    // Take a screenshot after login
    await page.screenshot({ 
      path: path.join(screenshotsDir, `login-success-${Date.now()}.png`),
      fullPage: true 
    });
    
    return true;
  } catch (error) {
    sendLog(`Failed to login to LMS: ${error.message}`, 'error');
    
    // Take a screenshot of the error
    await page.screenshot({ 
      path: path.join(screenshotsDir, `login-error-${Date.now()}.png`),
      fullPage: true 
    }).catch(() => {});
    
    // Try to recover
    const recovered = await retryHandler.attemptRecovery(page, {
      refresh: true,
      goBack: false,
      checkSession: false
    }, logCallback);
    
    if (recovered) {
      sendLog('Recovered from error, retrying login', 'info');
      return loginToLMS(page, credentials, logCallback);
    }
    
    return false;
  }
}

/**
 * Navigate to a specific course with enhanced reliability
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} courseId - ID of the course to navigate to
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether navigation was successful
 */
async function navigateToCourse(page, courseId, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  try {
    sendLog(`Navigating to course: ${courseId}`);
    
    // Navigate to courses page with retry
    const coursesLinkSelectors = [
      'a[href*="courses"]',
      'a:has-text("Courses")',
      'a:has-text("My Courses")',
      '.courses-link',
      '#courses-link',
      'a[href*="course"]',
      '.nav-courses'
    ];
    
    let coursesLinkClicked = false;
    
    for (const selector of coursesLinkSelectors) {
      const link = await page.$(selector);
      if (link) {
        await retryHandler.retryElementInteraction(
          page,
          selector,
          async () => {
            await antiBot.humanLikeClick(page, selector);
          },
          {
            maxRetries: 2,
            initialDelay: 1000
          },
          logCallback
        );
        
        coursesLinkClicked = true;
        break;
      }
    }
    
    if (!coursesLinkClicked) {
      sendLog('Could not find courses link, trying direct navigation', 'warning');
      
      // Try direct navigation to courses page
      await retryHandler.retryNavigation(
        page,
        async () => {
          await page.goto(`${config.lms.url}/courses`);
        },
        {
          maxRetries: 2,
          initialDelay: 1000
        },
        logCallback
      );
    }
    
    // Wait for course list to load with retry
    const courseListSelectors = [
      '.course-list',
      '.courses-list',
      '.course-catalog',
      '.course-grid',
      '.course-cards',
      'div[class*="course"]'
    ];
    
    let courseListFound = false;
    
    for (const selector of courseListSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        courseListFound = true;
        break;
      } catch (err) {
        // Continue to next selector
      }
    }
    
    if (!courseListFound) {
      sendLog('Course list not found, attempting to continue anyway', 'warning');
    }
    
    // Simulate natural browsing behavior
    await antiBot.simulateNaturalBrowsing(page);
    
    // Click on the specific course with retry
    const courseSelectors = [
      `a[href*="courses/${courseId}"]`,
      `a[href*="course/${courseId}"]`,
      `a[href*="course-${courseId}"]`,
      `a[href*="course_${courseId}"]`,
      `a[href*="course"][href*="${courseId}"]`,
      `a[data-course-id="${courseId}"]`,
      `div[data-course-id="${courseId}"] a`
    ];
    
    let courseClicked = false;
    
    for (const selector of courseSelectors) {
      const courseLink = await page.$(selector);
      if (courseLink) {
        await retryHandler.retryElementInteraction(
          page,
          selector,
          async () => {
            await antiBot.humanLikeClick(page, selector);
          },
          {
            maxRetries: 2,
            initialDelay: 1000
          },
          logCallback
        );
        
        courseClicked = true;
        break;
      }
    }
    
    if (!courseClicked) {
      // Try to find the course by name if ID doesn't work
      sendLog('Could not find course by ID, trying to find by name or content', 'warning');
      
      // Look for course links and check their text content
      const courseLinks = await page.$$('a[href*="course"]');
      for (const link of courseLinks) {
        const linkText = await link.textContent();
        const href = await link.getAttribute('href');
        
        // If the link text or href contains the course ID
        if (linkText.includes(courseId) || (href && href.includes(courseId))) {
          await link.click();
          courseClicked = true;
          break;
        }
      }
      
      if (!courseClicked) {
        sendLog(`Could not find course ${courseId}`, 'error');
        return false;
      }
    }
    
    // Wait for course page to load with retry
    const courseContentSelectors = [
      '.course-content',
      '.course-material',
      '.course-home',
      '.course-dashboard',
      '.course-outline',
      '.course-modules',
      '.course-lessons',
      'div[class*="course-content"]'
    ];
    
    let courseContentFound = false;
    
    for (const selector of courseContentSelectors) {
      try {
        await page.waitForSelector(selector, { timeout: 5000 });
        courseContentFound = true;
        break;
      } catch (err) {
        // Continue to next selector
      }
    }
    
    if (!courseContentFound) {
      sendLog('Course content not found, checking if we are on the correct page', 'warning');
      
      // Check if the page title or content contains the course ID
      const pageContainsCourseId = await page.evaluate((id) => {
        return document.title.includes(id) || 
               document.body.innerText.includes(id) ||
               document.querySelector(`[data-course-id="${id}"]`) !== null;
      }, courseId);
      
      if (!pageContainsCourseId) {
        sendLog(`Could not verify we are on the correct course page for ${courseId}`, 'error');
        return false;
      }
      
      sendLog('Page appears to be related to the requested course, continuing', 'warning');
    }
    
    // Take a screenshot of the course page
    await page.screenshot({ 
      path: path.join(screenshotsDir, `course-${courseId}-${Date.now()}.png`),
      fullPage: true 
    });
    
    sendLog(`Successfully navigated to course: ${courseId}`, 'success');
    return true;
  } catch (error) {
    sendLog(`Failed to navigate to course ${courseId}: ${error.message}`, 'error');
    
    // Take a screenshot of the error
    await page.screenshot({ 
      path: path.join(screenshotsDir, `course-navigation-error-${Date.now()}.png`),
      fullPage: true 
    }).catch(() => {});
    
    // Try to recover
    const recovered = await retryHandler.attemptRecovery(page, {
      refresh: true,
      goBack: true,
      checkSession: true
    }, logCallback);
    
    if (recovered) {
      sendLog('Recovered from error, retrying course navigation', 'info');
      return navigateToCourse(page, courseId, logCallback);
    }
    
    return false;
  }
}

/**
 * Extract and analyze course content using LangChain
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Analyzed course content
 */
async function analyzeCourseWithLangChain(page, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  try {
    sendLog('Extracting course content for LangChain analysis');
    
    // Simulate natural browsing behavior
    await antiBot.simulateNaturalBrowsing(page);
    
    // Get the HTML content of the course page
    const courseContent = await page.content();
    
    // Use LangChain to analyze the content
    const analysis = await langchainUtils.analyzeCourseContent(courseContent);
    
    sendLog('Course analysis complete', { 
      courseTitle: analysis.courseTitle,
      assignmentCount: analysis.assignments ? analysis.assignments.length : 0 
    });
    
    // Log time-gated content if found
    if (analysis.timeGatedContent && analysis.timeGatedContent.length > 0) {
      sendLog(`Found ${analysis.timeGatedContent.length} time-gated items in the course`, 'info');
      
      for (const item of analysis.timeGatedContent) {
        sendLog(`Time-gated item: ${item.title || 'Unnamed'} - Available: ${item.availableDate || 'Unknown'}`, 'info');
      }
    }
    
    return analysis;
  } catch (error) {
    sendLog(`Error analyzing course with LangChain: ${error.message}`, 'error');
    return {
      courseTitle: 'Unknown',
      courseDescription: '',
      assignments: [],
      timeGatedContent: []
    };
  }
}

/**
 * Handle time-gated content on a page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether time requirement was satisfied
 */
async function handleTimeGatedContent(page, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  try {
    sendLog('Checking for time-gated content...');
    
    // Detect time requirements
    const timeRequirement = await timeGatedHandler.detectTimeRequirements(page, logCallback);
    
    if (!timeRequirement.detected) {
      sendLog('No explicit time requirements detected', 'info');
      
      // Check for video content
      const hasVideo = await page.evaluate(() => {
        return !!document.querySelector('video');
      });
      
      if (hasVideo) {
        sendLog('Video content detected, handling playback', 'info');
        const videoHandled = await timeGatedHandler.handleVideoContent(page, logCallback);
        
        if (videoHandled) {
          sendLog('Video content handled successfully', 'success');
          return true;
        }
      }
      
      // If no video and no explicit time requirement, wait a short time
      sendLog('Waiting default time to ensure content is registered as viewed', 'info');
      await timeGatedHandler.waitWithUpdates(timeRequirement.milliseconds, logCallback, page);
      
      return true;
    }
    
    sendLog(`Time requirement detected: ${timeRequirement.text}`, 'info');
    
    // If it's a video, handle it specially
    if (timeRequirement.isVideo) {
      const videoHandled = await timeGatedHandler.handleVideoContent(page, logCallback);
      
      if (videoHandled) {
        sendLog('Video content handled successfully', 'success');
        return true;
      }
    }
    
    // Wait for the required time
    await timeGatedHandler.waitWithUpdates(timeRequirement.milliseconds, logCallback, page);
    
    // Check if "Next" button is now enabled
    const nextEnabled = await timeGatedHandler.isNextButtonEnabled(page);
    
    if (nextEnabled) {
      sendLog('"Next" button is now enabled, time requirement satisfied', 'success');
      return true;
    } else {
      // Wait for "Next" button to become enabled (with timeout)
      sendLog('"Next" button not yet enabled, waiting for it to become active', 'info');
      const buttonEnabled = await timeGatedHandler.waitForNextButtonEnabled(page, logCallback, 60000);
      
      if (buttonEnabled) {
        return true;
      } else {
        sendLog('Timed out waiting for "Next" button to become enabled', 'warning');
        // Continue anyway
        return true;
      }
    }
  } catch (error) {
    sendLog(`Error handling time-gated content: ${error.message}`, 'error');
    
    // Take a screenshot of the error
    await page.screenshot({ 
      path: path.join(screenshotsDir, `time-gated-error-${Date.now()}.png`),
      fullPage: true 
    }).catch(() => {});
    
    // Continue anyway
    return false;
  }
}

/**
 * Find and complete assignments in a course with enhanced capabilities
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} courseAnalysis - Course analysis from analyzeCourseWithLangChain
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<number>} - Number of assignments completed
 */
async function completeAssignments(page, courseAnalysis = {}, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  try {
    sendLog('Looking for assignments to complete');
    
    // Simulate natural browsing behavior
    await antiBot.simulateNaturalBrowsing(page);
    
    // Find all assignment links with enhanced detection
    const assignmentSelectors = [
      'a[href*="assignments"]',
      'a[href*="assignment"]',
      'a[href*="quiz"]',
      'a[href*="exam"]',
      'a[href*="assessment"]',
      '.assignment-link',
      '.quiz-link',
      '.exam-link',
      '.assessment-link',
      'a:has-text("Assignment")',
      'a:has-text("Quiz")',
      'a:has-text("Exam")',
      'a:has-text("Assessment")',
      'a:has-text("Test")'
    ];
    
    let assignmentLinks = [];
    
    for (const selector of assignmentSelectors) {
      const links = await page.$$(selector);
      assignmentLinks = [...assignmentLinks, ...links];
    }
    
    // Remove duplicates (links that match multiple selectors)
    const uniqueLinks = [];
    const seenHrefs = new Set();
    
    for (const link of assignmentLinks) {
      const href = await link.evaluate(el => el.href);
      if (!seenHrefs.has(href)) {
        seenHrefs.add(href);
        uniqueLinks.push(link);
      }
    }
    
    assignmentLinks = uniqueLinks;
    sendLog(`Found ${assignmentLinks.length} potential assignments`, 'info');
    
    let completedCount = 0;
    
    // Process each assignment
    for (let i = 0; i < assignmentLinks.length; i++) {
      // Get the assignment name
      const assignmentName = await assignmentLinks[i].textContent();
      sendLog(`Processing assignment ${i+1}/${assignmentLinks.length}: "${assignmentName}"`, 'info');
      
      // Click on the assignment link with human-like behavior
      await retryHandler.retryElementInteraction(
        page,
        '', // We already have the element
        async () => {
          // Scroll to make the link visible
          await assignmentLinks[i].scrollIntoViewIfNeeded();
          
          // Move mouse to the link
          const box = await assignmentLinks[i].boundingBox();
          if (box) {
            await antiBot.humanLikeMouseMove(
              page, 
              box.x + box.width / 2, 
              box.y + box.height / 2
            );
          }
          
          // Click the link
          await assignmentLinks[i].click();
        },
        {
          maxRetries: 3,
          initialDelay: 1000
        },
        logCallback
      );
      
      // Wait for assignment page to load with retry
      const assignmentContentSelectors = [
        '.assignment-content',
        '.quiz-content',
        '.exam-content',
        '.assessment-content',
        '.assignment-details',
        '.quiz-details',
        '.exam-details',
        '.content-area',
        '.main-content',
        'div[class*="assignment"]',
        'div[class*="quiz"]',
        'div[class*="exam"]'
      ];
      
      let assignmentLoaded = false;
      
      for (const selector of assignmentContentSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000 });
          assignmentLoaded = true;
          break;
        } catch (err) {
          // Continue to next selector
        }
      }
      
      if (!assignmentLoaded) {
        sendLog('Assignment content not found, checking if page loaded correctly', 'warning');
        
        // Check if we're on an error page
        const isErrorPage = await page.evaluate(() => {
          return document.title.includes('Error') || 
                 document.body.innerText.includes('Error') ||
                 document.body.innerText.includes('not found') ||
                 document.body.innerText.includes('unavailable');
        });
        
        if (isErrorPage) {
          sendLog('Error page detected, skipping this assignment', 'error');
          
          // Try to go back to the course page
          await page.goBack().catch(() => {});
          continue;
        }
        
        // If not an error page, assume it's the assignment page
        sendLog('Continuing with assignment despite not finding expected content', 'warning');
      }
      
      // Take a screenshot of the assignment page
      await page.screenshot({ 
        path: path.join(screenshotsDir, `assignment-${i+1}-${Date.now()}.png`),
        fullPage: true 
      });
      
      // Check if assignment is already completed
      const completionIndicators = [
        '.assignment-completed',
        '.quiz-completed',
        '.exam-completed',
        '.completed-status',
        '.status-completed',
        '.completion-status:has-text("Completed")',
        'div:has-text("Completed"):not(:has-text("not completed"))',
        '.grade-received',
        '.score-received'
      ];
      
      let isCompleted = false;
      
      for (const selector of completionIndicators) {
        const indicator = await page.$(selector);
        if (indicator) {
          isCompleted = true;
          break;
        }
      }
      
      // Also check for text indicating completion
      if (!isCompleted) {
        isCompleted = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return bodyText.includes('already completed') || 
                 bodyText.includes('already submitted') ||
                 bodyText.includes('assignment completed') ||
                 bodyText.includes('quiz completed') ||
                 bodyText.includes('exam completed') ||
                 (bodyText.includes('grade') && bodyText.includes('received')) ||
                 (bodyText.includes('score') && bodyText.includes('received'));
        });
      }
      
      if (isCompleted) {
        sendLog(`Assignment "${assignmentName}" is already completed`, 'info');
        
        // Go back to the course page
        await retryHandler.retryNavigation(
          page,
          async () => {
            await page.goBack();
          },
          {
            maxRetries: 2,
            initialDelay: 1000
          },
          logCallback
        );
        
        continue;
      }
      
      // Check if assignment is time-gated
      const timeLockIndicators = [
        '.time-locked',
        '.locked-status',
        '.status-locked',
        '.not-available',
        '.unavailable',
        '.locked-message',
        'div:has-text("not available yet")',
        'div:has-text("will be available")',
        'div:has-text("opens on")',
        'div:has-text("locked")'
      ];
      
      let isTimeLocked = false;
      
      for (const selector of timeLockIndicators) {
        const indicator = await page.$(selector);
        if (indicator) {
          isTimeLocked = true;
          break;
        }
      }
      
      // Also check for text indicating time lock
      if (!isTimeLocked) {
        isTimeLocked = await page.evaluate(() => {
          const bodyText = document.body.innerText.toLowerCase();
          return bodyText.includes('not available yet') || 
                 bodyText.includes('will be available') ||
                 bodyText.includes('opens on') ||
                 bodyText.includes('locked') ||
                 bodyText.includes('not yet accessible');
        });
      }
      
      if (isTimeLocked) {
        sendLog(`Assignment "${assignmentName}" is time-locked, skipping`, 'warning');
        
        // Go back to the course page
        await retryHandler.retryNavigation(
          page,
          async () => {
            await page.goBack();
          },
          {
            maxRetries: 2,
            initialDelay: 1000
          },
          logCallback
        );
        
        continue;
      }
      
      // Handle time-gated content if present
      await handleTimeGatedContent(page, logCallback);
      
      // Check for CAPTCHA
      const captchaDetected = await antiBot.handleCaptcha(page, logCallback);
      if (captchaDetected) {
        sendLog('CAPTCHA detected, cannot proceed automatically', 'error');
        
        // Take a screenshot of the CAPTCHA
        await page.screenshot({ 
          path: path.join(screenshotsDir, `captcha-${Date.now()}.png`),
          fullPage: true 
        });
        
        // Go back to the course page
        await page.goBack().catch(() => {});
        continue;
      }
      
      // Detect quiz content
      const quizInfo = await quizHandler.detectQuizContent(page, logCallback);
      
      if (quizInfo.isQuiz) {
        sendLog(`Detected ${quizInfo.isExam ? 'exam' : 'quiz'} assignment`, 'info');
        
        // Complete the quiz
        const quizResult = await quizHandler.completeQuiz(page, courseAnalysis.courseDescription || '', logCallback);
        
        if (quizResult.success) {
          sendLog(`Successfully completed ${quizInfo.isExam ? 'exam' : 'quiz'}: ${assignmentName}`, 'success');
          completedCount++;
        } else {
          sendLog(`Failed to complete ${quizInfo.isExam ? 'exam' : 'quiz'}: ${quizResult.error || 'Unknown error'}`, 'error');
        }
      } else {
        // Handle other assignment types
        
        // Check for text assignment (textarea)
        const textAssignmentSelectors = [
          'textarea[name="response"]',
          'textarea.answer',
          'textarea.response',
          'textarea.assignment-response',
          'textarea'
        ];
        
        let textareaSelector = null;
        
        for (const selector of textAssignmentSelectors) {
          const textarea = await page.$(selector);
          if (textarea) {
            textareaSelector = selector;
            break;
          }
        }
        
        if (textareaSelector) {
          sendLog('Detected text assignment', 'info');
          
          // Extract the assignment prompt
          const promptSelectors = [
            '.assignment-prompt',
            '.prompt',
            '.question',
            '.instructions',
            '.assignment-instructions',
            '.assignment-description',
            'p'
          ];
          
          let assignmentPrompt = 'Complete the assignment.';
          
          for (const selector of promptSelectors) {
            const promptElement = await page.$(selector);
            if (promptElement) {
              assignmentPrompt = await promptElement.textContent();
              break;
            }
          }
          
          // Use LangChain to generate a response
          sendLog('Generating response for text assignment', 'info');
          const response = await langchainUtils.generateAssignmentResponse(
            assignmentPrompt,
            courseAnalysis.courseDescription || ''
          );
          
          // Fill in the response with human-like typing
          await antiBot.humanLikeType(page, textareaSelector, response);
          
          // Find and click submit button
          const submitButtonSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button:has-text("Submit")',
            'button:has-text("Save")',
            'button:has-text("Submit Assignment")',
            'a:has-text("Submit")',
            '.submit-button',
            '.save-button',
            '#submit-assignment',
            '#save-assignment'
          ];
          
          let submitClicked = false;
          
          for (const selector of submitButtonSelectors) {
            const button = await page.$(selector);
            if (button) {
              await antiBot.humanLikeClick(page, selector);
              submitClicked = true;
              break;
            }
          }
          
          if (!submitClicked) {
            sendLog('Could not find submit button, trying to press Enter in the textarea', 'warning');
            await page.press(textareaSelector, 'Enter');
          }
          
          // Wait for confirmation
          const confirmationSelectors = [
            '.submission-confirmation',
            '.success-message',
            '.confirmation',
            '.submitted-status',
            'div:has-text("successfully submitted")',
            'div:has-text("submission received")'
          ];
          
          let confirmed = false;
          
          for (const selector of confirmationSelectors) {
            try {
              await page.waitForSelector(selector, { timeout: 10000 });
              confirmed = true;
              break;
            } catch (err) {
              // Continue to next selector
            }
          }
          
          if (confirmed) {
            sendLog('Text assignment submitted successfully', 'success');
            completedCount++;
          } else {
            // Check if we're no longer on the assignment page (might indicate success)
            const stillOnAssignmentPage = await page.evaluate(() => {
              return document.querySelector('textarea') !== null;
            });
            
            if (!stillOnAssignmentPage) {
              sendLog('No explicit confirmation, but no longer on assignment page. Assuming success.', 'warning');
              completedCount++;
            } else {
              sendLog('Could not confirm assignment submission', 'error');
            }
          }
        } else {
          // Handle other assignment types or unknown types
          sendLog('Unknown assignment type, cannot complete automatically', 'warning');
          
          // Take a screenshot for analysis
          await page.screenshot({ 
            path: path.join(screenshotsDir, `unknown-assignment-${Date.now()}.png`),
            fullPage: true 
          });
        }
      }
      
      sendLog(`Completed processing assignment: ${assignmentName}`, 'info');
      
      // Take a screenshot of the completed assignment
      if (config.automation.saveScreenshots) {
        await page.screenshot({ 
          path: path.join(screenshotsDir, `assignment-completed-${Date.now()}.png`),
          fullPage: true 
        });
      }
      
      // Go back to the course page
      await retryHandler.retryNavigation(
        page,
        async () => {
          await page.goBack();
        },
        {
          maxRetries: 3,
          initialDelay: 1000
        },
        logCallback
      );
      
      // Add a small delay between assignments
      await page.waitForTimeout(antiBot.getRandomDelay(2000, 5000));
    }
    
    sendLog(`Completed ${completedCount} assignments`, 'success');
    return completedCount;
  } catch (error) {
    sendLog(`Error completing assignments: ${error.message}`, 'error');
    
    // Take a screenshot of the error
    await page.screenshot({ 
      path: path.join(screenshotsDir, `assignment-error-${Date.now()}.png`),
      fullPage: true 
    }).catch(() => {});
    
    // Try to recover
    const recovered = await retryHandler.attemptRecovery(page, {
      refresh: true,
      goBack: true,
      checkSession: true
    }, logCallback);
    
    if (recovered) {
      sendLog('Recovered from error, but will not retry assignment completion', 'info');
    }
    
    return 0;
  }
}

/**
 * Run the full LMS automation process with enhanced capabilities
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} credentials - User credentials
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Automation results
 */
async function runAutomation(page, credentials, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  try {
    sendLog('Starting LMS automation with enhanced capabilities', 'info');
    
    // Apply anti-bot stealth measures to the browser context
    await antiBot.applyStealthMeasures(page.context());
    
    // Login to the LMS
    const loginSuccess = await loginToLMS(page, credentials, logCallback);
    if (!loginSuccess) {
      throw new Error('Failed to login to LMS');
    }
    
    // Process each course
    let totalCompleted = 0;
    const courseResults = [];
    
    // Get course IDs from config or credentials
    const courseIds = credentials.courseIds || config.lms.courseIds || [];
    
    if (courseIds.length === 0) {
      sendLog('No course IDs specified, attempting to detect available courses', 'warning');
      
      // Try to detect available courses
      const detectedCourseIds = await page.evaluate(() => {
        const courseLinks = document.querySelectorAll('a[href*="course"]');
        const ids = new Set();
        
        courseLinks.forEach(link => {
          const href = link.href;
          const match = href.match(/course[s]?\/([^\/\?]+)/i);
          if (match && match[1]) {
            ids.add(match[1]);
          }
        });
        
        return Array.from(ids);
      });
      
      if (detectedCourseIds.length > 0) {
        sendLog(`Detected ${detectedCourseIds.length} courses: ${detectedCourseIds.join(', ')}`, 'info');
        courseIds.push(...detectedCourseIds);
      } else {
        sendLog('Could not detect any courses', 'error');
      }
    }
    
    for (const courseId of courseIds) {
      sendLog(`Processing course: ${courseId}`, 'info');
      
      const navSuccess = await navigateToCourse(page, courseId, logCallback);
      
      if (navSuccess) {
        // Analyze course content
        const courseAnalysis = await analyzeCourseWithLangChain(page, logCallback);
        
        // Handle time-gated content if present
        await handleTimeGatedContent(page, logCallback);
        
        // Complete assignments
        const completed = await completeAssignments(page, courseAnalysis, logCallback);
        totalCompleted += completed;
        
        courseResults.push({
          courseId,
          courseTitle: courseAnalysis.courseTitle || 'Unknown',
          assignmentsCompleted: completed,
          success: true
        });
      } else {
        courseResults.push({
          courseId,
          success: false,
          error: 'Failed to navigate to course'
        });
      }
    }
    
    sendLog(`LMS automation completed. Total assignments completed: ${totalCompleted}`, 'success');
    
    return {
      success: true,
      totalAssignmentsCompleted: totalCompleted,
      courseResults
    };
  } catch (error) {
    sendLog(`Error in LMS automation: ${error.message}`, 'error');
    
    // Take a screenshot of the error
    await page.screenshot({ 
      path: path.join(screenshotsDir, `automation-error-${Date.now()}.png`),
      fullPage: true 
    }).catch(() => {});
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Run the full LMS automation process with browser setup
 * @param {Object} credentials - User credentials
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Automation results
 */
async function runLMSAutomation(credentials = {}, logCallback = null) {
  const sendLog = (message, type = 'info') => {
    logger.info(message);
    if (logCallback) logCallback(message, type);
  };

  sendLog('Starting LMS automation', 'info');
  
  let browser = null;
  let context = null;
  
  try {
    // Launch browser with enhanced options
    browser = await chromium.launch({
      headless: config.browser.headless,
      slowMo: config.browser.slowMo,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-site-isolation-trials'
      ]
    });
    
    // Create browser context with enhanced options
    context = await browser.newContext({
      viewport: config.browser.viewport,
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      recordVideo: config.automation.recordVideos ? {
        dir: '../videos/',
        size: config.browser.viewport,
      } : undefined,
      // Mimic real browser permissions
      permissions: ['geolocation', 'notifications'],
      // Set realistic device parameters
      deviceScaleFactor: 1,
      hasTouch: false,
      isMobile: false,
      // Set timezone and locale
      locale: 'en-US',
      timezoneId: 'America/New_York'
    });
    
    // Create a new page
    const page = await context.newPage();
    
    // Run the automation
    const result = await retryHandler.withCleanup(
      async () => {
        return await runAutomation(page, credentials, logCallback);
      },
      async () => {
        // Cleanup function
        if (browser) {
          await browser.close();
          sendLog('Browser closed', 'info');
        }
      },
      logCallback
    );
    
    return result;
  } catch (error) {
    sendLog(`Critical error in LMS automation: ${error.message}`, 'error');
    
    // Ensure browser is closed
    if (browser) {
      await browser.close().catch(() => {});
    }
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  loginToLMS,
  navigateToCourse,
  completeAssignments,
  analyzeCourseWithLangChain,
  handleTimeGatedContent,
  runAutomation,
  runLMSAutomation,
};