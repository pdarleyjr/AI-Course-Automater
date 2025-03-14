# LangChain Integration for AI-Course-Automater

This document explains how the LangChain integration works in the AI-Course-Automater project and how to use it effectively.

## Overview

LangChain is integrated into the project to provide intelligent automation capabilities for interacting with Learning Management Systems (LMS). The integration allows the automation system to:

1. Analyze course content and extract key information
2. Generate responses for text-based assignments
3. Answer multiple-choice questions intelligently
4. Assess assignments to determine their type and requirements

The integration is available in both JavaScript and Python implementations to provide flexibility depending on your preferred language and use case.

## Setup

### Prerequisites

- Docker and Docker Compose installed
- OpenAI API key (or other supported LLM provider)

### Environment Variables

Set the following environment variables before running the containers:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Optional
LMS_URL=https://your-lms-url.com
LMS_USERNAME=your_username
LMS_PASSWORD=your_password
```

## JavaScript Implementation

The JavaScript implementation is located in `src/utils/langchain-utils.js` and provides the following functions:

- `analyzeCourseContent(courseContent)`: Analyzes HTML or text content from a course page
- `generateAssignmentResponse(assignmentPrompt, courseContext)`: Generates a response for a text assignment
- `answerMultipleChoiceQuestion(question, courseContext)`: Selects the best answer for a multiple-choice question
- `assessAssignment(assignmentContent)`: Analyzes an assignment to determine its type and requirements

### Usage Example

```javascript
const langchainUtils = require('./utils/langchain-utils');

// Example: Generate a response for an assignment
const assignmentPrompt = "Write a 500-word essay on the ethical implications of AI.";
const response = await langchainUtils.generateAssignmentResponse(assignmentPrompt);
console.log(response);
```

## Python Implementation

The Python implementation is located in `src/langchain_integration.py` and provides similar functionality:

- `analyze_course_content(course_content)`: Analyzes course content
- `generate_assignment_response(assignment_prompt, course_context)`: Generates assignment responses
- `answer_multiple_choice_question(question, course_context)`: Answers multiple-choice questions
- `assess_assignment(assignment_content)`: Assesses assignment types and requirements

### Usage Example

```python
import langchain_integration

# Example: Assess an assignment
assignment_content = """
Assignment: Introduction to AI
Write a 500-word essay on the ethical implications of AI.
Due: March 20, 2025
"""
assessment = langchain_integration.assess_assignment(assignment_content)
print(assessment)
```

## Docker Integration

The project includes two Docker services for LangChain:

1. `langchain-js`: Node.js environment for the JavaScript implementation
2. `langchain-py`: Python environment for the Python implementation

Both services are configured in the `docker-compose.yml` file and can be started with:

```bash
docker-compose up -d langchain-js langchain-py
```

## Integration with LMS Automation

The LangChain utilities are integrated with the core LMS automation in `src/core/lms-automation.js`. The integration enhances the automation by:

1. Analyzing course content to identify assignments and time-gated content
2. Generating intelligent responses for text assignments
3. Selecting the best answers for quizzes and multiple-choice questions

## Customization

### Using Different LLM Providers

To use a different LLM provider (like Anthropic Claude or Azure OpenAI):

1. Update the environment variables in `docker-compose.yml`
2. Modify the model initialization in the respective implementation files

### Adjusting Model Parameters

You can adjust the model parameters (like temperature) in the implementation files:

- For JavaScript: Modify the `chatModel` initialization in `src/utils/langchain-utils.js`
- For Python: Modify the `chat_model` initialization in `src/langchain_integration.py`

## Troubleshooting

### Common Issues

1. **API Key Issues**: Ensure your OpenAI API key is correctly set in the environment variables
2. **Dependency Issues**: If you encounter dependency issues, try rebuilding the containers:
   ```bash
   docker-compose build --no-cache langchain-js langchain-py
   ```
3. **Memory Issues**: If you encounter memory issues with large course content, try adjusting the Docker resource limits

### Logs

Logs for the LangChain integration can be found in:

- JavaScript: `log/langchain-combined.log` and `log/langchain-error.log`
- Python: `log/langchain-python.log`