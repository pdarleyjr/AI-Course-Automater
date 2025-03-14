/**
 * PostgreSQL Database Connection Module
 * Provides connection and query functionality for the PostgreSQL database
 */
const { Pool } = require('pg');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'db-module' },
  transports: [
    new winston.transports.File({ filename: '../log/db-error.log', level: 'error' }),
    new winston.transports.File({ filename: '../log/db-combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ],
});

// Create a connection pool using environment variables or default to Skyvern's PostgreSQL
const pool = new Pool({
  host: process.env.DB_HOST || 'postgres',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'skyvern',
  user: process.env.DB_USER || 'skyvern',
  password: process.env.DB_PASSWORD || 'skyvern',
  // Maximum number of clients the pool should contain
  max: 20,
  // Maximum time in ms that a client can be idle before being closed
  idleTimeoutMillis: 30000,
  // Maximum time in ms to wait for a connection to become available
  connectionTimeoutMillis: 2000,
});

// Log pool errors
pool.on('error', (err, client) => {
  logger.error('Unexpected error on idle client', err);
});

/**
 * Execute a database query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Error executing query', { text, error: error.message });
    throw error;
  }
}

/**
 * Get a client from the pool with transaction support
 * @returns {Promise<Object>} Database client
 */
async function getClient() {
  const client = await pool.connect();
  const query = client.query;
  const release = client.release;

  // Set a timeout of 5 seconds, after which we will log this client's last query
  const timeout = setTimeout(() => {
    logger.error('A client has been checked out for more than 5 seconds!');
    logger.error(`The last executed query on this client was: ${client.lastQuery}`);
  }, 5000);

  // Monkey patch the query method to keep track of the last query executed
  client.query = (...args) => {
    client.lastQuery = args;
    return query.apply(client, args);
  };

  client.release = () => {
    // Clear the timeout
    clearTimeout(timeout);
    // Set the methods back to their old implementation
    client.query = query;
    client.release = release;
    return release.apply(client);
  };

  return client;
}

/**
 * Initialize the database by creating necessary tables if they don't exist
 */
async function initDatabase() {
  try {
    logger.info('Initializing database...');

    // Create users table
    await query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL,
        email VARCHAR(255),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        last_login TIMESTAMP WITH TIME ZONE
      )
    `);

    // Create sessions table
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(36) PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        username VARCHAR(255) NOT NULL,
        api_key VARCHAR(255),
        start_time TIMESTAMP WITH TIME ZONE NOT NULL,
        end_time TIMESTAMP WITH TIME ZONE,
        status VARCHAR(50) NOT NULL,
        error TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create course_completions table
    await query(`
      CREATE TABLE IF NOT EXISTS course_completions (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(36) REFERENCES sessions(id),
        course_id VARCHAR(255) NOT NULL,
        course_title VARCHAR(255),
        assignments_completed INTEGER DEFAULT 0,
        success BOOLEAN DEFAULT TRUE,
        error TEXT,
        completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create automation_events table for significant events
    await query(`
      CREATE TABLE IF NOT EXISTS automation_events (
        id SERIAL PRIMARY KEY,
        session_id VARCHAR(36) REFERENCES sessions(id),
        event_type VARCHAR(50) NOT NULL,
        message TEXT,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);

    logger.info('Database initialization complete');
  } catch (error) {
    logger.error('Error initializing database', error);
    throw error;
  }
}

module.exports = {
  query,
  getClient,
  initDatabase,
  pool
};