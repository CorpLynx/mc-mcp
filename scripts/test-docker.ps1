# Test Docker deployment setup (PowerShell version)
# This script validates that Docker images build correctly and services start properly

$ErrorActionPreference = "Stop"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Minecraft MCP Bridge - Docker Test Script" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

function Print-Success {
    param([string]$Message)
    Write-Host "✓ $Message" -ForegroundColor Green
}

function Print-Error {
    param([string]$Message)
    Write-Host "✗ $Message" -ForegroundColor Red
}

function Print-Info {
    param([string]$Message)
    Write-Host "ℹ $Message" -ForegroundColor Yellow
}

# Check prerequisites
Write-Host "Checking prerequisites..."

try {
    docker --version | Out-Null
    Print-Success "Docker is installed"
} catch {
    Print-Error "Docker is not installed"
    exit 1
}

try {
    docker-compose --version | Out-Null
    Print-Success "Docker Compose is installed"
} catch {
    Print-Error "Docker Compose is not installed"
    exit 1
}

try {
    node --version | Out-Null
    Print-Success "Node.js is installed"
} catch {
    Print-Error "Node.js is not installed"
    exit 1
}

Write-Host ""

# Create test environment file
Write-Host "Creating test environment configuration..."
$token1 = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$token2 = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})
$token3 = -join ((48..57) + (97..102) | Get-Random -Count 32 | ForEach-Object {[char]$_})

@"
MCP_AUTH_TOKENS=test-token-$token1
MINECRAFT_AUTH_TOKEN=test-minecraft-$token2
MCP_AUTH_TOKEN=test-token-$token3
MESSAGE_QUEUE_SIZE=100
HEARTBEAT_INTERVAL=10000
LOG_LEVEL=debug
MCP_LOG_LEVEL=DEBUG
"@ | Out-File -FilePath .env.test -Encoding utf8
Print-Success "Test environment created"

Write-Host ""

# Install dependencies
Write-Host "Installing dependencies..."
npm ci 2>&1 | Out-Null
Print-Success "Dependencies installed"

Write-Host ""

# Build TypeScript packages
Write-Host "Building TypeScript packages..."
npm run build 2>&1 | Out-Null
Print-Success "TypeScript packages built"

Write-Host ""

# Build Docker images
Write-Host "Building Docker images..."
Print-Info "This may take a few minutes on first run..."

docker-compose build 2>&1 | Out-Null
Print-Success "Docker images built successfully"

Write-Host ""

# Start services
Write-Host "Starting services..."
docker-compose --env-file .env.test up -d

# Wait for services to be ready
Print-Info "Waiting for services to start (15 seconds)..."
Start-Sleep -Seconds 15

Write-Host ""

# Test Bridge Server health
Write-Host "Testing Bridge Server health endpoint..."
try {
    $response = Invoke-RestMethod -Uri "http://localhost:8081/health" -Method Get
    Print-Success "Bridge Server is responding"
    
    if ($response.status -eq "ok") {
        Print-Success "Health check status: $($response.status)"
        Print-Info "Version: $($response.version)"
        Print-Info "MCP connections: $($response.connections.mcp)"
    } else {
        Print-Error "Health check returned unexpected status: $($response.status)"
    }
} catch {
    Print-Error "Bridge Server is not responding"
}

Write-Host ""

# Check container logs for errors
Write-Host "Checking container logs for errors..."

$bridgeLogs = docker-compose logs bridge-server 2>&1 | Select-String -Pattern "error" -CaseSensitive:$false | Where-Object { $_ -notmatch "0 error" }
$mcpLogs = docker-compose logs mcp-server 2>&1 | Select-String -Pattern "error" -CaseSensitive:$false | Where-Object { $_ -notmatch "0 error" }

if ($bridgeLogs.Count -eq 0) {
    Print-Success "No errors in Bridge Server logs"
} else {
    Print-Error "Found $($bridgeLogs.Count) error(s) in Bridge Server logs"
    $bridgeLogs | Select-Object -Last 5 | ForEach-Object { Write-Host $_ }
}

if ($mcpLogs.Count -eq 0) {
    Print-Success "No errors in MCP Server logs"
} else {
    Print-Error "Found $($mcpLogs.Count) error(s) in MCP Server logs"
    $mcpLogs | Select-Object -Last 5 | ForEach-Object { Write-Host $_ }
}

Write-Host ""

# Check if containers are running
Write-Host "Checking container status..."

$bridgeId = docker-compose ps -q bridge-server
$mcpId = docker-compose ps -q mcp-server

if ($bridgeId) {
    $bridgeStatus = docker inspect -f '{{.State.Status}}' $bridgeId
    if ($bridgeStatus -eq "running") {
        Print-Success "Bridge Server container is running"
    } else {
        Print-Error "Bridge Server container status: $bridgeStatus"
    }
} else {
    Print-Error "Bridge Server container not found"
}

if ($mcpId) {
    $mcpStatus = docker inspect -f '{{.State.Status}}' $mcpId
    if ($mcpStatus -eq "running") {
        Print-Success "MCP Server container is running"
    } else {
        Print-Error "MCP Server container status: $mcpStatus"
    }
} else {
    Print-Error "MCP Server container not found"
}

Write-Host ""

# Test WebSocket connectivity
Write-Host "Testing WebSocket connectivity..."
try {
    $tcpClient = New-Object System.Net.Sockets.TcpClient
    $tcpClient.Connect("localhost", 8080)
    $tcpClient.Close()
    Print-Success "WebSocket port is accessible"
} catch {
    Print-Error "WebSocket connection failed"
}

Write-Host ""

# Cleanup
Write-Host "Cleaning up test environment..."
docker-compose --env-file .env.test down 2>&1 | Out-Null
Remove-Item -Path .env.test -Force
Print-Success "Cleanup complete"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Docker test complete!" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To start the services for real:"
Write-Host "  1. Copy .env.docker.example to .env"
Write-Host "  2. Edit .env with secure tokens"
Write-Host "  3. Run: docker-compose up -d"
Write-Host ""
