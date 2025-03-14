"""
Example script demonstrating how to use the Python LangChain integration
with the LMS automation system.
"""

import os
import json
import logging
import asyncio
from playwright.async_api import async_playwright

# Import the LangChain integration
import sys
sys.path.append('..')  # Add parent directory to path
import langchain_integration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../../log/python-example.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('langchain-python-example')

async def example_analyze_assignment():
    """
    Example 1: Analyze a sample assignment
    """
    logger.info('Running Example 1: Analyze a sample assignment')
    
    sample_assignment = """
    Assignment: Introduction to Artificial Intelligence
    
    In this assignment, you will explore the fundamentals of artificial intelligence.
    Write a 500-word essay discussing the ethical implications of AI in healthcare.
    
    Consider the following points:
    - Patient privacy and data security
    - Decision-making autonomy
    - Potential biases in AI algorithms
    - The role of human oversight
    
    Due date: March 20, 2025
    """
    
    try:
        # Assess the assignment using LangChain
        assessment = langchain_integration.assess_assignment(sample_assignment)
        logger.info(f'Assignment assessment: {json.dumps(assessment, indent=2)}')
        
        # Generate a response to the assignment
        response = langchain_integration.generate_assignment_response(sample_assignment)
        logger.info(f'Generated response sample (first 100 chars): {response[:100]}...')
        
        return {'assessment': assessment, 'response': response[:100] + '...'}
    except Exception as e:
        logger.error(f'Error in Example 1: {str(e)}')
        raise

async def example_multiple_choice():
    """
    Example 2: Answer multiple-choice questions
    """
    logger.info('Running Example 2: Answer multiple-choice questions')
    
    sample_question = {
        'text': "Which of the following is NOT a common application of machine learning?",
        'options': [
            "Image recognition",
            "Natural language processing",
            "Mechanical engineering design",
            "Recommendation systems"
        ]
    }
    
    try:
        # Use LangChain to answer the question
        selected_option = langchain_integration.answer_multiple_choice_question(sample_question)
        logger.info(f'Selected option {selected_option}: {sample_question["options"][selected_option - 1]}')
        
        return {
            'selected_option': selected_option,
            'selected_text': sample_question['options'][selected_option - 1]
        }
    except Exception as e:
        logger.error(f'Error in Example 2: {str(e)}')
        raise

async def example_browser_automation():
    """
    Example 3: Integrate with browser automation
    """
    logger.info('Running Example 3: Integrate with browser automation')
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1280, 'height': 720})
        page = await context.new_page()
        
        try:
            # Create a simple HTML page with a form to simulate an LMS assignment
            await page.set_content("""
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
            """)
            
            # Extract the assignment prompt
            prompt_element = await page.query_selector('.assignment-prompt')
            assignment_prompt = await prompt_element.text_content()
            
            # Use LangChain to generate a response
            logger.info('Generating response for assignment prompt')
            response = langchain_integration.generate_assignment_response(assignment_prompt)
            
            # Fill in the response and submit the form
            await page.fill('textarea[name="response"]', response)
            
            # Take a screenshot before submitting
            await page.screenshot(path='../../artifacts/screenshots/py-before-submit.png')
            logger.info('Screenshot saved to ../../artifacts/screenshots/py-before-submit.png')
            
            # Submit the form
            await page.click('button[type="submit"]')
            
            logger.info('Assignment submitted successfully')
            
            # Close the browser
            await browser.close()
            
            return {'success': True, 'response': response[:100] + '...'}
        except Exception as e:
            logger.error(f'Error in Example 3: {str(e)}')
            await browser.close()
            raise

async def run_all_examples():
    """
    Run all examples
    """
    logger.info('Starting LangChain Python integration examples')
    
    try:
        # Run Example 1
        example1_result = await example_analyze_assignment()
        logger.info('Example 1 completed successfully')
        
        # Run Example 2
        example2_result = await example_multiple_choice()
        logger.info('Example 2 completed successfully')
        
        # Run Example 3
        example3_result = await example_browser_automation()
        logger.info('Example 3 completed successfully')
        
        logger.info('All examples completed successfully')
        
        return {
            'example1': example1_result,
            'example2': example2_result,
            'example3': example3_result
        }
    except Exception as e:
        logger.error(f'Error running examples: {str(e)}')
        sys.exit(1)

if __name__ == "__main__":
    # Check if OpenAI API key is set
    if not os.environ.get('OPENAI_API_KEY'):
        logger.warning('OPENAI_API_KEY environment variable is not set. Examples may fail.')
    
    # Run the examples
    asyncio.run(run_all_examples())