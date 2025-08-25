#!/bin/bash

# LeadFlow Pro API Server Startup Script
# This script starts the LeadFlow Pro API server in production mode

echo "Starting LeadFlow Pro API Server..."
echo "========================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 16+ to continue."
    exit 1
fi

# Check if npm dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "Warning: .env file not found. Server may not start correctly."
fi

# Start the server
echo "Starting server on port 80..."
echo "Server will be accessible at: http://0.0.0.0:80"
echo "Domain: https://reflows.app"
echo "========================================="

# Start with PM2 for production or direct node for development
if command -v pm2 &> /dev/null; then
    echo "Starting with PM2 process manager..."
    pm2 start server.js --name "leadflow-pro-api" --env production
    pm2 save
else
    echo "Starting with Node.js directly..."
    node server.js
fi