/**
 * Models Index
 * Exports all database models
 */
const db = require('./db');
const user = require('./user');
const session = require('./session');
const courseCompletion = require('./courseCompletion');

module.exports = {
  db,
  user,
  session,
  courseCompletion,
  
  // Initialize all models and database
  async init() {
    try {
      // Initialize database tables
      await db.initDatabase();
      return true;
    } catch (error) {
      console.error('Error initializing models:', error);
      return false;
    }
  }
};