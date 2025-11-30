#!/bin/bash

# Integration Test Runner Script
# This script sets up the environment and runs the integration tests

set -e

echo "========================================="
echo "Minecraft MCP Bridge Integration Tests"
echo "========================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed"
    echo "Please install Node.js v18 or higher"
    exit 1
fi

echo "Node.js version: $(node --version)"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed"
    exit 1
fi

echo "npm version: $(npm --version)"
echo ""

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install
    echo ""
fi

# Build the project
echo "Building project..."
cd ..
npm run build
cd integration-tests
echo ""

# Run the tests
echo "Running integration tests..."
echo ""
npm test -- "$@"

echo ""
echo "========================================="
echo "Integration tests complete!"
echo "========================================="
