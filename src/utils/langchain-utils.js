/**
 * Utility functions for integrating LangChain with the automation system
 */
const { ChatOpenAI } = require("langchain/chat_models/openai");
const { PromptTemplate } = require("langchain/prompts");
const { StringOutputParser } = require("langchain/schema/output_parser");
const { RunnableSequence } = require("langchain/schema/runnable");
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'langchain-utils' },
  transports: [
    new winston.transports.File({ filename: '../log/langchain-error.log', level: 'error' }),
    new winston.transports.File({ filename: '../log/langchain-combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Initialize the OpenAI chat model
const chatModel = new ChatOpenAI({
  openAIApiKey: process.env.OPENAI_API_KEY,
  temperature: 0.7,
  modelName: "gpt-4", // or any other model you prefer
});

/**
 * Analyze course content and extract key information
 * @param {string} courseContent - The HTML or text content of the course page
 * @returns {Promise<Object>} - Extracted information about the course
 */
async function analyzeCourseContent(courseContent) {
  try {
    logger.info('Analyzing course content');
    
    const promptTemplate = PromptTemplate.fromTemplate(
      `You are an AI assistant helping to analyze course content from an LMS.
      Extract the following information from the provided content:
      - Course title
      - Course description
      - List of assignments with due dates
      - Any time-gated content and when it will be available
      
      Course content:
      {courseContent}
      
      Provide the information in a structured JSON format.`
    );
    
    const chain = RunnableSequence.from([
      promptTemplate,
      chatModel,
      new StringOutputParser(),
    ]);
    
    const result = await chain.invoke({
      courseContent: courseContent,
    });
    
    // Parse the result as JSON
    const parsedResult = JSON.parse(result);
    logger.info('Successfully analyzed course content');
    
    return parsedResult;
  } catch (error) {
    logger.error('Error analyzing course content:', error);
    throw error;
  }
}

/**
 * Generate a response for a text-based assignment
 * @param {string} assignmentPrompt - The prompt or question for the assignment
 * @param {string} courseContext - Additional context about the course
 * @returns {Promise<string>} - Generated response for the assignment
 */
async function generateAssignmentResponse(assignmentPrompt, courseContext = '') {
  try {
    logger.info('Generating assignment response');
    
    const promptTemplate = PromptTemplate.fromTemplate(
      `You are a student completing an assignment for a course.
      
      Course context: {courseContext}
      
      Assignment prompt: {assignmentPrompt}
      
      Provide a well-thought-out, original response to this assignment. 
      The response should demonstrate understanding of the subject matter 
      and critical thinking. Keep the tone academic and professional.`
    );
    
    const chain = RunnableSequence.from([
      promptTemplate,
      chatModel,
      new StringOutputParser(),
    ]);
    
    const result = await chain.invoke({
      assignmentPrompt: assignmentPrompt,
      courseContext: courseContext,
    });
    
    logger.info('Successfully generated assignment response');
    return result;
  } catch (error) {
    logger.error('Error generating assignment response:', error);
    throw error;
  }
}

/**
 * Answer multiple-choice questions based on provided options
 * @param {Object} question - The question object with text and options
 * @param {string} courseContext - Additional context about the course
 * @returns {Promise<string>} - The selected answer option
 */
async function answerMultipleChoiceQuestion(question, courseContext = '') {
  try {
    logger.info('Answering multiple-choice question');
    
    const options = question.options.map((opt, index) => `${index + 1}. ${opt}`).join('\n');
    
    const promptTemplate = PromptTemplate.fromTemplate(
      `You are a student taking a quiz in a course.
      
      Course context: {courseContext}
      
      Question: {questionText}
      
      Options:
      {options}
      
      Analyze the question and options carefully. Select the most correct answer.
      Provide your answer as the option number only (e.g., "1" or "2" etc.).`
    );
    
    const chain = RunnableSequence.from([
      promptTemplate,
      chatModel,
      new StringOutputParser(),
    ]);
    
    const result = await chain.invoke({
      questionText: question.text,
      options: options,
      courseContext: courseContext,
    });
    
    // Extract just the number from the response
    const answerNumber = result.match(/\d+/)[0];
    const selectedOption = parseInt(answerNumber, 10);
    
    logger.info(`Selected option ${selectedOption} for multiple-choice question`);
    return selectedOption;
  } catch (error) {
    logger.error('Error answering multiple-choice question:', error);
    throw error;
  }
}

/**
 * Determine if an assignment is completable based on its content and requirements
 * @param {string} assignmentContent - The content of the assignment page
 * @returns {Promise<Object>} - Assessment of the assignment
 */
async function assessAssignment(assignmentContent) {
  try {
    logger.info('Assessing assignment');
    
    const promptTemplate = PromptTemplate.fromTemplate(
      `You are an AI assistant helping to assess an assignment from an LMS.
      
      Assignment content:
      {assignmentContent}
      
      Analyze this assignment and provide the following information:
      1. Type of assignment (essay, multiple choice, file upload, etc.)
      2. Estimated time to complete
      3. Whether it appears to be time-gated or locked
      4. Any prerequisites mentioned
      5. Due date if specified
      
      Provide the information in a structured JSON format.`
    );
    
    const chain = RunnableSequence.from([
      promptTemplate,
      chatModel,
      new StringOutputParser(),
    ]);
    
    const result = await chain.invoke({
      assignmentContent: assignmentContent,
    });
    
    // Parse the result as JSON
    const parsedResult = JSON.parse(result);
    logger.info('Successfully assessed assignment');
    
    return parsedResult;
  } catch (error) {
    logger.error('Error assessing assignment:', error);
    throw error;
  }
}

module.exports = {
  analyzeCourseContent,
  generateAssignmentResponse,
  answerMultipleChoiceQuestion,
  assessAssignment,
};