# Integration Test Runner Script (PowerShell)
# This script sets up the environment and runs the integration tests

$ErrorActionPreference = "Stop"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Minecraft MCP Bridge Integration Tests" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host ""

# Check if Node.js is installed
try {
    $nodeVersion = node --version
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: Node.js is not installed" -ForegroundColor Red
    Write-Host "Please install Node.js v18 or higher" -ForegroundColor Yellow
    exit 1
}

# Check if npm is installed
try {
    $npmVersion = npm --version
    Write-Host "npm version: $npmVersion" -ForegroundColor Green
    Write-Host ""
} catch {
    Write-Host "Error: npm is not installed" -ForegroundColor Red
    exit 1
}

# Install dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    npm install
    Write-Host ""
}

# Build the project
Write-Host "Building project..." -ForegroundColor Yellow
Push-Location ..
npm run build
Pop-Location
Write-Host ""

# Run the tests
Write-Host "Running integration tests..." -ForegroundColor Yellow
Write-Host ""
npm test -- $args

Write-Host ""
Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "Integration tests complete!" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan
