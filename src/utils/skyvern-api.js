/**
 * Utility functions for interacting with the Skyvern API
 */
const axios = require('axios');

// Configure axios with base URL from environment variable
const skyvernApi = axios.create({
  baseURL: process.env.SKYVERN_API_URL || 'http://localhost:8000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  }
});

/**
 * Get the status of the Skyvern API
 * @returns {Promise<Object>} API status response
 */
async function getApiStatus() {
  try {
    const response = await skyvernApi.get('/api/v1/status');
    return response.data;
  } catch (error) {
    console.error('Error getting Skyvern API status:', error.message);
    throw error;
  }
}

/**
 * Start a new automation task
 * @param {Object} taskConfig - Configuration for the automation task
 * @returns {Promise<Object>} Task creation response
 */
async function startAutomationTask(taskConfig) {
  try {
    const response = await skyvernApi.post('/api/v1/tasks', taskConfig);
    return response.data;
  } catch (error) {
    console.error('Error starting automation task:', error.message);
    throw error;
  }
}

/**
 * Get the status of a specific task
 * @param {string} taskId - ID of the task to check
 * @returns {Promise<Object>} Task status response
 */
async function getTaskStatus(taskId) {
  try {
    const response = await skyvernApi.get(`/api/v1/tasks/${taskId}`);
    return response.data;
  } catch (error) {
    console.error(`Error getting status for task ${taskId}:`, error.message);
    throw error;
  }
}

module.exports = {
  getApiStatus,
  startAutomationTask,
  getTaskStatus
};