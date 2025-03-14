import axios from 'axios';
import websocketService from './websocket';

// Create an axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30 seconds timeout
});

// API endpoints
const endpoints = {
  startAutomation: '/start',
  stopAutomation: '/stop',
  status: '/status',
};

/**
 * Start the course automation with provided credentials
 * @param {Object} credentials - User credentials
 * @param {string} credentials.username - TargetSolutions username
 * @param {string} credentials.password - TargetSolutions password
 * @param {string} credentials.apiKey - OpenAI API key
 * @returns {Promise} - API response
 */
export const startAutomation = async (credentials) => {
  try {
    // Include the client ID for WebSocket association
    const payload = {
      ...credentials,
      clientId: websocketService.getClientId()
    };
    
    const response = await api.post(endpoints.startAutomation, payload);
    return response.data;
  } catch (error) {
    console.error('Error starting automation:', error);
    throw error;
  }
};

/**
 * Stop the running automation
 * @returns {Promise} - API response
 */
export const stopAutomation = async () => {
  try {
    const response = await api.post(endpoints.stopAutomation, {
      clientId: websocketService.getClientId()
    });
    return response.data;
  } catch (error) {
    console.error('Error stopping automation:', error);
    throw error;
  }
};

/**
 * Get the current status of the automation
 * @returns {Promise} - API response
 */
export const getAutomationStatus = async () => {
  try {
    const response = await api.get(`${endpoints.status}?clientId=${websocketService.getClientId()}`);
    return response.data;
  } catch (error) {
    console.error('Error getting automation status:', error);
    throw error;
  }
};

// Add request interceptor to handle authentication if needed
api.interceptors.request.use(
  (config) => {
    // You can add auth token here if needed in the future
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle specific error codes
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // Handle unauthorized
          console.error('Unauthorized access');
          break;
        case 403:
          // Handle forbidden
          console.error('Forbidden access');
          break;
        case 500:
          // Handle server error
          console.error('Server error');
          break;
        default:
          // Handle other errors
          console.error('API error:', error.response.data);
      }
    } else if (error.request) {
      // The request was made but no response was received
      console.error('No response received from server');
    } else {
      // Something happened in setting up the request
      console.error('Error setting up request:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default api;