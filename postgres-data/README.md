# Skyvern PostgreSQL Data Directory

This directory stores the PostgreSQL database files used by Skyvern.

## Purpose

Skyvern uses a PostgreSQL database to store:
- Automation task definitions
- Execution history
- Configuration settings
- User data
- Other persistent application data

This directory is mounted as a volume in the PostgreSQL Docker container to ensure data persistence across container restarts.

## Important Notes

- Do not manually modify the contents of this directory as it could corrupt the database
- Database backups should be performed using PostgreSQL's backup tools
- The database is configured with the following credentials:
  - Username: skyvern
  - Password: skyvern
  - Database: skyvern