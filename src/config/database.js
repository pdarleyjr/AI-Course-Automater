/**
 * PostgreSQL Database Configuration
 * This configuration is optimized for future migration to cloud/VPS environments
 */
module.exports = {
  // Connection configuration
  connection: {
    host: process.env.DB_HOST || 'postgres',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'skyvern',
    user: process.env.DB_USER || 'skyvern',
    password: process.env.DB_PASSWORD || 'skyvern',
  },
  
  // Pool configuration for optimal performance
  pool: {
    // Maximum number of clients the pool should contain
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    // Minimum number of clients the pool should contain
    min: parseInt(process.env.DB_POOL_MIN || '0', 10),
    // Maximum time in ms that a client can be idle before being closed
    idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
    // Maximum time in ms to wait for a connection to become available
    connectionTimeoutMillis: parseInt(process.env.DB_CONNECTION_TIMEOUT || '2000', 10),
  },
  
  // Schema configuration
  schema: {
    // Tables that will be created when database is initialized
    tables: {
      // Users table for future authentication system
      users: `
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(255) NOT NULL UNIQUE,
          email VARCHAR(255),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          last_login TIMESTAMP WITH TIME ZONE
        )
      `,
      
      // Course data table for storing course information
      courses: `
        CREATE TABLE IF NOT EXISTS courses (
          id SERIAL PRIMARY KEY,
          course_id VARCHAR(255) NOT NULL UNIQUE,
          course_title VARCHAR(255) NOT NULL,
          course_description TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP WITH TIME ZONE
        )
      `,
      
      // Course completions table for tracking completed courses
      course_completions: `
        CREATE TABLE IF NOT EXISTS course_completions (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id),
          course_id VARCHAR(255) NOT NULL,
          assignments_completed INTEGER DEFAULT 0,
          success BOOLEAN DEFAULT TRUE,
          completed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `,
      
      // Analytics table for tracking usage statistics
      analytics: `
        CREATE TABLE IF NOT EXISTS analytics (
          id SERIAL PRIMARY KEY,
          event_type VARCHAR(50) NOT NULL,
          user_id INTEGER REFERENCES users(id),
          data JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        )
      `
    }
  },
  
  // Migration configuration for future cloud deployment
  migration: {
    // Scripts to run when migrating to a new environment
    scripts: {
      // Backup database to a file
      backup: 'pg_dump -h $DB_HOST -U $DB_USER -d $DB_NAME -F c -f backup.dump',
      // Restore database from a file
      restore: 'pg_restore -h $DB_HOST -U $DB_USER -d $DB_NAME -c backup.dump'
    }
  }
};