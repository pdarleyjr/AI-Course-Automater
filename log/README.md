# Skyvern Log Directory

This directory stores log files generated by the Skyvern application.

## Purpose

Skyvern logs various events and information during its operation, which are stored in this directory. These logs include:
- Application startup and shutdown events
- Error messages and stack traces
- Warning messages
- Informational messages about automation progress
- Debug information

These logs are essential for:
- Troubleshooting issues with Skyvern
- Monitoring the health of the application
- Understanding the sequence of events during automation
- Diagnosing performance problems

This directory is mounted as a volume in the Skyvern Docker container.