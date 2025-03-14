/**
 * Example script demonstrating how to use the LangChain integration
 * with the LMS automation system.
 */
const { chromium } = require('@playwright/test');
const langchainUtils = require('../utils/langchain-utils');
const lmsAutomation = require('../core/lms-automation');
const config = require('../config/default');

// Configure logging
const winston = require('winston');
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'langchain-example' },
  transports: [
    new winston.transports.File({ filename: '../../log/example-error.log', level: 'error' }),
    new winston.transports.File({ filename: '../../log/example-combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

/**
 * Example 1: Analyze a sample assignment
 */
async function exampleAnalyzeAssignment() {
  logger.info('Running Example 1: Analyze a sample assignment');
  
  const sampleAssignment = `
    Assignment: Introduction to Artificial Intelligence
    
    In this assignment, you will explore the fundamentals of artificial intelligence.
    Write a 500-word essay discussing the ethical implications of AI in healthcare.
    
    Consider the following points:
    - Patient privacy and data security
    - Decision-making autonomy
    - Potential biases in AI algorithms
    - The role of human oversight
    
    Due date: March 20, 2025
  `;
  
  try {
    // Assess the assignment using LangChain
    const assessment = await langchainUtils.assessAssignment(sampleAssignment);
    logger.info('Assignment assessment:', assessment);
    
    // Generate a response to the assignment
    const response = await langchainUtils.generateAssignmentResponse(sampleAssignment);
    logger.info('Generated response sample (first 100 chars):', response.substring(0, 100) + '...');
    
    return { assessment, response };
  } catch (error) {
    logger.error('Error in Example 1:', error);
    throw error;
  }
}

/**
 * Example 2: Answer multiple-choice questions
 */
async function exampleMultipleChoice() {
  logger.info('Running Example 2: Answer multiple-choice questions');
  
  const sampleQuestion = {
    text: "Which of the following is NOT a common application of machine learning?",
    options: [
      "Image recognition",
      "Natural language processing",
      "Mechanical engineering design",
      "Recommendation systems"
    ]
  };
  
  try {
    // Use LangChain to answer the question
    const selectedOption = await langchainUtils.answerMultipleChoiceQuestion(sampleQuestion);
    logger.info(`Selected option ${selectedOption}: ${sampleQuestion.options[selectedOption - 1]}`);
    
    return { selectedOption, selectedText: sampleQuestion.options[selectedOption - 1] };
  } catch (error) {
    logger.error('Error in Example 2:', error);
    throw error;
  }
}

/**
 * Example 3: Integrate with browser automation
 */
async function exampleBrowserAutomation() {
  logger.info('Running Example 3: Integrate with browser automation');
  
  const browser = await chromium.launch({
    headless: config.browser.headless,
    slowMo: config.browser.slowMo,
  });
  
  const context = await browser.newContext({
    viewport: config.browser.viewport,
  });
  
  const page = await context.newPage();
  
  try {
    // Create a simple HTML page with a form to simulate an LMS assignment
    await page.setContent(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Sample LMS Assignment</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .assignment-content { border: 1px solid #ccc; padding: 20px; margin-bottom: 20px; }
          .assignment-prompt { font-weight: bold; }
          textarea { width: 100%; height: 150px; margin-top: 10px; }
          button { padding: 10px 20px; background-color: #4CAF50; color: white; border: none; cursor: pointer; }
        </style>
      </head>
      <body>
        <h1>Course: Introduction to AI</h1>
        <div class="assignment-content">
          <h2>Assignment: Ethical Implications of AI</h2>
          <div class="assignment-prompt">
            Write a 300-word response discussing the ethical implications of AI in modern society.
            Consider issues such as privacy, bias, and accountability.
          </div>
          <form id="assignment-form">
            <textarea name="response" placeholder="Enter your response here..."></textarea>
            <button type="submit">Submit Assignment</button>
          </form>
        </div>
      </body>
      </html>
    `);
    
    // Extract the assignment prompt
    const promptElement = await page.$('.assignment-prompt');
    const assignmentPrompt = await promptElement.textContent();
    
    // Use LangChain to generate a response
    logger.info('Generating response for assignment prompt');
    const response = await langchainUtils.generateAssignmentResponse(assignmentPrompt);
    
    // Fill in the response and submit the form
    await page.fill('textarea[name="response"]', response);
    
    // Take a screenshot before submitting
    await page.screenshot({ path: '../../artifacts/screenshots/before-submit.png' });
    logger.info('Screenshot saved to ../../artifacts/screenshots/before-submit.png');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    logger.info('Assignment submitted successfully');
    
    // Close the browser
    await browser.close();
    
    return { success: true, response: response.substring(0, 100) + '...' };
  } catch (error) {
    logger.error('Error in Example 3:', error);
    await browser.close();
    throw error;
  }
}

/**
 * Run all examples
 */
async function runAllExamples() {
  logger.info('Starting LangChain integration examples');
  
  try {
    // Run Example 1
    const example1Result = await exampleAnalyzeAssignment();
    logger.info('Example 1 completed successfully');
    
    // Run Example 2
    const example2Result = await exampleMultipleChoice();
    logger.info('Example 2 completed successfully');
    
    // Run Example 3
    const example3Result = await exampleBrowserAutomation();
    logger.info('Example 3 completed successfully');
    
    logger.info('All examples completed successfully');
    
    return {
      example1: example1Result,
      example2: example2Result,
      example3: example3Result
    };
  } catch (error) {
    logger.error('Error running examples:', error);
    process.exit(1);
  }
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(error => {
    logger.error('Unhandled error in examples:', error);
    process.exit(1);
  });
}

module.exports = {
  exampleAnalyzeAssignment,
  exampleMultipleChoice,
  exampleBrowserAutomation,
  runAllExamples
};