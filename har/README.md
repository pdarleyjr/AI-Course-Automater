# Skyvern HAR Directory

This directory stores HTTP Archive (HAR) files generated during Skyvern automation sessions.

## Purpose

HAR files are a standard format for logging HTTP transactions. Skyvern uses this directory to store HAR files that contain detailed information about:
- Network requests and responses
- HTTP headers
- Request and response bodies
- Timing information
- Cookies

These files are valuable for:
- Debugging network-related issues
- Analyzing web application performance
- Understanding API interactions
- Reproducing specific network conditions

This directory is mounted as a volume in the Skyvern Docker container.