plugins {
    id("java")
    id("net.neoforged.gradle.userdev") version "7.0.80"
}

group = "com.minecraft.mcp.bridge"
version = "1.0.0"

repositories {
    mavenCentral()
}

dependencies {
    // NeoForge
    implementation("net.neoforged:neoforge:21.0.0-beta")
    
    // WebSocket client
    implementation("org.java-websocket:Java-WebSocket:1.5.5")
    
    // JSON serialization
    implementation("com.google.code.gson:gson:2.10.1")
    
    // TOML configuration
    implementation("com.moandjiezana.toml:toml4j:0.7.2")
    
    // Testing
    testImplementation("org.junit.jupiter:junit-jupiter:5.10.1")
    testImplementation("net.jqwik:jqwik:1.8.2")
    testImplementation("org.mockito:mockito-core:5.8.0")
}

tasks.test {
    useJUnitPlatform()
}

java {
    toolchain {
        languageVersion.set(JavaLanguageVersion.of(21))
    }
}

minecraft {
    mappings("official", "1.21")
}
