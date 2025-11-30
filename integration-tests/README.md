# Integration Tests for Minecraft MCP Bridge

This directory contains comprehensive integration tests that verify the complete system behavior by testing all three components together:

- **Bridge Server**: WebSocket relay service
- **MCP Server**: Model Context Protocol server (simulated in tests)
- **Minecraft Mod**: NeoForge mod (simulated in tests)

## Test Coverage

The integration tests validate **Requirement 6.5** and cover the following scenarios:

### 1. Event Flow
- **Test**: Trigger Minecraft event → verify MCP notification
- Validates that events flow correctly from Minecraft through the Bridge to MCP clients
- Tests player join, player chat, and other game events

### 2. Command Flow
- **Test**: Invoke MCP tool → verify Minecraft command execution
- Validates that commands flow correctly from MCP through the Bridge to Minecraft
- Tests execute_command, send_message, teleport_player, and give_item commands
- Verifies error handling for failed commands

### 3. Reconnection
- **Test**: Kill connection → verify automatic reconnection
- Validates that clients can reconnect after disconnection
- Verifies that message flow continues after reconnection

### 4. Authentication
- **Test**: Connect with invalid token → verify rejection
- Validates that connections without valid tokens are rejected
- Tests both missing tokens and invalid tokens
- Verifies that valid tokens are accepted

### 5. Authorization
- **Test**: Invoke unauthorized command → verify rejection
- Validates that dangerous commands (stop, op, etc.) are blocked
- Verifies that MCP clients cannot send events
- Verifies that Minecraft clients cannot send commands

### 6. Query Flow
- Tests query commands like get_online_players, get_player_info
- Validates query error handling

### 7. Message Latency
- Verifies that messages are forwarded within 100ms (Requirement 3.4, 3.5)

## Prerequisites

Before running the integration tests, ensure you have:

1. Node.js (v18 or higher)
2. npm or yarn
3. All project dependencies installed

## Installation

From the project root:

```bash
npm install
```

This will install dependencies for all workspaces, including the integration tests.

## Running the Tests

### Run all integration tests:

```bash
npm run test:integration
```

### Run from the integration-tests directory:

```bash
cd integration-tests
npm test
```

### Run with verbose output:

```bash
cd integration-tests
npm test -- --verbose
```

### Run specific test suite:

```bash
cd integration-tests
npm test -- --testNamePattern="Event Flow"
```

## Test Architecture

The integration tests use the following approach:

1. **Start Bridge Server**: A real Bridge Server instance is started before all tests
2. **Simulate Clients**: WebSocket clients are created to simulate MCP and Minecraft connections
3. **Test Message Flow**: Messages are sent between clients through the Bridge
4. **Verify Behavior**: Assertions verify that messages are routed correctly and behavior matches requirements
5. **Cleanup**: Connections are closed and the Bridge Server is stopped after tests

## Test Helpers

The test suite includes several helper functions:

- `createAuthenticatedClient()`: Creates and authenticates a WebSocket client
- `sendAndWaitForResponse()`: Sends a message and waits for the response
- Helper functions handle timeouts and error cases

## Debugging Tests

To debug failing tests:

1. Set `LOG_LEVEL=debug` in the test environment
2. Use `--verbose` flag when running tests
3. Check the Bridge Server logs for connection and routing information
4. Use `console.log()` in test code to inspect message payloads

## Continuous Integration

These tests are designed to run in CI/CD pipelines:

- Tests run in isolation (no external dependencies)
- Tests use a dedicated test port (18080) to avoid conflicts
- Tests clean up all resources after completion
- Tests have appropriate timeouts (30 seconds per test)

## Known Limitations

1. **Minecraft Mod Simulation**: The tests simulate the Minecraft mod using WebSocket clients. They do not test the actual Java mod code.
2. **MCP Server Simulation**: The tests simulate MCP clients but do not test the full MCP Server implementation.
3. **Network Conditions**: Tests run on localhost and do not simulate network latency or packet loss.

For testing the actual Minecraft mod, see the Java unit tests in `packages/minecraft-plugin/src/test/`.

## Troubleshooting

### Port Already in Use

If you see "port already in use" errors:

```bash
# Find and kill the process using port 18080
# On Windows:
netstat -ano | findstr :18080
taskkill /PID <PID> /F

# On Linux/Mac:
lsof -ti:18080 | xargs kill -9
```

### Tests Timeout

If tests timeout:

1. Check that the Bridge Server started successfully
2. Verify no firewall is blocking localhost connections
3. Increase test timeout in jest.config.js

### Authentication Failures

If authentication tests fail:

1. Verify test tokens are correctly set in the test file
2. Check that environment variables are being read correctly
3. Review Bridge Server authentication logs

## Contributing

When adding new integration tests:

1. Follow the existing test structure
2. Use descriptive test names
3. Clean up resources in `afterEach` hooks
4. Add appropriate timeouts
5. Document what requirement the test validates
6. Update this README with new test coverage
