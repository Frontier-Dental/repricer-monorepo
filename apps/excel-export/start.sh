#!/bin/bash

echo "Starting Excel Export Service..."
echo "================================"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
fi

# Check if TypeScript needs to be compiled
if [ ! -d "dist" ]; then
    echo "Building TypeScript..."
    npm run build
fi

# Start the service
echo "Starting service on port 3003..."
npm run dev