# Integration Tests Quick Reference

This document provides a quick reference for running the integration tests for the Minecraft MCP Bridge system.

## Quick Start

### Prerequisites

Ensure you have Node.js (v18+) and npm installed:

```bash
node --version
npm --version
```

### Install Dependencies

From the project root:

```bash
npm install
```

### Build the Project

```bash
npm run build
```

### Run Integration Tests

```bash
npm run test:integration
```

## What Gets Tested

The integration tests validate **Requirement 6.5** by testing:

1. ✅ **Event Flow**: Minecraft events → Bridge → MCP notifications
2. ✅ **Command Flow**: MCP commands → Bridge → Minecraft execution
3. ✅ **Reconnection**: Automatic reconnection after connection loss
4. ✅ **Authentication**: Token validation and rejection of invalid tokens
5. ✅ **Authorization**: Permission checks for commands and events
6. ✅ **Query Flow**: Server state queries from MCP to Minecraft
7. ✅ **Message Latency**: Sub-100ms message forwarding

## Test Architecture

```
Integration Tests
    ↓
Real Bridge Server (port 18080)
    ↓
Simulated MCP & Minecraft Clients (WebSocket)
```

The tests use:
- **Real Bridge Server**: Actual production code
- **Simulated Clients**: WebSocket clients that mimic MCP Server and Minecraft Mod behavior

## Running Tests

### All Integration Tests

```bash
npm run test:integration
```

### Specific Test Suite

```bash
cd integration-tests
npm test -- --testNamePattern="Event Flow"
```

### With Verbose Output

```bash
cd integration-tests
npm test -- --verbose
```

### Using Helper Scripts

**Linux/Mac:**
```bash
chmod +x integration-tests/run-tests.sh
./integration-tests/run-tests.sh
```

**Windows:**
```powershell
.\integration-tests\run-tests.ps1
```

## Test Results

Expected output:
```
PASS  system.integration.test.ts
  Minecraft MCP Bridge Integration Tests
    Event Flow
      ✓ should forward player join event from Minecraft to MCP (XXms)
      ✓ should forward player chat event from Minecraft to MCP (XXms)
    Command Flow
      ✓ should forward execute_command from MCP to Minecraft (XXms)
      ✓ should forward send_message command from MCP to Minecraft (XXms)
      ✓ should handle command errors from Minecraft (XXms)
    Reconnection
      ✓ should allow client to reconnect after disconnection (XXms)
    Authentication
      ✓ should reject connection with invalid token (XXms)
      ✓ should reject connection with missing token (XXms)
      ✓ should accept connection with valid MCP token (XXms)
      ✓ should accept connection with valid Minecraft token (XXms)
    Authorization
      ✓ should reject dangerous commands from MCP client (XXms)
      ✓ should reject events from MCP client (XXms)
      ✓ should reject commands from Minecraft client (XXms)
    Query Flow
      ✓ should forward get_online_players query (XXms)
      ✓ should handle query errors from Minecraft (XXms)
    Message Latency
      ✓ should forward events within 100ms (XXms)

Test Suites: 1 passed, 1 total
Tests:       16 passed, 16 total
```

## Troubleshooting

### Port Already in Use

If you see "EADDRINUSE" errors:

**Windows:**
```powershell
netstat -ano | findstr :18080
taskkill /PID <PID> /F
```

**Linux/Mac:**
```bash
lsof -ti:18080 | xargs kill -9
```

### Tests Timeout

If tests timeout:
1. Check that no firewall is blocking localhost connections
2. Verify Node.js version is 18 or higher
3. Try running tests with increased timeout:
   ```bash
   cd integration-tests
   npm test -- --testTimeout=60000
   ```

### Build Errors

If you see TypeScript errors:
```bash
npm run clean
npm install
npm run build
```

## CI/CD Integration

The integration tests are designed for CI/CD:

```yaml
# Example GitHub Actions workflow
- name: Install dependencies
  run: npm install

- name: Build project
  run: npm run build

- name: Run integration tests
  run: npm run test:integration
```

## Documentation

For detailed information, see:
- `integration-tests/README.md` - Comprehensive test documentation
- `integration-tests/IMPLEMENTATION_SUMMARY.md` - Implementation details
- `.kiro/specs/minecraft-mcp-bridge/requirements.md` - System requirements
- `.kiro/specs/minecraft-mcp-bridge/design.md` - System design

## Test Coverage Summary

| Category | Tests | Status |
|----------|-------|--------|
| Event Flow | 2 | ✅ |
| Command Flow | 3 | ✅ |
| Reconnection | 1 | ✅ |
| Authentication | 4 | ✅ |
| Authorization | 3 | ✅ |
| Query Flow | 2 | ✅ |
| Message Latency | 1 | ✅ |
| **Total** | **16** | **✅** |

## Next Steps

After running integration tests:

1. Review test results for any failures
2. Check Bridge Server logs for detailed information
3. Run unit tests for individual components:
   ```bash
   npm test
   ```
4. Proceed to Task 12: Final Checkpoint

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review test logs for error details
3. Consult the detailed README in `integration-tests/`
4. Check the implementation summary for architecture details
