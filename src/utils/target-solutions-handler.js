/**
 * Specialized handler for Target Solutions LMS automation
 * Integrates enhanced capabilities for course completion
 */
const { chromium } = require('@playwright/test');
const winston = require('winston');
const config = require('../config/default');
const enhancedStealth = require('./enhanced-stealth');
const contextExtractor = require('./course-context-extractor');
const timeGatedHandler = require('./time-gated-handler');
const langchainUtils = require('./langchain-utils');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'target-solutions-handler' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/target-solutions-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/target-solutions-combined.log` 
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
 * Login to Target Solutions LMS
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} credentials - User credentials
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether login was successful
 */
async function login(page, credentials, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Logging in to Target Solutions...', 'info');
    
    // Navigate to login page
    await page.goto(process.env.LMS_URL || 'https://app.targetsolutions.com/auth/index.cfm?action=login.showloginone&customerid=0&customerpath=login&msg=');
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Fill in username and password with human-like typing
    const usernameInput = page.locator('#username');
    const passwordInput = page.locator('#password');
    
    await enhancedStealth.humanLikeType(usernameInput, credentials.username);
    await enhancedStealth.humanLikeType(passwordInput, credentials.password);
    
    // Click login button with human-like clicking
    const loginButton = page.locator('.btn-login');
    await enhancedStealth.humanLikeClick(loginButton);
    
    // Wait for navigation
    await page.waitForNavigation({ waitUntil: 'networkidle' });
    
    // Check if login was successful
    const isLoggedIn = await page.evaluate(() => {
      return !document.querySelector('.btn-login') && 
             (document.querySelector('#navTop') || 
              document.querySelector('.navbar') || 
              document.querySelector('.optionsRight'));
    });
    
    if (isLoggedIn) {
      sendLog('Successfully logged in to Target Solutions', 'success');
      return true;
    } else {
      sendLog('Failed to log in to Target Solutions', 'error');
      return false;
    }
  } catch (error) {
    logger.error('Error logging in to Target Solutions:', error);
    if (logCallback) logCallback(`Error logging in to Target Solutions: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Navigate to My Assignments page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether navigation was successful
 */
async function navigateToMyAssignments(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Navigating to My Assignments page...', 'info');
    
    // Check if we're already on the My Assignments page
    const currentUrl = page.url();
    if (currentUrl.includes('c_pro_assignments.showHome')) {
      sendLog('Already on My Assignments page', 'info');
      return true;
    }
    
    // Try to find and click the My Assignments link
    const myAssignmentsLink = page.locator('a:has-text("My Assignments")').first();
    
    if (await myAssignmentsLink.count() > 0) {
      sendLog('Clicking My Assignments link...', 'info');
      await enhancedStealth.humanLikeClick(myAssignmentsLink);
      
      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      
      // Verify we're on the My Assignments page
      const isOnMyAssignmentsPage = await page.evaluate(() => {
        return document.querySelector('h1.header')?.textContent.includes('My Assignments');
      });
      
      if (isOnMyAssignmentsPage) {
        sendLog('Successfully navigated to My Assignments page', 'success');
        return true;
      } else {
        sendLog('Failed to navigate to My Assignments page', 'error');
        return false;
      }
    } else {
      // Try alternative navigation
      sendLog('My Assignments link not found, trying alternative navigation...', 'info');
      
      // Try to go directly to the My Assignments URL
      await page.goto('/tsapp/dashboard/pl_fb/index.cfm?fuseaction=c_pro_assignments.showHome');
      
      // Verify we're on the My Assignments page
      const isOnMyAssignmentsPage = await page.evaluate(() => {
        return document.querySelector('h1.header')?.textContent.includes('My Assignments');
      });
      
      if (isOnMyAssignmentsPage) {
        sendLog('Successfully navigated to My Assignments page', 'success');
        return true;
      } else {
        sendLog('Failed to navigate to My Assignments page', 'error');
        return false;
      }
    }
  } catch (error) {
    logger.error('Error navigating to My Assignments page:', error);
    if (logCallback) logCallback(`Error navigating to My Assignments page: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Get all assignments from the My Assignments page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Array>} - Array of assignment objects
 */
async function getAssignments(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Getting assignments from My Assignments page...', 'info');
    
    // Wait for the assignments table to load
    await page.waitForSelector('table.pod.data');
    
    // Extract assignments
    const assignments = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('table.pod.data tbody tr'));
      
      return rows.map(row => {
        const typeCell = row.querySelector('td:nth-child(1)');
        const nameCell = row.querySelector('td:nth-child(2)');
        const startDateCell = row.querySelector('td:nth-child(3)');
        const dueDateCell = row.querySelector('td:nth-child(4)');
        const statusCell = row.querySelector('td:nth-child(5)');
        const assignedByCell = row.querySelector('td:nth-child(6)');
        
        const link = nameCell.querySelector('a');
        const transcriptId = link ? link.href.match(/transcriptID=(\d+)/)?.[1] || '' : '';
        
        return {
          id: row.id.replace('row', ''),
          type: typeCell.querySelector('span')?.title || 'Unknown',
          name: nameCell.textContent.trim(),
          url: link ? link.href : '',
          transcriptId,
          startDate: startDateCell.textContent.trim(),
          dueDate: dueDateCell.textContent.trim(),
          status: statusCell.textContent.trim(),
          assignedBy: assignedByCell.textContent.trim()
        };
      });
    });
    
    sendLog(`Found ${assignments.length} assignments`, 'info');
    
    // Sort assignments by due date (earliest first)
    assignments.sort((a, b) => {
      const dateA = new Date(a.dueDate);
      const dateB = new Date(b.dueDate);
      return dateA - dateB;
    });
    
    return assignments;
  } catch (error) {
    logger.error('Error getting assignments:', error);
    if (logCallback) logCallback(`Error getting assignments: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Handle a quiz question
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether the quiz was handled successfully
 */
async function handleQuiz(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Checking for quiz question...', 'info');
    
    // Check if this is a quiz page
    const isQuizPage = await page.evaluate(() => {
      return !!document.querySelector('.panel-heading h5') || 
             !!document.querySelector('.instructions') ||
             !!document.querySelector('.list-group-item');
    });
    
    if (!isQuizPage) {
      sendLog('Not a quiz page', 'info');
      return false;
    }
    
    sendLog('Quiz detected. Extracting question and options...', 'info');
    
    // Extract question and options
    const questionData = await page.evaluate(() => {
      const questionElement = document.querySelector('.panel-heading h5');
      const question = questionElement ? questionElement.textContent.trim() : '';
      
      const optionElements = Array.from(document.querySelectorAll('.list-group-item'));
      const options = optionElements.map(option => {
        const letter = option.querySelector('.letter-choice')?.textContent.trim() || '';
        const text = option.textContent.replace(letter, '').trim();
        return { letter, text };
      });
      
      return { question, options };
    });
    
    sendLog(`Question: ${questionData.question}`, 'info');
    questionData.options.forEach(option => {
      sendLog(`Option ${option.letter} ${option.text}`, 'info');
    });
    
    // Extract course context to help answer the question
    const courseContext = await contextExtractor.extractCourseContext(page, logCallback);
    
    // Use LangChain to determine the correct answer
    sendLog('Using AI to determine the correct answer...', 'info');
    
    const prompt = `
    Question: ${questionData.question}
    
    Options:
    ${questionData.options.map(o => `${o.letter} ${o.text}`).join('\n')}
    
    Course Context:
    ${courseContext}
    
    Based on the course context and your knowledge, which option is most likely the correct answer? 
    Respond with just the letter (A, B, C, or D).
    `;
    
    const answer = await langchainUtils.getQuizAnswer(prompt);
    const answerLetter = answer.trim().charAt(0).toUpperCase();
    
    sendLog(`AI suggests answer ${answerLetter}`, 'info');
    
    // Find the option with the matching letter
    const selectedOption = questionData.options.find(o => o.letter.includes(answerLetter));
    
    if (!selectedOption) {
      sendLog('Could not find matching option for the suggested answer', 'error');
      return false;
    }
    
    // Click the selected option
    const optionSelector = `.list-group-item:has-text("${selectedOption.text}")`;
    const optionElement = page.locator(optionSelector);
    
    sendLog(`Clicking option ${answerLetter}: ${selectedOption.text}`, 'info');
    await enhancedStealth.humanLikeClick(optionElement);
    
    // Wait for feedback modal
    await page.waitForSelector('.modal-content', { state: 'visible' });
    
    // Check if answer was correct
    const isCorrect = await page.evaluate(() => {
      return !!document.querySelector('.correct-header');
    });
    
    if (isCorrect) {
      sendLog('Answer was correct!', 'success');
      
      // Click Continue button
      const continueButton = page.locator('.modal-footer .btn-success');
      await enhancedStealth.humanLikeClick(continueButton);
      
      // Wait for navigation
      await page.waitForNavigation({ waitUntil: 'networkidle' });
      
      return true;
    } else {
      sendLog('Answer was incorrect. Trying again...', 'warning');
      
      // Get feedback
      const feedback = await page.evaluate(() => {
        return document.querySelector('.modal-body p')?.textContent.trim() || '';
      });
      
      sendLog(`Feedback: ${feedback}`, 'info');
      
      // Click Try Again button
      const tryAgainButton = page.locator('.modal-footer .btn-danger');
      await enhancedStealth.humanLikeClick(tryAgainButton);
      
      // Wait for modal to close
      await page.waitForSelector('.modal-content', { state: 'hidden' });
      
      // Try a different answer
      // Find options we haven't tried yet
      const remainingOptions = questionData.options.filter(o => o.letter !== selectedOption.letter);
      
      if (remainingOptions.length === 0) {
        sendLog('No more options to try', 'error');
        return false;
      }
      
      // Use the feedback to determine the correct answer
      const correctOption = await determineCorrectOptionFromFeedback(feedback, remainingOptions, courseContext);
      
      if (correctOption) {
        sendLog(`Based on feedback, trying option ${correctOption.letter}: ${correctOption.text}`, 'info');
        
        // Click the new option
        const newOptionSelector = `.list-group-item:has-text("${correctOption.text}")`;
        const newOptionElement = page.locator(newOptionSelector);
        
        await enhancedStealth.humanLikeClick(newOptionElement);
        
        // Wait for feedback modal
        await page.waitForSelector('.modal-content', { state: 'visible' });
        
        // Check if answer was correct
        const isCorrectNow = await page.evaluate(() => {
          return !!document.querySelector('.correct-header');
        });
        
        if (isCorrectNow) {
          sendLog('Second attempt was correct!', 'success');
          
          // Click Continue button
          const continueButton = page.locator('.modal-footer .btn-success');
          await enhancedStealth.humanLikeClick(continueButton);
          
          // Wait for navigation
          await page.waitForNavigation({ waitUntil: 'networkidle' });
          
          return true;
        } else {
          sendLog('Second attempt was also incorrect', 'error');
          return false;
        }
      } else {
        sendLog('Could not determine correct option from feedback', 'error');
        return false;
      }
    }
  } catch (error) {
    logger.error('Error handling quiz:', error);
    if (logCallback) logCallback(`Error handling quiz: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Determine the correct option from feedback
 * @param {string} feedback - Feedback from incorrect answer
 * @param {Array} options - Remaining options
 * @param {string} courseContext - Course context
 * @returns {Promise<Object>} - Correct option
 */
async function determineCorrectOptionFromFeedback(feedback, options, courseContext) {
  try {
    // Use LangChain to determine the correct answer based on feedback
    const prompt = `
    Feedback from incorrect answer: ${feedback}
    
    Remaining options:
    ${options.map(o => `${o.letter} ${o.text}`).join('\n')}
    
    Course Context:
    ${courseContext}
    
    Based on the feedback and course context, which of the remaining options is most likely the correct answer?
    Respond with just the letter (${options.map(o => o.letter.charAt(0)).join(', ')}).
    `;
    
    const answer = await langchainUtils.getQuizAnswer(prompt);
    const answerLetter = answer.trim().charAt(0).toUpperCase();
    
    // Find the option with the matching letter
    return options.find(o => o.letter.includes(answerLetter));
  } catch (error) {
    logger.error('Error determining correct option from feedback:', error);
    return null;
  }
}

/**
 * Complete an assignment
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} assignment - Assignment object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether the assignment was completed successfully
 */
async function completeAssignment(page, assignment, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog(`Starting assignment: ${assignment.name}`, 'info');
    
    // Navigate to the assignment
    await page.goto(assignment.url);
    
    // Wait for page to load
    await page.waitForLoadState('domcontentloaded');
    
    // Check if we're on the assignment page
    const isOnAssignmentPage = await page.evaluate(() => {
      return !!document.querySelector('#ts-wrapper') || 
             !!document.querySelector('.course-title');
    });
    
    if (!isOnAssignmentPage) {
      sendLog('Failed to navigate to assignment page', 'error');
      return false;
    }
    
    sendLog('Successfully navigated to assignment page', 'success');
    
    // Process each page of the assignment
    let isComplete = false;
    let pageCount = 0;
    
    while (!isComplete && pageCount < 100) { // Safety limit
      pageCount++;
      
      // Store page information for quiz context
      await contextExtractor.storePageInformation(page, logCallback);
      
      // Check if this is a quiz page
      const quizHandled = await handleQuiz(page, logCallback);
      
      if (quizHandled) {
        sendLog('Quiz handled successfully', 'success');
        continue; // Quiz navigation already handled
      }
      
      // Handle time-gated content (videos, etc.)
      await timeGatedHandler.handleTimeGatedContent(page, logCallback);
      
      // Check if we've reached the end of the assignment
      isComplete = await page.evaluate(() => {
        // Check for completion indicators
        return document.querySelector('.course-complete') !== null ||
               document.querySelector('.completion-message') !== null ||
               document.querySelector('.final-exam-complete') !== null ||
               document.querySelector('.certificate') !== null;
      });
      
      if (isComplete) {
        sendLog('Assignment completed!', 'success');
        break;
      }
      
      // Try Target Solutions specific navigation
      const tsNavigated = await timeGatedHandler.handleTargetSolutionsNavigation(page, logCallback);
      
      if (tsNavigated) {
        sendLog('Navigated to next page using Target Solutions navigation', 'info');
        continue;
      }
      
      // Check if Next button is enabled
      const nextEnabled = await timeGatedHandler.isNextButtonEnabled(page);
      
      if (nextEnabled) {
        sendLog('Clicking Next button...', 'info');
        
        // Find and click the Next button
        const nextButton = page.locator('#nextA, a:has-text("Next"), .navLink[id="nextA"]').first();
        
        if (await nextButton.count() > 0) {
          await enhancedStealth.humanLikeClick(nextButton);
          
          // Wait for navigation
          await page.waitForNavigation({ waitUntil: 'networkidle' });
          
          sendLog('Navigated to next page', 'info');
        } else {
          sendLog('Next button not found', 'warning');
          
          // Try alternative navigation
          const alternativeNext = page.locator('.btn-next, .next-button, [aria-label="Next"]').first();
          
          if (await alternativeNext.count() > 0) {
            await enhancedStealth.humanLikeClick(alternativeNext);
            
            // Wait for navigation
            await page.waitForNavigation({ waitUntil: 'networkidle' });
            
            sendLog('Navigated to next page using alternative button', 'info');
          } else {
            sendLog('No navigation buttons found', 'error');
            break;
          }
        }
      } else {
        sendLog('Next button is disabled. Waiting for it to become enabled...', 'info');
        
        // Wait for Next button to become enabled
        const buttonEnabled = await timeGatedHandler.waitForNextButtonEnabled(page, logCallback);
        
        if (buttonEnabled) {
          sendLog('Next button is now enabled', 'info');
          continue; // Retry the loop
        } else {
          sendLog('Timed out waiting for Next button to become enabled', 'warning');
          break;
        }
      }
    }
    
    // Clear stored course content
    await contextExtractor.clearStoredCourseContent(page, logCallback);
    
    return isComplete;
  } catch (error) {
    logger.error('Error completing assignment:', error);
    if (logCallback) logCallback(`Error completing assignment: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Run the Target Solutions automation
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

    sendLog('Starting Target Solutions automation...', 'info');
    
    // Create stealth browser
    const { browser, context } = await enhancedStealth.createStealthBrowser();
    
    // Create a new page
    const page = await context.newPage();
    
    // Login to Target Solutions
    const loginSuccess = await login(page, credentials, logCallback);
    
    if (!loginSuccess) {
      sendLog('Failed to log in to Target Solutions. Aborting automation.', 'error');
      await browser.close();
      return { success: false, error: 'Login failed' };
    }
    
    // Navigate to My Assignments page
    const myAssignmentsSuccess = await navigateToMyAssignments(page, logCallback);
    
    if (!myAssignmentsSuccess) {
      sendLog('Failed to navigate to My Assignments page. Aborting automation.', 'error');
      await browser.close();
      return { success: false, error: 'Navigation to My Assignments failed' };
    }
    
    // Get assignments
    const assignments = await getAssignments(page, logCallback);
    
    if (assignments.length === 0) {
      sendLog('No assignments found. Automation complete.', 'info');
      await browser.close();
      return { success: true, assignmentsCompleted: 0 };
    }
    
    // Process assignments
    let completedCount = 0;
    
    // Check if we should process assignments in parallel
    if (assignments.length > 1 && process.env.PARALLEL_ASSIGNMENTS !== 'false') {
      sendLog(`Found ${assignments.length} assignments. Processing in parallel...`, 'info');
      
      // Process up to 2 assignments in parallel
      const maxConcurrent = Math.min(assignments.length, 2);
      
      sendLog(`Will process up to ${maxConcurrent} assignments concurrently`, 'info');
      
      let inProgress = 0;
      const completionPromises = [];
      
      // Process assignments in batches
      for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        
        // Wait if we've reached the maximum concurrent assignments
        if (inProgress >= maxConcurrent) {
          await Promise.race(completionPromises);
        }
        
        // Create a new page for this assignment
        const assignmentPage = await context.newPage();
        
        // Increment in-progress counter
        inProgress++;
        
        // Process this assignment
        sendLog(`Starting assignment: ${assignment.name} (due: ${assignment.dueDate})`, 'info');
        
        // Create a promise for this assignment's completion
        const completionPromise = (async () => {
          try {
            // Navigate to the assignment
            await assignmentPage.goto(assignment.url);
            
            // Wait for page to load
            await assignmentPage.waitForLoadState('domcontentloaded');
            
            // Complete the assignment
            const completed = await completeAssignment(assignmentPage, assignment, logCallback);
            
            if (completed) {
              completedCount++;
              sendLog(`Assignment completed: ${assignment.name}`, 'success');
            } else {
              sendLog(`Failed to complete assignment: ${assignment.name}`, 'error');
            }
            
            inProgress--;
            
            // Close this page when done
            await assignmentPage.close();
          } catch (error) {
            sendLog(`Error processing assignment ${assignment.name}: ${error.message}`, 'error');
            inProgress--;
            await assignmentPage.close();
          }
        })();
        
        completionPromises.push(completionPromise);
      }
      
      // Wait for all assignments to complete
      await Promise.all(completionPromises);
      
      sendLog(`Completed ${completedCount} assignments in parallel mode`, 'success');
    } else {
      // Process assignments sequentially
      sendLog(`Found ${assignments.length} assignments. Processing sequentially...`, 'info');
      
      for (const assignment of assignments) {
        sendLog(`Processing assignment: ${assignment.name} (due: ${assignment.dueDate})`, 'info');
        
        // Complete the assignment
        const completed = await completeAssignment(page, assignment, logCallback);
        
        if (completed) {
          completedCount++;
          sendLog(`Assignment completed: ${assignment.name}`, 'success');
        } else {
          sendLog(`Failed to complete assignment: ${assignment.name}`, 'error');
        }
      }
    }
    
    // Close browser
    await browser.close();
    
    sendLog(`Target Solutions automation completed. ${completedCount} assignments completed.`, 'success');
    
    return {
      success: true,
      assignmentsCompleted: completedCount,
      totalAssignments: assignments.length
    };
  } catch (error) {
    logger.error('Error in Target Solutions automation:', error);
    if (logCallback) logCallback(`Error in Target Solutions automation: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

module.exports = {
  login,
  navigateToMyAssignments,
  getAssignments,
  handleQuiz,
  completeAssignment,
  runTargetSolutionsAutomation
};