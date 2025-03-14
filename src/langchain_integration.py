"""
Python implementation of LangChain integration for the AI-Course-Automater project.
This file provides utilities for using LangChain with the automation system.
"""

import os
import json
import logging
from typing import Dict, List, Any, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('../log/langchain-python.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger('langchain-integration')

# Import LangChain components
try:
    from langchain.chat_models import ChatOpenAI
    from langchain.prompts import ChatPromptTemplate
    from langchain.schema.output_parser import StrOutputParser
    from langchain.schema.runnable import RunnablePassthrough
except ImportError:
    logger.error("LangChain not installed. Please run: pip install -U langchain")
    raise

# Initialize the OpenAI chat model
chat_model = ChatOpenAI(
    api_key=os.environ.get("OPENAI_API_KEY"),
    temperature=0.7,
    model_name="gpt-4"  # or any other model you prefer
)

def analyze_course_content(course_content: str) -> Dict[str, Any]:
    """
    Analyze course content and extract key information.
    
    Args:
        course_content: The HTML or text content of the course page
        
    Returns:
        Dict containing extracted information about the course
    """
    try:
        logger.info('Analyzing course content')
        
        prompt = ChatPromptTemplate.from_template(
            """You are an AI assistant helping to analyze course content from an LMS.
            Extract the following information from the provided content:
            - Course title
            - Course description
            - List of assignments with due dates
            - Any time-gated content and when it will be available
            
            Course content:
            {course_content}
            
            Provide the information in a structured JSON format."""
        )
        
        chain = (
            {"course_content": RunnablePassthrough()} 
            | prompt 
            | chat_model 
            | StrOutputParser()
        )
        
        result = chain.invoke(course_content)
        
        # Parse the result as JSON
        parsed_result = json.loads(result)
        logger.info('Successfully analyzed course content')
        
        return parsed_result
    except Exception as e:
        logger.error(f'Error analyzing course content: {str(e)}')
        raise

def generate_assignment_response(assignment_prompt: str, course_context: str = '') -> str:
    """
    Generate a response for a text-based assignment.
    
    Args:
        assignment_prompt: The prompt or question for the assignment
        course_context: Additional context about the course
        
    Returns:
        Generated response for the assignment
    """
    try:
        logger.info('Generating assignment response')
        
        prompt = ChatPromptTemplate.from_template(
            """You are a student completing an assignment for a course.
            
            Course context: {course_context}
            
            Assignment prompt: {assignment_prompt}
            
            Provide a well-thought-out, original response to this assignment. 
            The response should demonstrate understanding of the subject matter 
            and critical thinking. Keep the tone academic and professional."""
        )
        
        chain = (
            prompt 
            | chat_model 
            | StrOutputParser()
        )
        
        result = chain.invoke({
            "assignment_prompt": assignment_prompt,
            "course_context": course_context
        })
        
        logger.info('Successfully generated assignment response')
        return result
    except Exception as e:
        logger.error(f'Error generating assignment response: {str(e)}')
        raise

def answer_multiple_choice_question(question: Dict[str, Any], course_context: str = '') -> int:
    """
    Answer multiple-choice questions based on provided options.
    
    Args:
        question: The question object with text and options
        course_context: Additional context about the course
        
    Returns:
        The selected answer option index (1-based)
    """
    try:
        logger.info('Answering multiple-choice question')
        
        options = '\n'.join([f"{i+1}. {opt}" for i, opt in enumerate(question['options'])])
        
        prompt = ChatPromptTemplate.from_template(
            """You are a student taking a quiz in a course.
            
            Course context: {course_context}
            
            Question: {question_text}
            
            Options:
            {options}
            
            Analyze the question and options carefully. Select the most correct answer.
            Provide your answer as the option number only (e.g., "1" or "2" etc.)."""
        )
        
        chain = (
            prompt 
            | chat_model 
            | StrOutputParser()
        )
        
        result = chain.invoke({
            "question_text": question['text'],
            "options": options,
            "course_context": course_context
        })
        
        # Extract just the number from the response
        import re
        answer_number = re.search(r'\d+', result).group(0)
        selected_option = int(answer_number)
        
        logger.info(f'Selected option {selected_option} for multiple-choice question')
        return selected_option
    except Exception as e:
        logger.error(f'Error answering multiple-choice question: {str(e)}')
        raise

def assess_assignment(assignment_content: str) -> Dict[str, Any]:
    """
    Determine if an assignment is completable based on its content and requirements.
    
    Args:
        assignment_content: The content of the assignment page
        
    Returns:
        Assessment of the assignment
    """
    try:
        logger.info('Assessing assignment')
        
        prompt = ChatPromptTemplate.from_template(
            """You are an AI assistant helping to assess an assignment from an LMS.
            
            Assignment content:
            {assignment_content}
            
            Analyze this assignment and provide the following information:
            1. Type of assignment (essay, multiple choice, file upload, etc.)
            2. Estimated time to complete
            3. Whether it appears to be time-gated or locked
            4. Any prerequisites mentioned
            5. Due date if specified
            
            Provide the information in a structured JSON format."""
        )
        
        chain = (
            prompt 
            | chat_model 
            | StrOutputParser()
        )
        
        result = chain.invoke({"assignment_content": assignment_content})
        
        # Parse the result as JSON
        parsed_result = json.loads(result)
        logger.info('Successfully assessed assignment')
        
        return parsed_result
    except Exception as e:
        logger.error(f'Error assessing assignment: {str(e)}')
        raise

if __name__ == "__main__":
    # Example usage
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
        # Assess the assignment
        assessment = assess_assignment(sample_assignment)
        print("Assignment Assessment:")
        print(json.dumps(assessment, indent=2))
        
        # Generate a response
        response = generate_assignment_response(sample_assignment)
        print("\nGenerated Response (first 100 chars):")
        print(response[:100] + "...")
    except Exception as e:
        print(f"Error in example: {str(e)}")