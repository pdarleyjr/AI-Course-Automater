/**
 * Utility functions for handling quizzes and exams in LMS automation
 */
const winston = require('winston');
const config = require('../config/default');
const langchainUtils = require('./langchain-utils');
const antiBot = require('./anti-bot-detection');
const retryHandler = require('./retry-handler');

// Configure logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'quiz-handler' },
  transports: [
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/quiz-error.log`, 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: `${config.logging.file.path}/quiz-combined.log` 
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
 * Detect quiz or exam content on a page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Quiz detection results
 */
async function detectQuizContent(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Analyzing page for quiz or exam content...');
    
    // Common quiz indicators
    const quizIndicators = [
      { selector: '.quiz-container', weight: 10 },
      { selector: '.exam-container', weight: 10 },
      { selector: '.assessment', weight: 8 },
      { selector: '.question-container', weight: 9 },
      { selector: '.multiple-choice', weight: 9 },
      { selector: 'form.quiz', weight: 10 },
      { selector: 'form.exam', weight: 10 },
      { selector: 'input[type="radio"]', weight: 7 },
      { selector: '.quiz-question', weight: 9 },
      { selector: '.exam-question', weight: 9 },
      { selector: '.question-text', weight: 8 },
      { selector: '.option-text', weight: 7 },
      { selector: '.answer-option', weight: 7 },
      { selector: '.submit-quiz', weight: 9 },
      { selector: '.submit-exam', weight: 9 },
      { selector: 'button:has-text("Submit Quiz")', weight: 10 },
      { selector: 'button:has-text("Submit Exam")', weight: 10 },
      { selector: 'button:has-text("Submit Assessment")', weight: 10 },
      { selector: '.question-number', weight: 8 }
    ];
    
    // Check for quiz indicators
    let quizScore = 0;
    let detectedIndicators = [];
    
    for (const indicator of quizIndicators) {
      const elements = await page.$$(indicator.selector);
      if (elements.length > 0) {
        quizScore += indicator.weight;
        detectedIndicators.push({
          selector: indicator.selector,
          count: elements.length
        });
      }
    }
    
    // Check for quiz-related text
    const pageText = await page.evaluate(() => document.body.innerText);
    const quizTextIndicators = [
      { text: 'quiz', weight: 5 },
      { text: 'exam', weight: 5 },
      { text: 'assessment', weight: 4 },
      { text: 'multiple choice', weight: 5 },
      { text: 'select the correct', weight: 5 },
      { text: 'choose the best', weight: 5 },
      { text: 'final exam', weight: 6 },
      { text: 'question', weight: 3 },
      { text: 'answer', weight: 3 },
      { text: 'submit your answers', weight: 5 },
      { text: 'passing score', weight: 5 },
      { text: 'minimum score', weight: 5 },
      { text: 'time limit', weight: 4 }
    ];
    
    for (const indicator of quizTextIndicators) {
      if (pageText.toLowerCase().includes(indicator.text)) {
        quizScore += indicator.weight;
        detectedIndicators.push({
          text: indicator.text
        });
      }
    }
    
    // Determine if this is a quiz/exam based on score
    const isQuiz = quizScore >= 15;
    const isExam = quizScore >= 20 && (
      pageText.toLowerCase().includes('exam') || 
      pageText.toLowerCase().includes('final assessment')
    );
    
    if (isQuiz) {
      sendLog(`Quiz/assessment detected (confidence score: ${quizScore})`, 'info');
      
      // Try to determine the quiz type
      let quizType = 'unknown';
      
      if (await page.$$('input[type="radio"]').then(els => els.length > 0)) {
        quizType = 'multiple-choice';
      } else if (await page.$$('input[type="checkbox"]').then(els => els.length > 0)) {
        quizType = 'multiple-select';
      } else if (await page.$$('textarea').then(els => els.length > 0)) {
        quizType = 'free-response';
      } else if (await page.$$('input[type="text"]').then(els => els.length > 0)) {
        quizType = 'fill-in-blank';
      } else if (await page.$$('select').then(els => els.length > 0)) {
        quizType = 'dropdown';
      } else if (await page.$$('.matching-question').then(els => els.length > 0)) {
        quizType = 'matching';
      }
      
      // Try to determine the number of questions
      let questionCount = 0;
      
      // Method 1: Count question containers
      questionCount = await page.$$('.question-container, .quiz-question, .exam-question, .assessment-question')
        .then(els => els.length);
      
      // Method 2: If no containers found, try counting question numbers
      if (questionCount === 0) {
        questionCount = await page.$$('.question-number')
          .then(els => els.length);
      }
      
      // Method 3: If still no count, try counting radio button groups
      if (questionCount === 0 && quizType === 'multiple-choice') {
        // Get all radio button names
        const radioNames = await page.evaluate(() => {
          const radios = document.querySelectorAll('input[type="radio"]');
          const names = new Set();
          radios.forEach(radio => {
            if (radio.name) names.add(radio.name);
          });
          return Array.from(names);
        });
        
        questionCount = radioNames.length;
      }
      
      // Try to determine if there's a time limit
      let timeLimit = null;
      const timeLimitText = await page.evaluate(() => {
        const timeElements = document.querySelectorAll('.time-limit, .timer, .countdown');
        for (const el of timeElements) {
          return el.textContent;
        }
        return null;
      });
      
      if (timeLimitText) {
        // Try to extract time (minutes)
        const timeMatch = timeLimitText.match(/(\d+)\s*(min|minute|hour)/i);
        if (timeMatch) {
          const amount = parseInt(timeMatch[1], 10);
          const unit = timeMatch[2].toLowerCase();
          
          if (unit.startsWith('min')) {
            timeLimit = amount;
          } else if (unit.startsWith('hour')) {
            timeLimit = amount * 60;
          }
        }
      }
      
      return {
        isQuiz,
        isExam,
        quizType,
        questionCount: questionCount || 'unknown',
        timeLimit,
        confidenceScore: quizScore,
        indicators: detectedIndicators
      };
    }
    
    sendLog('No quiz/exam content detected on this page', 'info');
    return {
      isQuiz: false,
      isExam: false,
      confidenceScore: quizScore
    };
  } catch (error) {
    logger.error('Error detecting quiz content:', error);
    if (logCallback) logCallback(`Error detecting quiz content: ${error.message}`, 'error');
    
    return {
      isQuiz: false,
      isExam: false,
      error: error.message
    };
  }
}

/**
 * Extract questions and options from a quiz page
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} quizInfo - Quiz information from detectQuizContent
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Array>} - Array of question objects
 */
async function extractQuizQuestions(page, quizInfo, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Extracting quiz questions and options...');
    
    if (!quizInfo.isQuiz) {
      sendLog('Not a quiz page, cannot extract questions', 'warning');
      return [];
    }
    
    let questions = [];
    
    // Different extraction strategies based on quiz type and structure
    if (quizInfo.quizType === 'multiple-choice' || quizInfo.quizType === 'multiple-select') {
      // Strategy 1: Look for question containers
      const questionContainers = await page.$$('.question-container, .quiz-question, .exam-question, .assessment-question');
      
      if (questionContainers.length > 0) {
        sendLog(`Found ${questionContainers.length} question containers`, 'info');
        
        for (let i = 0; i < questionContainers.length; i++) {
          const container = questionContainers[i];
          
          // Extract question text
          const questionTextElement = await container.$('.question-text, .question-title, .question-stem');
          let questionText = questionTextElement 
            ? await questionTextElement.textContent() 
            : await container.evaluate(el => {
                // Try to find the question text by looking at the first paragraph or div
                const firstP = el.querySelector('p');
                if (firstP) return firstP.textContent.trim();
                
                // If no p tag, try to get the first text node or div
                for (const child of el.childNodes) {
                  if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) {
                    return child.textContent.trim();
                  } else if (child.nodeType === Node.ELEMENT_NODE && 
                            !child.classList.contains('option') && 
                            !child.classList.contains('answer') &&
                            child.textContent.trim()) {
                    return child.textContent.trim();
                  }
                }
                
                return 'Unknown question';
              });
          
          // Clean up question text
          questionText = questionText.trim().replace(/\s+/g, ' ');
          
          // Extract options
          const optionElements = await container.$$('input[type="radio"], input[type="checkbox"]');
          const options = [];
          
          for (const optionElement of optionElements) {
            // Get the option text (usually in a label or span near the input)
            const optionId = await optionElement.evaluate(el => el.id);
            let optionText = '';
            
            if (optionId) {
              // Try to find associated label
              const label = await container.$(`label[for="${optionId}"]`);
              if (label) {
                optionText = await label.textContent();
              }
            }
            
            // If no label found, try to get text from parent or sibling
            if (!optionText) {
              optionText = await optionElement.evaluate(el => {
                // Check parent
                const parent = el.parentElement;
                if (parent && parent.textContent.trim()) {
                  return parent.textContent.trim();
                }
                
                // Check next sibling
                let sibling = el.nextSibling;
                while (sibling) {
                  if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim()) {
                    return sibling.textContent.trim();
                  } else if (sibling.nodeType === Node.ELEMENT_NODE && sibling.textContent.trim()) {
                    return sibling.textContent.trim();
                  }
                  sibling = sibling.nextSibling;
                }
                
                return 'Unknown option';
              });
            }
            
            // Clean up option text
            optionText = optionText.trim().replace(/\s+/g, ' ');
            
            // Get option value
            const optionValue = await optionElement.evaluate(el => el.value);
            
            options.push({
              text: optionText,
              value: optionValue,
              type: await optionElement.evaluate(el => el.type),
              selector: await optionElement.evaluate(el => {
                // Create a selector that can be used to click this option later
                if (el.id) return `#${el.id}`;
                if (el.name) return `input[name="${el.name}"][value="${el.value}"]`;
                return null;
              })
            });
          }
          
          // If no options found with inputs, try looking for option divs/spans
          if (options.length === 0) {
            const optionDivs = await container.$$('.option, .answer-option, .answer-choice, .choice');
            
            for (let j = 0; j < optionDivs.length; j++) {
              const optionDiv = optionDivs[j];
              const optionText = await optionDiv.textContent();
              
              options.push({
                text: optionText.trim().replace(/\s+/g, ' '),
                value: `option-${j}`,
                type: 'option-div',
                selector: await optionDiv.evaluate(el => {
                  if (el.id) return `#${el.id}`;
                  // Create a more complex selector based on class and content
                  const classes = Array.from(el.classList).join('.');
                  if (classes) return `.${classes}`;
                  return null;
                })
              });
            }
          }
          
          questions.push({
            questionNumber: i + 1,
            text: questionText,
            options: options,
            type: options.length > 0 ? (options[0].type === 'checkbox' ? 'multiple-select' : 'multiple-choice') : 'unknown'
          });
        }
      } else {
        // Strategy 2: If no containers, try to infer questions from the page structure
        sendLog('No question containers found, trying alternative extraction method', 'warning');
        
        // Get all radio buttons and group by name
        const radioGroups = await page.evaluate(() => {
          const radios = document.querySelectorAll('input[type="radio"]');
          const groups = {};
          
          radios.forEach(radio => {
            if (!radio.name) return;
            
            if (!groups[radio.name]) {
              groups[radio.name] = [];
            }
            
            // Try to find the question text
            let questionText = 'Unknown question';
            let currentElement = radio;
            
            // Look up the DOM tree for potential question text
            while (currentElement && currentElement.tagName !== 'BODY') {
              currentElement = currentElement.parentElement;
              
              // Check if this element contains the question
              if (currentElement.querySelector('input[type="radio"]') !== radio) {
                // We've gone too far up, this element contains other questions
                break;
              }
              
              // Look for elements that might contain the question
              const potentialQuestions = currentElement.querySelectorAll('p, h3, h4, .question, .question-text');
              for (const el of potentialQuestions) {
                if (el.textContent.trim() && !el.querySelector('input')) {
                  questionText = el.textContent.trim();
                  break;
                }
              }
              
              if (questionText !== 'Unknown question') break;
            }
            
            // Try to find the option text
            let optionText = 'Unknown option';
            
            // Check for label
            if (radio.id) {
              const label = document.querySelector(`label[for="${radio.id}"]`);
              if (label) {
                optionText = label.textContent.trim();
              }
            }
            
            // If no label, check parent or siblings
            if (optionText === 'Unknown option') {
              if (radio.parentElement && radio.parentElement.textContent.trim()) {
                optionText = radio.parentElement.textContent.trim();
              } else {
                let sibling = radio.nextSibling;
                while (sibling) {
                  if (sibling.nodeType === Node.TEXT_NODE && sibling.textContent.trim()) {
                    optionText = sibling.textContent.trim();
                    break;
                  } else if (sibling.nodeType === Node.ELEMENT_NODE && sibling.textContent.trim()) {
                    optionText = sibling.textContent.trim();
                    break;
                  }
                  sibling = sibling.nextSibling;
                }
              }
            }
            
            groups[radio.name].push({
              questionText,
              optionText,
              value: radio.value,
              id: radio.id,
              selector: radio.id ? `#${radio.id}` : `input[name="${radio.name}"][value="${radio.value}"]`
            });
          });
          
          return groups;
        });
        
        // Convert radio groups to questions
        let questionNumber = 1;
        for (const [name, options] of Object.entries(radioGroups)) {
          if (options.length === 0) continue;
          
          // Use the first option's question text
          const questionText = options[0].questionText;
          
          questions.push({
            questionNumber: questionNumber++,
            text: questionText,
            options: options.map(opt => ({
              text: opt.optionText,
              value: opt.value,
              type: 'radio',
              selector: opt.selector
            })),
            type: 'multiple-choice'
          });
        }
      }
    } else if (quizInfo.quizType === 'free-response') {
      // Extract free response questions
      const textareaElements = await page.$$('textarea');
      
      for (let i = 0; i < textareaElements.length; i++) {
        const textarea = textareaElements[i];
        
        // Try to find the associated question
        const questionText = await textarea.evaluate(el => {
          // Look for label
          if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label) return label.textContent.trim();
          }
          
          // Look for nearby question text
          let currentElement = el;
          while (currentElement && currentElement.tagName !== 'BODY') {
            currentElement = currentElement.parentElement;
            
            // Look for elements that might contain the question
            const potentialQuestions = currentElement.querySelectorAll('p, h3, h4, .question, .question-text');
            for (const qEl of potentialQuestions) {
              if (qEl.textContent.trim() && !qEl.querySelector('textarea')) {
                return qEl.textContent.trim();
              }
            }
          }
          
          return 'Unknown question';
        });
        
        questions.push({
          questionNumber: i + 1,
          text: questionText,
          type: 'free-response',
          selector: await textarea.evaluate(el => {
            if (el.id) return `#${el.id}`;
            if (el.name) return `textarea[name="${el.name}"]`;
            return `textarea:nth-of-type(${i + 1})`;
          })
        });
      }
    } else if (quizInfo.quizType === 'fill-in-blank') {
      // Extract fill-in-blank questions
      const inputElements = await page.$$('input[type="text"]');
      
      for (let i = 0; i < inputElements.length; i++) {
        const input = inputElements[i];
        
        // Try to find the associated question
        const questionText = await input.evaluate(el => {
          // Look for label
          if (el.id) {
            const label = document.querySelector(`label[for="${el.id}"]`);
            if (label) return label.textContent.trim();
          }
          
          // Look for nearby question text
          let currentElement = el;
          while (currentElement && currentElement.tagName !== 'BODY') {
            currentElement = currentElement.parentElement;
            
            // Look for elements that might contain the question
            const potentialQuestions = currentElement.querySelectorAll('p, h3, h4, .question, .question-text');
            for (const qEl of potentialQuestions) {
              if (qEl.textContent.trim() && !qEl.querySelector('input[type="text"]')) {
                return qEl.textContent.trim();
              }
            }
          }
          
          return 'Unknown question';
        });
        
        questions.push({
          questionNumber: i + 1,
          text: questionText,
          type: 'fill-in-blank',
          selector: await input.evaluate(el => {
            if (el.id) return `#${el.id}`;
            if (el.name) return `input[name="${el.name}"]`;
            return `input[type="text"]:nth-of-type(${i + 1})`;
          })
        });
      }
    }
    
    sendLog(`Extracted ${questions.length} questions from the quiz`, 'success');
    return questions;
  } catch (error) {
    logger.error('Error extracting quiz questions:', error);
    if (logCallback) logCallback(`Error extracting quiz questions: ${error.message}`, 'error');
    return [];
  }
}

/**
 * Answer a quiz question using LangChain
 * @param {Object} question - Question object from extractQuizQuestions
 * @param {string} courseContext - Additional context about the course
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Answer information
 */
async function answerQuizQuestion(question, courseContext = '', logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog(`Generating answer for question: "${question.text.substring(0, 50)}..."`, 'info');
    
    if (question.type === 'multiple-choice' || question.type === 'multiple-select') {
      // For multiple choice, use the LangChain utility
      const mcQuestion = {
        text: question.text,
        options: question.options.map(opt => opt.text)
      };
      
      // Get the selected option index (1-based)
      const selectedIndex = await langchainUtils.answerMultipleChoiceQuestion(mcQuestion, courseContext);
      
      // Convert to 0-based index
      const zeroBasedIndex = selectedIndex - 1;
      
      // Ensure the index is valid
      if (zeroBasedIndex >= 0 && zeroBasedIndex < question.options.length) {
        const selectedOption = question.options[zeroBasedIndex];
        
        sendLog(`Selected answer: "${selectedOption.text.substring(0, 30)}..."`, 'success');
        
        return {
          success: true,
          selectedOption,
          selectedIndex: zeroBasedIndex,
          confidence: 'high' // We could implement confidence scoring in the future
        };
      } else {
        sendLog(`Invalid option index ${selectedIndex} for question with ${question.options.length} options`, 'error');
        
        // Fall back to first option
        return {
          success: false,
          selectedOption: question.options[0],
          selectedIndex: 0,
          confidence: 'low',
          error: 'Invalid option index'
        };
      }
    } else if (question.type === 'free-response') {
      // For free response, generate a text answer
      const response = await langchainUtils.generateAssignmentResponse(question.text, courseContext);
      
      sendLog(`Generated free response answer (${response.length} characters)`, 'success');
      
      return {
        success: true,
        responseText: response,
        confidence: 'medium'
      };
    } else if (question.type === 'fill-in-blank') {
      // For fill-in-blank, generate a short answer
      // Modify the prompt to indicate we need a very short answer
      const shortAnswerPrompt = `${question.text} (Please provide a very brief answer, preferably a single word or short phrase)`;
      const response = await langchainUtils.generateAssignmentResponse(shortAnswerPrompt, courseContext);
      
      // Extract just the first line or sentence
      let shortResponse = response.split('\n')[0].trim();
      if (shortResponse.length > 50) {
        shortResponse = shortResponse.substring(0, 50);
      }
      
      sendLog(`Generated fill-in-blank answer: "${shortResponse}"`, 'success');
      
      return {
        success: true,
        responseText: shortResponse,
        confidence: 'medium'
      };
    }
    
    sendLog(`Unsupported question type: ${question.type}`, 'error');
    return {
      success: false,
      error: `Unsupported question type: ${question.type}`
    };
  } catch (error) {
    logger.error('Error answering quiz question:', error);
    if (logCallback) logCallback(`Error answering quiz question: ${error.message}`, 'error');
    
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Submit an answer to a quiz question
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Object} question - Question object from extractQuizQuestions
 * @param {Object} answer - Answer object from answerQuizQuestion
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether the answer was submitted successfully
 */
async function submitQuizAnswer(page, question, answer, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog(`Submitting answer for question ${question.questionNumber}`, 'info');
    
    if (!answer.success) {
      sendLog(`Cannot submit answer: ${answer.error}`, 'error');
      return false;
    }
    
    if (question.type === 'multiple-choice') {
      // Click the selected radio button
      const selectedOption = answer.selectedOption;
      
      if (!selectedOption || !selectedOption.selector) {
        sendLog('Cannot submit answer: No selector available for the selected option', 'error');
        return false;
      }
      
      // Use the retry handler for more reliable clicking
      const clickSuccess = await retryHandler.retryElementInteraction(
        page,
        selectedOption.selector,
        async (selector = selectedOption.selector) => {
          // Use human-like clicking
          await antiBot.humanLikeClick(page, selector);
        },
        {
          maxRetries: 3,
          initialDelay: 1000,
          alternativeSelectors: [
            // Try alternative selectors if the primary one fails
            `input[value="${selectedOption.value}"]`,
            `label:has-text("${selectedOption.text.substring(0, 20)}")`
          ]
        },
        logCallback
      );
      
      if (clickSuccess) {
        sendLog(`Successfully selected answer option for question ${question.questionNumber}`, 'success');
        return true;
      } else {
        sendLog(`Failed to select answer option for question ${question.questionNumber}`, 'error');
        return false;
      }
    } else if (question.type === 'multiple-select') {
      // For multiple select, we'd need to handle multiple selections
      // This is a simplified version that just selects one option
      const selectedOption = answer.selectedOption;
      
      if (!selectedOption || !selectedOption.selector) {
        sendLog('Cannot submit answer: No selector available for the selected option', 'error');
        return false;
      }
      
      const clickSuccess = await retryHandler.retryElementInteraction(
        page,
        selectedOption.selector,
        async (selector = selectedOption.selector) => {
          await antiBot.humanLikeClick(page, selector);
        },
        {
          maxRetries: 3,
          initialDelay: 1000
        },
        logCallback
      );
      
      if (clickSuccess) {
        sendLog(`Successfully selected answer option for question ${question.questionNumber}`, 'success');
        return true;
      } else {
        sendLog(`Failed to select answer option for question ${question.questionNumber}`, 'error');
        return false;
      }
    } else if (question.type === 'free-response' || question.type === 'fill-in-blank') {
      // Type the response into the text field
      if (!question.selector) {
        sendLog('Cannot submit answer: No selector available for the text field', 'error');
        return false;
      }
      
      const typeSuccess = await retryHandler.retryElementInteraction(
        page,
        question.selector,
        async (selector = question.selector) => {
          // Use human-like typing
          await antiBot.humanLikeType(page, selector, answer.responseText);
        },
        {
          maxRetries: 3,
          initialDelay: 1000
        },
        logCallback
      );
      
      if (typeSuccess) {
        sendLog(`Successfully entered text response for question ${question.questionNumber}`, 'success');
        return true;
      } else {
        sendLog(`Failed to enter text response for question ${question.questionNumber}`, 'error');
        return false;
      }
    }
    
    sendLog(`Unsupported question type: ${question.type}`, 'error');
    return false;
  } catch (error) {
    logger.error('Error submitting quiz answer:', error);
    if (logCallback) logCallback(`Error submitting quiz answer: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Submit the entire quiz
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<boolean>} - Whether the quiz was submitted successfully
 */
async function submitQuiz(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Attempting to submit the quiz...', 'info');
    
    // Common submit button selectors
    const submitSelectors = [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("Submit")',
      'button:has-text("Submit Quiz")',
      'button:has-text("Submit Exam")',
      'button:has-text("Finish")',
      'button:has-text("Complete")',
      'a:has-text("Submit")',
      '.submit-button',
      '.quiz-submit',
      '.exam-submit',
      '#submit-quiz',
      '#submit-exam',
      '#finish-quiz',
      '#complete-quiz'
    ];
    
    // Try each selector
    for (const selector of submitSelectors) {
      const button = await page.$(selector);
      if (button) {
        sendLog(`Found submit button: ${selector}`, 'info');
        
        // Check if the button is enabled
        const isDisabled = await button.evaluate(el => {
          return el.disabled || 
                 el.getAttribute('aria-disabled') === 'true' || 
                 el.classList.contains('disabled') ||
                 getComputedStyle(el).opacity < 0.5;
        });
        
        if (isDisabled) {
          sendLog('Submit button is disabled, checking for remaining required fields', 'warning');
          
          // Check for unfilled required fields
          const requiredFields = await page.$$('input[required]:not([value]), textarea[required]:empty, select[required] option:not([selected])');
          if (requiredFields.length > 0) {
            sendLog(`Found ${requiredFields.length} unfilled required fields`, 'warning');
          }
          
          continue; // Try the next selector
        }
        
        // Use the retry handler for more reliable clicking
        const clickSuccess = await retryHandler.retryElementInteraction(
          page,
          selector,
          async (sel = selector) => {
            // Use human-like clicking
            await antiBot.humanLikeClick(page, sel);
          },
          {
            maxRetries: 3,
            initialDelay: 1000
          },
          logCallback
        );
        
        if (clickSuccess) {
          sendLog('Successfully clicked submit button', 'success');
          
          // Wait for navigation or confirmation
          try {
            // Wait for either a success message or a new page
            await Promise.race([
              page.waitForNavigation({ timeout: 10000 }).catch(() => {}),
              page.waitForSelector('.success-message, .confirmation, .quiz-results, .exam-results', { timeout: 10000 }).catch(() => {})
            ]);
            
            // Check if we have a success indicator
            const successIndicator = await page.$('.success-message, .confirmation, .quiz-results, .exam-results, .quiz-complete, .exam-complete');
            if (successIndicator) {
              sendLog('Quiz submission confirmed successful', 'success');
              return true;
            }
            
            // If no explicit success indicator, assume it worked if we navigated
            sendLog('Quiz appears to be submitted successfully', 'success');
            return true;
          } catch (waitError) {
            // If waiting timed out, check if the button is gone
            const buttonStillExists = await page.$(selector);
            if (!buttonStillExists) {
              sendLog('Submit button no longer present, assuming submission was successful', 'success');
              return true;
            }
            
            sendLog('No confirmation of successful submission, but proceeding', 'warning');
            return true;
          }
        }
      }
    }
    
    // If we get here, we couldn't find or click any submit button
    sendLog('Could not find or click any submit button', 'error');
    
    // Take a screenshot for debugging
    const screenshotPath = `../artifacts/screenshots/quiz-submit-failed-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true });
    sendLog(`Screenshot saved to ${screenshotPath}`, 'info');
    
    return false;
  } catch (error) {
    logger.error('Error submitting quiz:', error);
    if (logCallback) logCallback(`Error submitting quiz: ${error.message}`, 'error');
    return false;
  }
}

/**
 * Check quiz results and determine if passed
 * @param {import('playwright').Page} page - Playwright page object
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Quiz results
 */
async function checkQuizResults(page, logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Checking quiz results...', 'info');
    
    // Look for result indicators
    const resultIndicators = [
      '.quiz-results',
      '.exam-results',
      '.results-container',
      '.score-container',
      '.grade-container',
      '.feedback-container',
      '.quiz-feedback',
      '.quiz-score',
      '.exam-score',
      '.quiz-grade',
      '.exam-grade'
    ];
    
    let resultsElement = null;
    
    for (const selector of resultIndicators) {
      const element = await page.$(selector);
      if (element) {
        resultsElement = element;
        break;
      }
    }
    
    if (!resultsElement) {
      sendLog('Could not find quiz results on the page', 'warning');
      
      // Check if there's any text indicating results
      const pageText = await page.evaluate(() => document.body.innerText);
      if (pageText.includes('score') || pageText.includes('grade') || pageText.includes('result') || 
          pageText.includes('passed') || pageText.includes('failed')) {
        sendLog('Found text that might indicate results, but no specific results container', 'info');
      } else {
        sendLog('No indication of quiz results found', 'warning');
        return {
          found: false,
          passed: null,
          score: null,
          feedback: null
        };
      }
    }
    
    // Extract score information
    let score = null;
    let passed = null;
    let feedback = null;
    
    // Method 1: Look for specific score elements
    const scoreElement = await page.$('.score, .grade, .result, .points, .percentage');
    if (scoreElement) {
      const scoreText = await scoreElement.textContent();
      
      // Try to extract a numeric score
      const scoreMatch = scoreText.match(/(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)/);
      if (scoreMatch) {
        const [_, earned, __, total] = scoreMatch;
        score = {
          earned: parseFloat(earned),
          total: parseFloat(total),
          percentage: (parseFloat(earned) / parseFloat(total)) * 100
        };
      } else {
        // Try to extract a percentage
        const percentMatch = scoreText.match(/(\d+(\.\d+)?)\s*%/);
        if (percentMatch) {
          score = {
            percentage: parseFloat(percentMatch[1])
          };
        } else {
          // Just use the raw text
          score = {
            text: scoreText.trim()
          };
        }
      }
    }
    
    // Method 2: If no specific score element, evaluate the page
    if (!score) {
      score = await page.evaluate(() => {
        // Look for text containing score information
        const bodyText = document.body.innerText;
        
        // Try to find score pattern (X/Y)
        const scoreMatch = bodyText.match(/(\d+(\.\d+)?)\s*\/\s*(\d+(\.\d+)?)/);
        if (scoreMatch) {
          return {
            earned: parseFloat(scoreMatch[1]),
            total: parseFloat(scoreMatch[3]),
            percentage: (parseFloat(scoreMatch[1]) / parseFloat(scoreMatch[3])) * 100
          };
        }
        
        // Try to find percentage pattern
        const percentMatch = bodyText.match(/(\d+(\.\d+)?)\s*%/);
        if (percentMatch) {
          return {
            percentage: parseFloat(percentMatch[1])
          };
        }
        
        // Try to find "You scored X points" pattern
        const pointsMatch = bodyText.match(/scored\s+(\d+(\.\d+)?)\s+points/i);
        if (pointsMatch) {
          return {
            points: parseFloat(pointsMatch[1])
          };
        }
        
        return null;
      });
    }
    
    // Determine if passed
    if (score) {
      passed = await page.evaluate((scoreData) => {
        const bodyText = document.body.innerText.toLowerCase();
        
        // Check for explicit pass/fail messages
        if (bodyText.includes('passed') || bodyText.includes('congratulations') || 
            bodyText.includes('well done') || bodyText.includes('success')) {
          return true;
        }
        
        if (bodyText.includes('failed') || bodyText.includes('not passed') || 
            bodyText.includes('try again') || bodyText.includes('unsuccessful')) {
          return false;
        }
        
        // If we have a percentage, assume 70% is passing (common threshold)
        if (scoreData.percentage !== undefined) {
          return scoreData.percentage >= 70;
        }
        
        // If we have earned/total, calculate percentage
        if (scoreData.earned !== undefined && scoreData.total !== undefined) {
          return (scoreData.earned / scoreData.total) >= 0.7;
        }
        
        // Can't determine
        return null;
      }, score);
    }
    
    // Extract feedback
    const feedbackElement = await page.$('.feedback, .comments, .instructor-feedback');
    if (feedbackElement) {
      feedback = await feedbackElement.textContent();
    }
    
    // Log the results
    if (score) {
      if (score.percentage !== undefined) {
        sendLog(`Quiz score: ${score.percentage.toFixed(1)}%`, passed ? 'success' : 'warning');
      } else if (score.earned !== undefined && score.total !== undefined) {
        sendLog(`Quiz score: ${score.earned}/${score.total} (${((score.earned / score.total) * 100).toFixed(1)}%)`, passed ? 'success' : 'warning');
      } else if (score.text) {
        sendLog(`Quiz score: ${score.text}`, 'info');
      }
    }
    
    if (passed !== null) {
      sendLog(`Quiz result: ${passed ? 'PASSED' : 'FAILED'}`, passed ? 'success' : 'error');
    }
    
    if (feedback) {
      sendLog(`Feedback: ${feedback}`, 'info');
    }
    
    // Take a screenshot of the results
    const screenshotPath = `../artifacts/screenshots/quiz-results-${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    sendLog(`Results screenshot saved to ${screenshotPath}`, 'info');
    
    return {
      found: true,
      passed,
      score,
      feedback
    };
  } catch (error) {
    logger.error('Error checking quiz results:', error);
    if (logCallback) logCallback(`Error checking quiz results: ${error.message}`, 'error');
    
    return {
      found: false,
      error: error.message
    };
  }
}

/**
 * Complete a quiz or exam
 * @param {import('playwright').Page} page - Playwright page object
 * @param {string} courseContext - Additional context about the course
 * @param {Function} logCallback - Callback for sending logs to the client
 * @returns {Promise<Object>} - Quiz completion results
 */
async function completeQuiz(page, courseContext = '', logCallback = null) {
  try {
    const sendLog = (message, type = 'info') => {
      logger.info(message);
      if (logCallback) logCallback(message, type);
    };

    sendLog('Starting quiz completion process...', 'info');
    
    // Detect if this is a quiz page
    const quizInfo = await detectQuizContent(page, logCallback);
    
    if (!quizInfo.isQuiz) {
      sendLog('This does not appear to be a quiz page', 'warning');
      return {
        success: false,
        error: 'Not a quiz page'
      };
    }
    
    sendLog(`Detected ${quizInfo.isExam ? 'exam' : 'quiz'} with ${quizInfo.questionCount} questions`, 'info');
    
    // Extract questions
    const questions = await extractQuizQuestions(page, quizInfo, logCallback);
    
    if (questions.length === 0) {
      sendLog('Could not extract any questions from the quiz', 'error');
      return {
        success: false,
        error: 'No questions extracted'
      };
    }
    
    sendLog(`Successfully extracted ${questions.length} questions`, 'success');
    
    // Process each question
    let answeredCount = 0;
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      
      sendLog(`Processing question ${i + 1} of ${questions.length}: "${question.text.substring(0, 50)}..."`, 'info');
      
      // Generate answer
      const answer = await answerQuizQuestion(question, courseContext, logCallback);
      
      if (!answer.success) {
        sendLog(`Failed to generate answer for question ${i + 1}: ${answer.error}`, 'error');
        continue;
      }
      
      // Submit the answer
      const submitSuccess = await submitQuizAnswer(page, question, answer, logCallback);
      
      if (submitSuccess) {
        answeredCount++;
      } else {
        sendLog(`Failed to submit answer for question ${i + 1}`, 'error');
      }
      
      // Add a small delay between questions to appear more human-like
      await page.waitForTimeout(antiBot.getRandomDelay(1000, 3000));
    }
    
    sendLog(`Successfully answered ${answeredCount} out of ${questions.length} questions`, answeredCount === questions.length ? 'success' : 'warning');
    
    // Submit the quiz
    const submitSuccess = await submitQuiz(page, logCallback);
    
    if (!submitSuccess) {
      sendLog('Failed to submit the quiz', 'error');
      return {
        success: false,
        answeredCount,
        totalQuestions: questions.length,
        error: 'Failed to submit quiz'
      };
    }
    
    // Check results
    const results = await checkQuizResults(page, logCallback);
    
    return {
      success: true,
      answeredCount,
      totalQuestions: questions.length,
      submitted: submitSuccess,
      results
    };
  } catch (error) {
    logger.error('Error completing quiz:', error);
    if (logCallback) logCallback(`Error completing quiz: ${error.message}`, 'error');
    
    return {
      success: false,
      error: error.message
    };
  }
}

module.exports = {
  detectQuizContent,
  extractQuizQuestions,
  answerQuizQuestion,
  submitQuizAnswer,
  submitQuiz,
  checkQuizResults,
  completeQuiz
};