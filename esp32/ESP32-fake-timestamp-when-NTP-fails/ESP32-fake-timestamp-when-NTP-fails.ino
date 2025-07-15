/*
  Refactored ESP32 + DS18B20 + Async MQTT Example
  ------------------------------------------------
  - Connects to Wi-Fi and an MQTT broker
  - Uses NTP (time.nist.gov) for timestamping
  - Reads temperature from a DS18B20 every minute and publishes to "temperature" topic
  - Publishes a status message ("WiFi OK | MQTT OK | Time: ...") every minute to "status" topic
  - If NTP fails, publishes an error to "errors" topic, and still publishes the temperature (or status)
    with a generic fallback timestamp of "01.01.2000 00:00:00"
  - Reconnect logic for both Wi-Fi and MQTT using FreeRTOS timers

  Required Libraries:
    - WiFi.h              (built into ESP32 Arduino core)
    - OneWire.h           (DallasTemperature dependency)
    - DallasTemperature.h
    - AsyncMqttClient.h   (and its dependency AsyncTCP)
    - time.h              (ESP32 core)
*/

#include <WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <AsyncMqttClient.h>
#include "time.h"

// ─── FORWARD DECLARATIONS ────────────────────────────────────────────────────
void connectToWifi();
void connectToMqtt();
void WiFiEvent(WiFiEvent_t event);
void onMqttConnect(bool sessionPresent);
void onMqttDisconnect(AsyncMqttClientDisconnectReason reason);
void onMqttPublish(uint16_t packetId);

bool getFormattedTime(char *buffer, size_t bufferLen);
void publishTemperature(const char *timeStr, const char *mac, float temperature);
void publishStatusOK(const char *timeStr, const char *mac);
void publishTimeError(const char *errorMsg);

// ─────────────────────────────────────────────────────────────────────────────
// GPIO WHERE THE DS18B20 IS CONNECTED
// ─────────────────────────────────────────────────────────────────────────────
const int oneWireBus = 13;
OneWire oneWire(oneWireBus);
DallasTemperature sensors(&oneWire);

// ─────────────────────────────────────────────────────────────────────────────
// WI-FI CREDENTIALS
// ─────────────────────────────────────────────────────────────────────────────
#define WIFI_SSID       "ZTE_9AF407"
#define WIFI_PASSWORD   "2BEX7237"

// ─────────────────────────────────────────────────────────────────────────────
// NTP CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
const char *ntpServer        = "time.nist.gov";
const long gmtOffset_sec     = 3600;   // UTC+1
const int daylightOffset_sec = 3600;   // +1 hour DST

// ─────────────────────────────────────────────────────────────────────────────
// MQTT BROKER CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────
#define MQTT_HOST       "lily-bridge.online"
#define MQTT_PORT       1883
#define MQTT_USERNAME   "lily"
#define MQTT_PASSWORD   "Radar#Cicler"

#define MQTT_PUB_TEMP    "temperature"
#define MQTT_PUB_STATUS  "status"
#define MQTT_PUB_ERROR   "errors"

AsyncMqttClient mqttClient;
TimerHandle_t mqttReconnectTimer;
TimerHandle_t wifiReconnectTimer;

// ─────────────────────────────────────────────────────────────────────────────
// PUBLISH INTERVALS
// ─────────────────────────────────────────────────────────────────────────────
unsigned long previousTempMillis    = 0;
const long intervalTempPublish      = 60000;    // 60,000 ms = 1 minute

unsigned long previousStatusMillis  = 0;
const long intervalStatusPublish    = 60000;    // 1 minute

// ─────────────────────────────────────────────────────────────────────────────
// FALLBACK TIMESTAMP (used when getLocalTime() fails)
// ─────────────────────────────────────────────────────────────────────────────
const char *FALLBACK_TIMESTAMP = "01.01.2000 00:00:00";

void setup() {
  Serial.begin(115200);
  Serial.println();
  sensors.begin();

  // Create FreeRTOS timers for reconnection logic
  mqttReconnectTimer = xTimerCreate(
    "mqttTimer",
    pdMS_TO_TICKS(20000),      // 20 seconds
    pdFALSE,
    (void*)0,
    reinterpret_cast<TimerCallbackFunction_t>(connectToMqtt)
  );
  wifiReconnectTimer = xTimerCreate(
    "wifiTimer",
    pdMS_TO_TICKS(20000),      // 20 seconds
    pdFALSE,
    (void*)0,
    reinterpret_cast<TimerCallbackFunction_t>(connectToWifi)
  );

  // Register Wi-Fi event handler
  WiFi.onEvent(WiFiEvent);

  // Register MQTT callbacks
  mqttClient.onConnect(onMqttConnect);
  mqttClient.onDisconnect(onMqttDisconnect);
  mqttClient.onPublish(onMqttPublish);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCredentials(MQTT_USERNAME, MQTT_PASSWORD);

  // Kick off Wi-Fi connection
  connectToWifi();

  // Disable power save to reduce spurious disconnects
  WiFi.setSleep(false);
  WiFi.setTxPower(WIFI_POWER_19_5dBm);  // optional boost transmit power

  // Configure NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
}

void loop() {
  unsigned long currentMillis = millis();

  // ─── TEMPERATURE PUBLISH LOOP ───────────────────────────────────────────────
  if (currentMillis - previousTempMillis >= intervalTempPublish) {
    previousTempMillis = currentMillis;

    // Read temperature
    sensors.requestTemperatures();
    float temperature = sensors.getTempCByIndex(0);

    // Get formatted time and MAC
    char timeBuf[32];
    if (getFormattedTime(timeBuf, sizeof(timeBuf))) {
      // Normal path: publish with real timestamp
      publishTemperature(timeBuf, WiFi.macAddress().c_str(), temperature);
    } else {
      // Fallback: publish temp with generic timestamp, then publish an error
      publishTemperature(FALLBACK_TIMESTAMP, WiFi.macAddress().c_str(), temperature);
      publishTimeError("Failed to obtain time for temperature");
    }
  }

  // ─── STATUS PUBLISH LOOP ───────────────────────────────────────────────────
  if (currentMillis - previousStatusMillis >= intervalStatusPublish) {
    previousStatusMillis = currentMillis;

    char timeBuf[32];
    if (getFormattedTime(timeBuf, sizeof(timeBuf))) {
      // Normal path: publish status with real timestamp
      publishStatusOK(timeBuf, WiFi.macAddress().c_str());
    } else {
      // Fallback: publish status with generic timestamp, then publish an error
      publishStatusOK(FALLBACK_TIMESTAMP, WiFi.macAddress().c_str());
      publishTimeError("Failed to obtain time for status");
    }
  }

  // FreeRTOS timers and callbacks handle reconnections; no blocking here
}

// ─────────────────────────────────────────────────────────────────────────────
// Attempt to connect to Wi-Fi
// ─────────────────────────────────────────────────────────────────────────────
void connectToWifi() {
  Serial.println("Connecting to Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// ─────────────────────────────────────────────────────────────────────────────
// Wi-Fi Event Handler
// ─────────────────────────────────────────────────────────────────────────────
void WiFiEvent(WiFiEvent_t event) {
  Serial.printf("[WiFi-event] ID: %d\n", event);
  switch (event) {

    case ARDUINO_EVENT_WIFI_STA_START:
      Serial.println("WiFi STA started");
      break;

    case ARDUINO_EVENT_WIFI_STA_CONNECTED:
      Serial.println("WiFi STA connected to SSID");
      break;

    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.print("WiFi got IPv4 address: ");
      Serial.println(WiFi.localIP());
      Serial.printf("→ Now RSSI: %d dBm\n", WiFi.RSSI());
      connectToMqtt();
      break;

    case ARDUINO_EVENT_WIFI_STA_GOT_IP6:
      // Event ID 5: IPv6 obtained. Not a “real” disconnect—just log it.
      Serial.print("WiFi got IPv6 address: ");
      Serial.println(WiFi.localIPv6());
      break;

    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("WiFi lost connection (true DISCONNECT event)");
      xTimerStop(mqttReconnectTimer, 0);
      xTimerStart(wifiReconnectTimer, 0);
      break;

    default:
      // Ignore other events (e.g. ARDUINO_EVENT_WIFI_STA_LOST_IP = 11)
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Attempt to connect to MQTT
// ─────────────────────────────────────────────────────────────────────────────
void connectToMqtt() {
  Serial.println("Connecting to MQTT broker...");
  mqttClient.connect();
}

// ─────────────────────────────────────────────────────────────────────────────
// MQTT Connect Callback
// ─────────────────────────────────────────────────────────────────────────────
void onMqttConnect(bool sessionPresent) {
  Serial.println("Connected to MQTT broker");
  Serial.printf("Session present: %d\n", sessionPresent);

  // Immediately publish a status message upon connect
  char timeBuf[32];
  if (getFormattedTime(timeBuf, sizeof(timeBuf))) {
    publishStatusOK(timeBuf, WiFi.macAddress().c_str());
  } else {
    publishStatusOK(FALLBACK_TIMESTAMP, WiFi.macAddress().c_str());
    publishTimeError("Failed to obtain time on MQTT connect");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MQTT Disconnect Callback
// ─────────────────────────────────────────────────────────────────────────────
void onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
  Serial.printf("Disconnected from MQTT, reason: %d\n", static_cast<int>(reason));
  if (WiFi.isConnected()) {
    xTimerStart(mqttReconnectTimer, 0);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// MQTT Publish Acknowledgement Callback
// ─────────────────────────────────────────────────────────────────────────────
void onMqttPublish(uint16_t packetId) {
  Serial.printf("Publish acknowledged, packetId: %u\n", packetId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Get current local time as formatted string "DD.MM.YYYY HH:MM:SS"
// Returns true if successful, false if NTP/time is not available
// ─────────────────────────────────────────────────────────────────────────────
bool getFormattedTime(char *buffer, size_t bufferLen) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return false;
  }
  strftime(buffer, bufferLen, "%d.%m.%Y %H:%M:%S", &timeinfo);
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish a temperature reading to MQTT_PUB_TEMP
// ─────────────────────────────────────────────────────────────────────────────
void publishTemperature(const char *timeStr, const char *mac, float temperature) {
  char payload[128];
  // Format: "<ChipModel>@<MAC> | T: <temp>°C | Time: <timeStr>"
  snprintf(
    payload,
    sizeof(payload),
    "%s@%s | T: %.2f°C | Time: %s",
    ESP.getChipModel(),
    mac,
    temperature,
    timeStr
  );
  uint16_t packetId = mqttClient.publish(
    MQTT_PUB_TEMP,
    1,       // QoS 1
    true,    // retain = true
    payload
  );
  Serial.printf("Published temperature (packetId=%u): %s\n", packetId, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish a “status OK” message to MQTT_PUB_STATUS
// ─────────────────────────────────────────────────────────────────────────────
void publishStatusOK(const char *timeStr, const char *mac) {
  char payload[128];
  // Format: "<ChipModel>@<MAC> | WiFi OK | MQTT OK | Time: <timeStr>"
  snprintf(
    payload,
    sizeof(payload),
    "%s@%s | WiFi OK | MQTT OK | Time: %s",
    ESP.getChipModel(),
    mac,
    timeStr
  );
  uint16_t packetId = mqttClient.publish(
    MQTT_PUB_STATUS,
    1,       // QoS 1
    true,    // retain = true
    payload
  );
  Serial.printf("Published status OK (packetId=%u): %s\n", packetId, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// Publish an NTP/time-acquisition error to MQTT_PUB_ERROR
// ─────────────────────────────────────────────────────────────────────────────
void publishTimeError(const char *errorMsg) {
  char payload[128];
  // Format: "<ChipModel>@<MAC> | ERROR: <errorMsg>"
  snprintf(
    payload,
    sizeof(payload),
    "%s@%s | ERROR: %s",
    ESP.getChipModel(),
    WiFi.macAddress().c_str(),
    errorMsg
  );
  uint16_t packetId = mqttClient.publish(
    MQTT_PUB_ERROR,
    1,       // QoS 1
    true,    // retain = true
    payload
  );
  Serial.printf("Published time error (packetId=%u): %s\n", packetId, payload);
}
