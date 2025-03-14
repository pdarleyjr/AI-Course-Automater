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
    url: process.env.LMS_URL || 'https://app.targetsolutions.com/auth/index.cfm?action=login.showloginone&customerid=0&customerpath=login&msg=',
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
    
    // Anti-bot detection settings
    antiBot: {
      // Whether to apply stealth measures
      applyStealth: process.env.APPLY_STEALTH !== 'false',
      
      // Whether to use human-like interactions
      humanLikeInteractions: process.env.HUMAN_LIKE_INTERACTIONS !== 'false',
      
      // Whether to randomize delays
      randomizeDelays: process.env.RANDOMIZE_DELAYS !== 'false'
    },
    
    // Time-gated content settings
    timeGated: {
      // Whether to speed up videos when possible
      speedUpVideos: process.env.SPEED_UP_VIDEOS === 'true',
      
      // Maximum time to wait for time-gated content (in milliseconds)
      maxWaitTime: parseInt(process.env.MAX_WAIT_TIME || '3600000', 10) // Default: 1 hour
    }
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