#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_PWMServoDriver.h>

// ==================== CONFIGURATION ====================
const char* SSID = "Voice";
const char* PASSWORD = "ul20ul40";
const char* WS_SERVER = "172.213.160.136";
const uint16_t WS_PORT = 8080;

Adafruit_PWMServoDriver pwm = Adafruit_PWMServoDriver();

const uint8_t SERVO_CHANNELS[6] = {0,1,2,3,4,5};
#define SERVO_FREQ 50
#define SERVOMIN 102
#define SERVOMAX 512

// ==================== GLOBAL VARIABLES ====================
WebSocketsClient webSocket;
bool connected = false;

// Current positions (source of truth)
uint8_t motorAngles[6] = {90,90,90,90,90,90};
// Target positions
uint8_t targetAngles[6] = {90,90,90,90,90,90};

// State sync interval
unsigned long lastStateSync = 0;
const unsigned long STATE_SYNC_INTERVAL = 2000; // Send full state every 2 seconds

// Non-blocking step timer for smooth movement
unsigned long lastStep = 0;
const unsigned long stepInterval = 15; // ms per degree

// ==================== FUNCTION DECLARATIONS ====================
void connectToWiFi();
void setupWebSocket();
void webSocketEvent(WStype_t type, uint8_t* payload, size_t length);
bool testPCA9685();
void initializeServos();
void moveServo(uint8_t motorIndex, uint8_t angle);
void handleMotorCommand(char* jsonString);
uint16_t angleToPulse(uint8_t angle);
void printSystemStatus();
void updateServoMovements();
void sendMotorUpdate(uint8_t motorId, uint8_t angle);
void sendStateSync();

// ==================== SETUP ====================
void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n=================================");
    Serial.println(" Robotic Arm ESP32 Controller");
    Serial.println("=================================");
    
    // Test PCA9685 connection FIRST
    if (!testPCA9685()) {
        Serial.println("[ERROR] PCA9685 not detected! Check wiring.");
        Serial.println("[ERROR] System halted. Please fix connections and reset.");
        while (1) {
            delay(1000);
            Serial.println("[ERROR] PCA9685 not found. Waiting for reset...");
        }
    }
    
    initializeServos();
    connectToWiFi();
    setupWebSocket();
    Serial.println("\n[SETUP] Initialization complete!");
}

// ==================== MAIN LOOP ====================
void loop() {
    // Reconnect WiFi if lost
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WiFi] Lost connection. Reconnecting...");
        WiFi.disconnect();
        WiFi.begin(SSID, PASSWORD);
        unsigned long start = millis();
        while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
            delay(500);
            Serial.print(".");
        }
        Serial.println();
    }

    webSocket.loop(); // ALWAYS keep WebSocket alive
    updateServoMovements();
    
    // Send periodic state sync
    if (connected && (millis() - lastStateSync >= STATE_SYNC_INTERVAL)) {
        sendStateSync();
        lastStateSync = millis();
    }
    
    delay(10);
}

// ==================== WIFI FUNCTIONS ====================
void connectToWiFi() {
    Serial.print("\n[WiFi] Connecting to SSID: "); Serial.println(SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(SSID, PASSWORD);
    uint8_t attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 20) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("\n[WiFi] Connected!");
        Serial.print("[WiFi] IP Address: "); Serial.println(WiFi.localIP());
    } else {
        Serial.println("\n[WiFi] FAILED to connect!");
    }
}

// ==================== WEBSOCKET FUNCTIONS ====================
void setupWebSocket() {
    Serial.println("\n[WebSocket] Setting up connection...");
    webSocket.begin(WS_SERVER, WS_PORT, "/");
    webSocket.onEvent(webSocketEvent);
    webSocket.setReconnectInterval(5000);
    webSocket.enableHeartbeat(15000, 3000, 2);
    Serial.println("[WebSocket] Attempting to connect...");
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
    switch (type) {
        case WStype_DISCONNECTED:
            Serial.println("[WebSocket] Disconnected!");
            connected = false;
            break;
        case WStype_CONNECTED:
            Serial.println("[WebSocket] Connected to server!");
            connected = true;
            webSocket.sendTXT("ESP32");
            Serial.println("[WebSocket] Sent ESP32 registration");
            // Send initial state sync
            sendStateSync();
            break;
        case WStype_PING:
            break;
        case WStype_PONG:
            break;
        case WStype_TEXT:
        {
            char* data = (char*)payload;
            Serial.print("[WebSocket] Received: "); Serial.println(data);
            handleMotorCommand(data);
            break;
        }
        case WStype_BIN:
            Serial.println("[WebSocket] Received binary data (not supported)");
            break;
        case WStype_ERROR:
            Serial.println("[WebSocket] Error!");
            break;
        default:
            break;
    }
}

// ==================== PCA9685 TEST FUNCTION ====================
bool testPCA9685() {
    Serial.println("\n[PCA9685] Testing connection...");
    
    // Initialize I2C with your pins
    Wire.begin(42, 41);
    
    // Try to detect PCA9685 at default address 0x40
    Wire.beginTransmission(0x40);
    uint8_t error = Wire.endTransmission();
    
    if (error == 0) {
        Serial.println("[PCA9685] ✅ Device detected at address 0x40!");
        return true;
    } else {
        Serial.print("[PCA9685] ❌ Device NOT detected! Error code: ");
        Serial.println(error);
        Serial.println("[PCA9685] Please check:");
        Serial.println(" 1. Power connections (VCC and GND)");
        Serial.println(" 2. I2C connections (SDA=GPIO42, SCL=GPIO41)");
        Serial.println(" 3. PCA9685 board is powered");
        return false;
    }
}

// ==================== SERVO CONTROL ====================
void initializeServos() {
    Serial.println("\n[Servos] Initializing PCA9685...");
    Wire.begin(42,41);         
    pwm.begin();
    pwm.setPWMFreq(SERVO_FREQ);
    delay(100);

    for (int i = 0; i < 6; i++) {
        moveServo(i, motorAngles[i]);
        Serial.print("[Servos] Motor "); Serial.print(i + 1);
        Serial.print(" assigned to PCA9685 channel "); Serial.println(SERVO_CHANNELS[i]);
    }
    Serial.println("[Servos] All motors initialized!");
}

uint16_t angleToPulse(uint8_t angle) {
    return map(angle, 0, 180, SERVOMIN, SERVOMAX);
}

void moveServo(uint8_t motorIndex, uint8_t angle) {
    if (motorIndex >= 6) {
        Serial.println("[ERROR] Invalid motor index");
        return;
    }
    motorAngles[motorIndex] = angle;
    targetAngles[motorIndex] = angle;
    uint16_t pulse = angleToPulse(angle);
    pwm.setPWM(SERVO_CHANNELS[motorIndex], 0, pulse);

    Serial.print("[Motor "); Serial.print(motorIndex + 1);
    Serial.print("] Moving to "); Serial.print(angle);
    Serial.print("° Pulse="); Serial.println(pulse);
    
    // Send motor update to server (ESP32 is source of truth)
    sendMotorUpdate(motorIndex + 1, angle);
}

// ==================== MOTOR COMMAND HANDLER ====================
void handleMotorCommand(char* jsonString) {
    DynamicJsonDocument doc(200);
    DeserializationError error = deserializeJson(doc, jsonString);
    if (error) {
        Serial.print("[ERROR] JSON parsing failed: "); Serial.println(error.c_str());
        return;
    }
    
    // Handle single motor command from browser
    if (!doc.containsKey("motorId") || !doc.containsKey("angle")) {
        Serial.println("[ERROR] Missing motorId or angle in command");
        return;
    }
    
    uint8_t motorId = doc["motorId"].as<uint8_t>();
    uint8_t angle = doc["angle"].as<uint8_t>();

    if (motorId < 1 || motorId > 6) {
        Serial.print("[ERROR] Invalid motorId: "); Serial.println(motorId);
        return;
    }
    if (angle > 180) {
        Serial.print("[ERROR] Invalid angle: "); Serial.println(angle);
        return;
    }
    
    // Set target for smooth movement
    targetAngles[motorId - 1] = angle;
    Serial.print("[Command] Motor "); Serial.print(motorId);
    Serial.print(" target set to "); Serial.println(angle);
}

// ==================== TWO-WAY COMMUNICATION ====================
void sendMotorUpdate(uint8_t motorId, uint8_t angle) {
    if (!connected) return;
    
    StaticJsonDocument<100> doc;
    doc["type"] = "motorUpdate";
    doc["motorId"] = motorId;
    doc["angle"] = angle;
    
    char buffer[100];
    serializeJson(doc, buffer);
    webSocket.sendTXT(buffer);
    Serial.print("[TX] motorUpdate: M"); Serial.print(motorId);
    Serial.print("="); Serial.println(angle);
}

void sendStateSync() {
    if (!connected) return;
    
    StaticJsonDocument<200> doc;
    doc["type"] = "stateSync";
    JsonArray angles = doc.createNestedArray("angles");
    for (int i = 0; i < 6; i++) {
        angles.add(motorAngles[i]);
    }
    
    char buffer[200];
    serializeJson(doc, buffer);
    webSocket.sendTXT(buffer);
    Serial.print("[TX] stateSync: [");
    for (int i = 0; i < 6; i++) {
        Serial.print(motorAngles[i]);
        if (i < 5) Serial.print(", ");
    }
    Serial.println("]");
}

// ==================== SERVO MOVEMENT ENGINE ====================
void updateServoMovements() {
    // Time-based stepping for smooth movement
    if (millis() - lastStep >= stepInterval) {
        lastStep = millis();
        
        for (int i = 0; i < 6; i++) {
            if (motorAngles[i] != targetAngles[i]) {
                if (motorAngles[i] < targetAngles[i]) {
                    motorAngles[i]++;
                } else {
                    motorAngles[i]--;
                }
                uint16_t pulse = angleToPulse(motorAngles[i]);
                pwm.setPWM(SERVO_CHANNELS[i], 0, pulse);
                
                // Send motor update only when servo reaches target
                if (motorAngles[i] == targetAngles[i]) {
                    sendMotorUpdate(i + 1, motorAngles[i]);
                }
            }
        }
    }
}

// ==================== UTILITY FUNCTIONS ====================
void printSystemStatus() {
    Serial.println("\n=== SYSTEM STATUS ===");
    Serial.print("WiFi Connected: "); Serial.println(WiFi.status() == WL_CONNECTED ? "YES" : "NO");
    Serial.print("WebSocket Connected: "); Serial.println(connected ? "YES" : "NO");
    Serial.println("Current Motor Angles:");
    for (int i = 0; i < 6; i++) {
        Serial.print(" Motor "); Serial.print(i + 1);
        Serial.print(": "); Serial.print(motorAngles[i]); 
        Serial.print("° (Target: "); Serial.print(targetAngles[i]); Serial.println("°)");
    }
    Serial.println("====================\n");
}