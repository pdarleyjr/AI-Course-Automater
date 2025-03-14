/**
 * Session Model
 * Handles database operations for automation sessions
 */
const db = require('./db');
const logger = require('winston');
const userModel = require('./user');

/**
 * Create a new session
 * @param {string} sessionId - Unique session ID
 * @param {string} username - Username
 * @param {string} apiKey - API key (will be stored securely in a real production environment)
 * @returns {Promise<Object>} Created session
 */
async function createSession(sessionId, username, apiKey) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');
    
    // Create or update user
    const user = await userModel.createOrUpdateUser(username);
    
    // Create session
    const result = await client.query(
      `INSERT INTO sessions 
        (id, user_id, username, api_key, start_time, status) 
       VALUES 
        ($1, $2, $3, $4, CURRENT_TIMESTAMP, $5) 
       RETURNING *`,
      [sessionId, user.id, username, apiKey, 'initializing']
    );
    
    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error creating session:', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Update session status
 * @param {string} sessionId - Session ID
 * @param {string} status - New status
 * @param {string} error - Error message (if applicable)
 * @returns {Promise<Object>} Updated session
 */
async function updateSessionStatus(sessionId, status, error = null) {
  try {
    let query, params;
    
    if (status === 'completed' || status === 'stopped' || status === 'error') {
      // Set end time if session is ending
      query = `
        UPDATE sessions 
        SET status = $1, error = $2, end_time = CURRENT_TIMESTAMP 
        WHERE id = $3 
        RETURNING *
      `;
      params = [status, error, sessionId];
    } else {
      // Just update status
      query = `
        UPDATE sessions 
        SET status = $1, error = $2 
        WHERE id = $3 
        RETURNING *
      `;
      params = [status, error, sessionId];
    }
    
    const result = await db.query(query, params);
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error updating session status:', error);
    throw error;
  }
}

/**
 * Get session by ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Session object or null if not found
 */
async function getSessionById(sessionId) {
  try {
    const result = await db.query(
      'SELECT * FROM sessions WHERE id = $1',
      [sessionId]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error getting session by ID:', error);
    throw error;
  }
}

/**
 * Get all sessions for a user
 * @param {string} username - Username
 * @param {number} limit - Maximum number of sessions to return
 * @param {number} offset - Number of sessions to skip
 * @returns {Promise<Array>} Array of session objects
 */
async function getSessionsByUsername(username, limit = 100, offset = 0) {
  try {
    const result = await db.query(
      `SELECT s.*, 
              COUNT(cc.id) as course_count, 
              SUM(cc.assignments_completed) as total_assignments_completed
       FROM sessions s
       LEFT JOIN course_completions cc ON s.id = cc.session_id
       WHERE s.username = $1
       GROUP BY s.id
       ORDER BY s.start_time DESC
       LIMIT $2 OFFSET $3`,
      [username, limit, offset]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting sessions by username:', error);
    throw error;
  }
}

/**
 * Get all active sessions
 * @returns {Promise<Array>} Array of active session objects
 */
async function getActiveSessions() {
  try {
    const result = await db.query(
      `SELECT * FROM sessions 
       WHERE status NOT IN ('completed', 'stopped', 'error') 
       AND (end_time IS NULL OR end_time > CURRENT_TIMESTAMP - INTERVAL '1 hour')
       ORDER BY start_time DESC`
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting active sessions:', error);
    throw error;
  }
}

/**
 * Log an automation event
 * @param {string} sessionId - Session ID
 * @param {string} eventType - Type of event
 * @param {string} message - Event message
 * @returns {Promise<Object>} Created event
 */
async function logEvent(sessionId, eventType, message) {
  try {
    const result = await db.query(
      `INSERT INTO automation_events 
        (session_id, event_type, message) 
       VALUES 
        ($1, $2, $3) 
       RETURNING *`,
      [sessionId, eventType, message]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error logging event:', error);
    // Don't throw error for logging failures to prevent disrupting the main flow
    return null;
  }
}

/**
 * Get events for a session
 * @param {string} sessionId - Session ID
 * @param {number} limit - Maximum number of events to return
 * @param {number} offset - Number of events to skip
 * @returns {Promise<Array>} Array of event objects
 */
async function getSessionEvents(sessionId, limit = 1000, offset = 0) {
  try {
    const result = await db.query(
      `SELECT * FROM automation_events 
       WHERE session_id = $1 
       ORDER BY timestamp DESC 
       LIMIT $2 OFFSET $3`,
      [sessionId, limit, offset]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting session events:', error);
    throw error;
  }
}

module.exports = {
  createSession,
  updateSessionStatus,
  getSessionById,
  getSessionsByUsername,
  getActiveSessions,
  logEvent,
  getSessionEvents
};