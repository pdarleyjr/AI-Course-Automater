/**
 * PostgreSQL Database Utilities
 * Provides connection and query functionality for the PostgreSQL database
 * 
 * NOTE: This module is prepared for future use and is not currently integrated with the application.
 * It will be used when the project is ready to implement database persistence.
 */
const { Pool } = require('pg');
const dbConfig = require('../config/database');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: 'db-utils' },
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

/**
 * Create a database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
function createPool() {
  const pool = new Pool({
    ...dbConfig.connection,
    ...dbConfig.pool
  });
  
  // Log pool errors
  pool.on('error', (err, client) => {
    logger.error('Unexpected error on idle client', err);
  });
  
  return pool;
}

// Create a singleton pool instance
let pool = null;

/**
 * Get the database connection pool
 * @returns {Pool} PostgreSQL connection pool
 */
function getPool() {
  if (!pool) {
    pool = createPool();
  }
  return pool;
}

/**
 * Execute a database query
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<Object>} Query result
 */
async function query(text, params = []) {
  const start = Date.now();
  try {
    const client = await getPool().connect();
    try {
      const res = await client.query(text, params);
      const duration = Date.now() - start;
      logger.debug('Executed query', { text, duration, rows: res.rowCount });
      return res;
    } finally {
      client.release();
    }
  } catch (error) {
    logger.error('Error executing query', { text, error: error.message });
    throw error;
  }
}

/**
 * Execute a transaction with multiple queries
 * @param {Function} callback - Callback function that receives a client and executes queries
 * @returns {Promise<any>} Result of the transaction
 */
async function transaction(callback) {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Transaction error', error);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Initialize the database by creating necessary tables
 * @returns {Promise<boolean>} Whether initialization was successful
 */
async function initDatabase() {
  try {
    logger.info('Initializing database...');
    
    // Create tables
    for (const [tableName, createTableSQL] of Object.entries(dbConfig.schema.tables)) {
      logger.info(`Creating table: ${tableName}`);
      await query(createTableSQL);
    }
    
    logger.info('Database initialization complete');
    return true;
  } catch (error) {
    logger.error('Error initializing database', error);
    return false;
  }
}

/**
 * Check database connection
 * @returns {Promise<boolean>} Whether connection is successful
 */
async function checkConnection() {
  try {
    await query('SELECT NOW()');
    return true;
  } catch (error) {
    logger.error('Database connection check failed', error);
    return false;
  }
}

/**
 * Close database connection pool
 * @returns {Promise<void>}
 */
async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

module.exports = {
  query,
  transaction,
  initDatabase,
  checkConnection,
  closePool,
  getPool
};