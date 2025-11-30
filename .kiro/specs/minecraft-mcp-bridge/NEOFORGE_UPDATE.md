# NeoForge Update Summary

## Overview

The Minecraft MCP Bridge specification has been updated to target **NeoForge** instead of Spigot/Paper. This document summarizes all changes made to the requirements, design, and tasks documents.

## Key Changes

### Platform Change

**Before:** Spigot/Paper (Bukkit API)  
**After:** NeoForge

### Language Change

**Before:** Kotlin  
**After:** Java

### Configuration Format Change

**Before:** YAML (`config.yml`)  
**After:** TOML (`minecraft-mcp-bridge.toml`)

### Testing Framework Change

**Before:** Kotest (Kotlin property testing)  
**After:** jqwik (Java property testing)

## Terminology Updates

All references have been updated throughout the specification:

| Old Term | New Term |
|----------|----------|
| Minecraft Plugin | Minecraft Mod |
| Plugin | Mod |
| Spigot/Paper | NeoForge |
| Bukkit API | NeoForge API |
| Kotlin | Java |
| config.yml | minecraft-mcp-bridge.toml |
| plugins/ directory | mods/ directory |
| Kotest | jqwik |

## Updated Components

### 1. Requirements Document

**File:** `.kiro/specs/minecraft-mcp-bridge/requirements.md`

**Changes:**
- Updated glossary to define "Minecraft Mod" and "NeoForge"
- Changed all "Plugin" references to "Mod"
- Updated all requirement acceptance criteria to reference the Mod instead of Plugin

### 2. Design Document

**File:** `.kiro/specs/minecraft-mcp-bridge/design.md`

**Changes:**

#### Architecture
- Updated component diagram to show "Minecraft Mod" instead of "Plugin"
- Changed API reference from "Bukkit API" to "NeoForge API"

#### Minecraft Mod Section
- **Technology:** Changed from "Kotlin with Spigot/Paper API" to "Java with NeoForge API"
- **Event Handlers:** Updated to use NeoForge event system:
  - `PlayerEvent.PlayerLoggedInEvent` (instead of `PlayerJoinEvent`)
  - `PlayerEvent.PlayerLoggedOutEvent` (instead of `PlayerQuitEvent`)
  - `ServerChatEvent` (instead of `AsyncPlayerChatEvent`)
  - `LivingDeathEvent` (instead of `PlayerDeathEvent`)
  - `BlockEvent.BreakEvent` (same name, different API)
- **Configuration:** Changed from YAML to TOML format
- **Code Examples:** Converted from Kotlin to Java syntax

#### Testing Strategy
- Changed property testing framework from Kotest to jqwik
- Updated example property test code from Kotlin to Java

#### Deployment
- Changed deployment directory from `plugins/` to `mods/`
- Changed configuration path from `plugins/MinecraftMCPBridge/config.yml` to `config/minecraft-mcp-bridge.toml`
- Updated server requirement from "Spigot or Paper server (1.19+)" to "NeoForge server (Minecraft 1.20.1+)"

#### Technology Stack
- Updated table to show "Java" and "NeoForge API" instead of "Kotlin" and "Spigot/Paper API"

### 3. Tasks Document

**File:** `.kiro/specs/minecraft-mcp-bridge/tasks.md`

**Changes:**

#### Task 1: Project Setup
- Changed package name from `minecraft-plugin` to `minecraft-mod`
- Updated build system from "Gradle/Maven" to "Gradle"
- Changed language from "Kotlin" to "Java and NeoForge"
- Updated testing framework from "Kotest" to "JUnit/jqwik"

#### Task 6: Minecraft Mod Implementation
- Changed from "Create Spigot/Paper plugin with Kotlin" to "Create NeoForge mod with Java"
- Updated lifecycle from "onEnable, onDisable" to "@Mod annotation, event bus registration"
- Changed configuration from "config.yml" to "minecraft-mcp-bridge.toml"

#### Task 6.1: Event Listeners
- Updated all event types to NeoForge equivalents:
  - `PlayerEvent.PlayerLoggedInEvent`
  - `PlayerEvent.PlayerLoggedOutEvent`
  - `ServerChatEvent`
  - `LivingDeathEvent` (with player filter)
  - `BlockEvent.BreakEvent`

#### Task 6.2: Event Filtering
- Changed configuration file reference from `config.yml` to `minecraft-mcp-bridge.toml`

#### Task 6.4: Command Executor
- Changed from "Bukkit scheduler" to "server.execute()"

#### Task 6.5: Command Whitelist
- Changed configuration file reference from `config.yml` to `minecraft-mcp-bridge.toml`

#### Task 6.8: Logging
- Changed "plugin startup" to "mod startup"

#### Task 9: Configuration Files
- Changed from "config.yml for Minecraft Plugin" to "minecraft-mcp-bridge.toml for Minecraft Mod"

#### Task 10: Deployment
- Changed from "Minecraft Plugin JAR" to "Minecraft Mod JAR to NeoForge server"

## NeoForge-Specific Implementation Notes

### Event System
NeoForge uses an event bus system with `@SubscribeEvent` annotations:

```java
@SubscribeEvent
public void onPlayerJoin(PlayerEvent.PlayerLoggedInEvent event) {
    // Handle player join
}
```

### Mod Structure
NeoForge mods use the `@Mod` annotation:

```java
@Mod("minecraft_mcp_bridge")
public class MinecraftMCPBridge {
    public MinecraftMCPBridge() {
        // Register event handlers
        MinecraftForge.EVENT_BUS.register(new EventHandler());
    }
}
```

### Configuration
NeoForge uses TOML configuration files located in `config/` directory:

```toml
[bridge]
url = "ws://localhost:8080"
auth_token = "secret"

[events]
enabled = ["player_join", "player_quit", "player_chat"]
```

### Command Execution
Commands are executed using the server's command dispatcher:

```java
server.getCommands().performPrefixedCommand(
    server.createCommandSourceStack(),
    command
);
```

### Gradle Build
NeoForge mods use Gradle with the NeoForge plugin:

```gradle
plugins {
    id 'net.neoforged.gradle' version '6.0.18'
}

dependencies {
    implementation "net.neoforged:neoforge:${neo_version}"
}
```

## Compatibility Notes

### Minecraft Version
- **Target:** Minecraft 1.20.1+ with NeoForge
- NeoForge is the continuation of MinecraftForge for Minecraft 1.20.1+
- Older versions would require MinecraftForge instead

### Server vs Client
- The mod is designed for **server-side** operation
- NeoForge supports both client and server mods, but this implementation focuses on server

### API Differences
Key differences from Bukkit/Spigot:
- Different event names and structures
- Different command execution system
- Different configuration system (TOML vs YAML)
- Different mod loading mechanism
- Access to more low-level Minecraft internals

## Migration Impact

### Existing Code
If any code was already written for Spigot/Paper, it will need to be rewritten for NeoForge:
- Event handlers need to be updated
- Configuration loading needs to be changed
- Command execution needs to use NeoForge APIs
- Build configuration needs to be updated

### Package Structure
The package name should be updated from `minecraft-plugin` to `minecraft-mod` throughout the codebase.

## Next Steps

1. Update the `packages/minecraft-plugin` directory to `packages/minecraft-mod`
2. Update `build.gradle.kts` to use NeoForge instead of Spigot/Paper
3. Rewrite any existing Kotlin code to Java
4. Update event handlers to use NeoForge events
5. Change configuration from YAML to TOML
6. Update tests to use jqwik instead of Kotest

## References

- [NeoForge Documentation](https://docs.neoforged.net/)
- [NeoForge GitHub](https://github.com/neoforged/NeoForge)
- [jqwik Documentation](https://jqwik.net/)
- [Minecraft Forge Events](https://docs.neoforged.net/docs/events/)
