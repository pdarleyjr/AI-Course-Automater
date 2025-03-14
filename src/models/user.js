/**
 * User Model
 * Handles database operations for users
 */
const db = require('./db');
const logger = require('winston');

/**
 * Create a new user or update existing user
 * @param {string} username - Username
 * @param {string} email - Email address (optional)
 * @returns {Promise<Object>} Created or updated user
 */
async function createOrUpdateUser(username, email = null) {
  try {
    // Check if user exists
    const existingUser = await findByUsername(username);
    
    if (existingUser) {
      // Update last login time
      const result = await db.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *',
        [existingUser.id]
      );
      return result.rows[0];
    } else {
      // Create new user
      const result = await db.query(
        'INSERT INTO users (username, email) VALUES ($1, $2) RETURNING *',
        [username, email]
      );
      return result.rows[0];
    }
  } catch (error) {
    logger.error('Error creating or updating user:', error);
    throw error;
  }
}

/**
 * Find a user by username
 * @param {string} username - Username to search for
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function findByUsername(username) {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error finding user by username:', error);
    throw error;
  }
}

/**
 * Find a user by ID
 * @param {number} id - User ID
 * @returns {Promise<Object|null>} User object or null if not found
 */
async function findById(id) {
  try {
    const result = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? result.rows[0] : null;
  } catch (error) {
    logger.error('Error finding user by ID:', error);
    throw error;
  }
}

/**
 * Get all users
 * @param {number} limit - Maximum number of users to return
 * @param {number} offset - Number of users to skip
 * @returns {Promise<Array>} Array of user objects
 */
async function getAllUsers(limit = 100, offset = 0) {
  try {
    const result = await db.query(
      'SELECT * FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset]
    );
    return result.rows;
  } catch (error) {
    logger.error('Error getting all users:', error);
    throw error;
  }
}

module.exports = {
  createOrUpdateUser,
  findByUsername,
  findById,
  getAllUsers
};