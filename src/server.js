/**
 * Express server for AI-Course-Automater
 * Handles API requests and WebSocket connections for real-time logging
 */
const express = require('express');
const http = require('http');
const { Server } = require('ws');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { chromium } = require('@playwright/test');
const winston = require('winston');
const path = require('path');
const skyvernApi = require('./utils/skyvern-api');
const langchainUtils = require('./utils/langchain-utils');
const lmsAutomation = require('./core/lms-automation');

// Configure logging
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'ai-course-automater-api' },
  transports: [
    new winston.transports.File({ filename: '../log/error.log', level: 'error' }),
    new winston.transports.File({ filename: '../log/combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Initialize Express app
const app = express();
const server = http.createServer(app);
const wss = new Server({ server });

// Middleware
app.use(cors());
app.use(express.json());

// Session management
const activeSessions = new Map();

// WebSocket connection handling
wss.on('connection', (socket) => {
  // Assign a unique ID to the socket
  socket.id = uuidv4();
  logger.info(`Client connected to WebSocket: ${socket.id}`);
  
  // Store client information
  socket.clientInfo = {
    connected: new Date(),
    lastActivity: new Date()
  };
  
  // Send welcome message
  socket.send(JSON.stringify({
    type: 'info',
    timestamp: new Date(),
    message: `Connected to AI-Course-Automater WebSocket (ID: ${socket.id})`
  }));
  
  // Handle client messages
  socket.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      logger.info(`Received message from client ${socket.id}:`, data);
      
      // Update last activity
      socket.clientInfo.lastActivity = new Date();
      
      // Handle different message types if needed
      if (data.type === 'ping') {
        socket.send(JSON.stringify({
          type: 'pong',
          timestamp: new Date(),
          message: 'Server is alive'
        }));
      }
    } catch (error) {
      logger.error(`Error processing message from client ${socket.id}:`, error);
    }
  });
  
  // Handle disconnection
  socket.on('close', () => {
    logger.info(`Client disconnected: ${socket.id}`);
    
    // Clean up any resources associated with this client
    const session = findSessionBySocketId(socket.id);
    if (session) {
      stopAutomation(session.id)
        .catch(err => logger.error(`Error stopping automation for session ${session.id}:`, err));
    }
  });
});

/**
 * Find a session by socket ID
 * @param {string} socketId - WebSocket ID
 * @returns {Object|null} - Session object or null if not found
 */
function findSessionBySocketId(socketId) {
  for (const [sessionId, session] of activeSessions.entries()) {
    if (session.socketId === socketId) {
      return { id: sessionId, ...session };
    }
  }
  return null;
}

/**
 * Send log message to a specific client
 * @param {string} socketId - WebSocket ID
 * @param {string} message - Log message
 * @param {string} type - Log type (info, error, warning, success)
 */
function sendLog(socketId, message, type = 'info') {
  const socket = Array.from(wss.clients).find(client => client.id === socketId);
  
  if (socket && socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify({
      type,
      timestamp: new Date(),
      message
    }));
  }
}

/**
 * Start automation for a user
 * @param {Object} credentials - User credentials
 * @param {string} socketId - WebSocket ID for sending logs
 * @returns {Promise<string>} - Session ID
 */
async function startAutomation(credentials, socketId) {
  const { username, password, apiKey } = credentials;
  const sessionId = uuidv4();
  
  // Create session object
  const session = {
    id: sessionId,
    socketId,
    username,
    apiKey,
    startTime: new Date(),
    status: 'initializing',
    browser: null,
    context: null,
    page: null
  };
  
  // Store session
  activeSessions.set(sessionId, session);
  
  // Send initial log
  sendLog(socketId, `Starting automation session ${sessionId} for user ${username}`, 'info');
  
  // Start automation in background
  runAutomation(sessionId, credentials)
    .catch(error => {
      logger.error(`Error in automation session ${sessionId}:`, error);
      sendLog(socketId, `Error: ${error.message}`, 'error');
      
      // Update session status
      const session = activeSessions.get(sessionId);
      if (session) {
        session.status = 'error';
        session.error = error.message;
        activeSessions.set(sessionId, session);
      }
    });
  
  return sessionId;
}

/**
 * Run the automation process
 * @param {string} sessionId - Session ID
 * @param {Object} credentials - User credentials
 */
async function runAutomation(sessionId, credentials) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  const { socketId, username, apiKey } = session;
  
  try {
    // Update session status
    session.status = 'running';
    activeSessions.set(sessionId, session);
    
    // Check Skyvern API status
    sendLog(socketId, 'Checking Skyvern API status...', 'info');
    const apiStatus = await skyvernApi.getApiStatus();
    sendLog(socketId, `Skyvern API status: ${JSON.stringify(apiStatus)}`, 'info');
    
    // Launch browser
    sendLog(socketId, 'Launching browser...', 'info');
    const browser = await chromium.launch({
      headless: process.env.HEADLESS !== 'false',
    });
    
    // Update session with browser instance
    session.browser = browser;
    activeSessions.set(sessionId, session);
    
    // Create a new browser context
    sendLog(socketId, 'Creating browser context...', 'info');
    const context = await browser.newContext({
      recordVideo: {
        dir: '../videos/',
        size: { width: 1280, height: 720 },
      },
    });
    
    // Update session with context
    session.context = context;
    activeSessions.set(sessionId, session);
    
    // Create a new page
    const page = await context.newPage();
    
    // Update session with page
    session.page = page;
    activeSessions.set(sessionId, session);
    
    // Navigate to the LMS
    sendLog(socketId, 'Navigating to LMS...', 'info');
    await page.goto(process.env.SKYVERN_UI_URL || 'http://localhost:8080');
    
    // Take a screenshot
    const screenshotPath = `../artifacts/screenshots/${sessionId}-initial.png`;
    await page.screenshot({ path: screenshotPath });
    sendLog(socketId, `Screenshot saved to ${screenshotPath}`, 'info');
    
    // Run the LMS automation
    sendLog(socketId, 'Starting LMS automation...', 'info');
    await lmsAutomation.runAutomation(page, credentials, (message, type) => {
      sendLog(socketId, message, type);
    });
    
    // Complete automation
    sendLog(socketId, 'Automation completed successfully!', 'success');
    
    // Close browser
    await browser.close();
    
    // Update session status
    session.status = 'completed';
    session.endTime = new Date();
    activeSessions.set(sessionId, session);
    
  } catch (error) {
    // Update session status
    session.status = 'error';
    session.error = error.message;
    session.endTime = new Date();
    activeSessions.set(sessionId, session);
    
    // Rethrow error to be handled by caller
    throw error;
  }
}

/**
 * Stop an automation session
 * @param {string} sessionId - Session ID
 * @returns {Promise<boolean>} - Success status
 */
async function stopAutomation(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) {
    throw new Error(`Session ${sessionId} not found`);
  }
  
  try {
    // Send log
    sendLog(session.socketId, 'Stopping automation...', 'warning');
    
    // Close browser if it exists
    if (session.browser) {
      await session.browser.close();
    }
    
    // Update session status
    session.status = 'stopped';
    session.endTime = new Date();
    activeSessions.set(sessionId, session);
    
    // Send log
    sendLog(session.socketId, 'Automation stopped successfully', 'success');
    
    return true;
  } catch (error) {
    logger.error(`Error stopping automation for session ${sessionId}:`, error);
    
    // Update session status
    session.status = 'error';
    session.error = error.message;
    activeSessions.set(sessionId, session);
    
    // Send log
    sendLog(session.socketId, `Error stopping automation: ${error.message}`, 'error');
    
    return false;
  }
}

// API Routes

/**
 * Start automation endpoint
 * POST /api/start
 */
app.post('/api/start', async (req, res) => {
  try {
    const { username, password, apiKey, clientId } = req.body;
    
    // Basic validation
    if (!username || !password || !apiKey) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        details: 'Username, password, and API key are required'
      });
    }
    
    // Find socket by clientId or use the most recent connection
    let socketId;
    if (clientId) {
      // Find socket with matching clientId
      const socket = Array.from(wss.clients).find(client => client.clientId === clientId);
      if (socket) {
        socketId = socket.id;
      }
    }
    
    // If no socket found with clientId, use the most recent connection
    if (!socketId && wss.clients.size > 0) {
      // Get the most recently connected client
      const clients = Array.from(wss.clients);
      clients.sort((a, b) => b.clientInfo.connected - a.clientInfo.connected);
      socketId = clients[0].id;
    }
    
    // If still no socket, return error
    if (!socketId) {
      return res.status(400).json({ 
        error: 'No WebSocket connection',
        details: 'Client must establish a WebSocket connection before starting automation'
      });
    }
    
    // Start automation
    const sessionId = await startAutomation({ username, password, apiKey }, socketId);
    
    // Respond with session ID
    res.json({ 
      success: true,
      sessionId,
      message: 'Automation started successfully'
    });
  } catch (error) {
    logger.error('Error starting automation:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Stop automation endpoint
 * POST /api/stop
 */
app.post('/api/stop', async (req, res) => {
  try {
    const { sessionId } = req.body;
    
    // Validate session ID
    if (!sessionId) {
      return res.status(400).json({ 
        error: 'Missing session ID',
        details: 'Session ID is required to stop automation'
      });
    }
    
    // Check if session exists
    if (!activeSessions.has(sessionId)) {
      return res.status(404).json({ 
        error: 'Session not found',
        details: `No active session with ID ${sessionId}`
      });
    }
    
    // Stop automation
    const success = await stopAutomation(sessionId);
    
    // Respond with result
    if (success) {
      res.json({ 
        success: true,
        message: 'Automation stopped successfully'
      });
    } else {
      res.status(500).json({ 
        error: 'Failed to stop automation',
        details: 'See server logs for details'
      });
    }
  } catch (error) {
    logger.error('Error stopping automation:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

/**
 * Get automation status endpoint
 * GET /api/status
 */
app.get('/api/status', (req, res) => {
  try {
    const { sessionId } = req.query;
    
    // If session ID provided, return specific session status
    if (sessionId) {
      const session = activeSessions.get(sessionId);
      
      if (!session) {
        return res.status(404).json({ 
          error: 'Session not found',
          details: `No active session with ID ${sessionId}`
        });
      }
      
      // Return session status (excluding sensitive information)
      return res.json({
        sessionId,
        username: session.username,
        status: session.status,
        startTime: session.startTime,
        endTime: session.endTime || null,
        error: session.error || null
      });
    }
    
    // Otherwise, return summary of all sessions
    const sessions = Array.from(activeSessions.entries()).map(([id, session]) => ({
      sessionId: id,
      username: session.username,
      status: session.status,
      startTime: session.startTime,
      endTime: session.endTime || null
    }));
    
    res.json({
      activeSessions: sessions,
      totalCount: sessions.length
    });
  } catch (error) {
    logger.error('Error getting automation status:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Serve static files from the React app if in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'webui/build')));
  
  // Handle React routing, return all requests to React app
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'webui/build', 'index.html'));
  });
}

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`WebSocket server available at ws://localhost:${PORT}`);
});

module.exports = { app, server, wss };