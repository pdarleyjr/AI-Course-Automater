/**
 * Course Completion Model
 * Handles database operations for course completions
 */
const db = require('./db');
const logger = require('winston');

/**
 * Record a course completion
 * @param {string} sessionId - Session ID
 * @param {string} courseId - Course ID
 * @param {string} courseTitle - Course title
 * @param {number} assignmentsCompleted - Number of assignments completed
 * @param {boolean} success - Whether the course automation was successful
 * @param {string} error - Error message (if applicable)
 * @returns {Promise<Object>} Created course completion record
 */
async function recordCourseCompletion(
  sessionId, 
  courseId, 
  courseTitle = 'Unknown', 
  assignmentsCompleted = 0, 
  success = true, 
  error = null
) {
  try {
    const result = await db.query(
      `INSERT INTO course_completions 
        (session_id, course_id, course_title, assignments_completed, success, error) 
       VALUES 
        ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [sessionId, courseId, courseTitle, assignmentsCompleted, success, error]
    );
    return result.rows[0];
  } catch (error) {
    logger.error('Error recording course completion:', error);
    throw error;
  }
}

/**
 * Get course completions for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} Array of course completion records
 */
async function getCourseCompletionsBySession(sessionId) {
  try {
    const result = await db.query(
      'SELECT * FROM course_completions WHERE session_id = $1 ORDER BY completed_at DESC',
      [sessionId]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting course completions by session:', error);
    throw error;
  }
}

/**
 * Get course completions for a user
 * @param {string} username - Username
 * @param {number} limit - Maximum number of records to return
 * @param {number} offset - Number of records to skip
 * @returns {Promise<Array>} Array of course completion records
 */
async function getCourseCompletionsByUser(username, limit = 100, offset = 0) {
  try {
    const result = await db.query(
      `SELECT cc.* 
       FROM course_completions cc
       JOIN sessions s ON cc.session_id = s.id
       WHERE s.username = $1
       ORDER BY cc.completed_at DESC
       LIMIT $2 OFFSET $3`,
      [username, limit, offset]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting course completions by user:', error);
    throw error;
  }
}

/**
 * Get course completion statistics
 * @param {string} courseId - Course ID (optional)
 * @returns {Promise<Object>} Course completion statistics
 */
async function getCourseCompletionStats(courseId = null) {
  try {
    let query, params;
    
    if (courseId) {
      query = `
        SELECT 
          COUNT(*) as total_attempts,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_attempts,
          SUM(assignments_completed) as total_assignments_completed,
          AVG(assignments_completed) as avg_assignments_per_attempt
        FROM course_completions
        WHERE course_id = $1
      `;
      params = [courseId];
    } else {
      query = `
        SELECT 
          COUNT(*) as total_attempts,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_attempts,
          SUM(assignments_completed) as total_assignments_completed,
          AVG(assignments_completed) as avg_assignments_per_attempt
        FROM course_completions
      `;
      params = [];
    }
    
    const result = await db.query(query, params);
    return result.rows[0];
  } catch (error) {
    logger.error('Error getting course completion statistics:', error);
    throw error;
  }
}

/**
 * Get most recently completed courses
 * @param {number} limit - Maximum number of records to return
 * @returns {Promise<Array>} Array of recent course completion records
 */
async function getRecentCompletions(limit = 10) {
  try {
    const result = await db.query(
      `SELECT cc.*, s.username
       FROM course_completions cc
       JOIN sessions s ON cc.session_id = s.id
       WHERE cc.success = true
       ORDER BY cc.completed_at DESC
       LIMIT $1`,
      [limit]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting recent completions:', error);
    throw error;
  }
}

module.exports = {
  recordCourseCompletion,
  getCourseCompletionsBySession,
  getCourseCompletionsByUser,
  getCourseCompletionStats,
  getRecentCompletions
};