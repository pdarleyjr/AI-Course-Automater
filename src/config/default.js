/**
 * Default configuration for the AI-Course-Automater
 */
module.exports = {
  // Skyvern API configuration
  skyvern: {
    apiUrl: process.env.SKYVERN_API_URL || 'http://localhost:8000',
    uiUrl: process.env.SKYVERN_UI_URL || 'http://localhost:8080',
  },
  
  // Browser configuration
  browser: {
    headless: process.env.HEADLESS !== 'false',
    slowMo: parseInt(process.env.SLOW_MO || '0', 10),
    timeout: parseInt(process.env.TIMEOUT || '30000', 10),
    viewport: {
      width: parseInt(process.env.VIEWPORT_WIDTH || '1280', 10),
      height: parseInt(process.env.VIEWPORT_HEIGHT || '720', 10),
    },
  },
  
  // LMS configuration (customize for your specific LMS)
  lms: {
    url: process.env.LMS_URL || 'https://example-lms.com',
    username: process.env.LMS_USERNAME,
    password: process.env.LMS_PASSWORD,
    courseIds: (process.env.COURSE_IDS || '').split(',').filter(Boolean),
  },
  
  // Automation configuration
  automation: {
    // How often to check for new assignments (in milliseconds)
    checkInterval: parseInt(process.env.CHECK_INTERVAL || '3600000', 10), // Default: 1 hour
    
    // Maximum number of retries for failed operations
    maxRetries: parseInt(process.env.MAX_RETRIES || '3', 10),
    
    // Delay between retries (in milliseconds)
    retryDelay: parseInt(process.env.RETRY_DELAY || '5000', 10), // Default: 5 seconds
    
    // Whether to save screenshots during automation
    saveScreenshots: process.env.SAVE_SCREENSHOTS !== 'false',
    
    // Whether to record videos during automation
    recordVideos: process.env.RECORD_VIDEOS !== 'false',
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: {
      enabled: process.env.LOG_TO_FILE !== 'false',
      path: '../log',
    },
    console: {
      enabled: process.env.LOG_TO_CONSOLE !== 'false',
      colorize: process.env.COLORIZE_LOGS !== 'false',
    },
  },
};