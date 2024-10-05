#include <WiFi.h>
#include <Wire.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <AsyncMqttClient.h>
#include "time.h"

extern "C" {
  #include "freertos/FreeRTOS.h"
  #include "freertos/timers.h"
}

// GPIO where the DS18B20 is connected
const int oneWireBus = 13;

// Setup a oneWire instance to communicate with any OneWire devices
OneWire oneWire(oneWireBus);
DallasTemperature sensors(&oneWire);  // Pass our oneWire reference to Dallas Temperature sensor 

// WiFi Credentials
#define WIFI_SSID "HUAWEI-B315-D4C8"
#define WIFI_PASSWORD "T9DFD1H4RDJ"

// NTP Server details
const char* ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 3600;  // GMT +1
const int daylightOffset_sec = 3600;

// MQTT Broker (Digital Ocean)
#define MQTT_HOST IPAddress(165, 22, 65, 210)
#define MQTT_PORT 1883
#define MQTT_USERNAME "lily"
#define MQTT_PASSWORD "Radar#Cicler"

// MQTT Topics
#define MQTT_PUB_TEST "test"
#define MQTT_PUB_STATUS "Status"
#define MQTT_PUB_ERRORS "Errors"

// MQTT Client and Timers
AsyncMqttClient mqttClient;
TimerHandle_t mqttReconnectTimer;
TimerHandle_t wifiReconnectTimer;

unsigned long previousMillis = 0;   // Stores last time temperature was published
const long interval = 60000;        // Interval at which to publish sensor readings (1 minute)

// Function Declarations
void connectToWifi();
void connectToMqtt();
void printLocalTime();
void publishStatus(const char* statusMessage);
void publishError(const char* errorMessage);
void WiFiEvent(WiFiEvent_t event);
void onMqttConnect(bool sessionPresent);
void onMqttDisconnect(AsyncMqttClientDisconnectReason reason);
void onMqttPublish(uint16_t packetId);

// WiFi Connection
void connectToWifi() {
  Serial.println("Connecting to Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}


// Handle WiFi Events
void WiFiEvent(WiFiEvent_t event) {
  Serial.printf("[WiFi-event] event: %d\n", event);
  switch (event) {
    case ARDUINO_EVENT_WIFI_STA_GOT_IP:
      Serial.println("WiFi connected");
      Serial.println("IP address: ");
      Serial.println(WiFi.localIP());
      connectToMqtt();
      break;
    case ARDUINO_EVENT_WIFI_STA_DISCONNECTED:
      Serial.println("WiFi lost connection");
      publishError("Wi-Fi disconnected");
      xTimerStop(mqttReconnectTimer, 0); // Prevent MQTT reconnection while Wi-Fi is reconnecting
      xTimerStart(wifiReconnectTimer, 0);
      break;
  }
}

// MQTT Connection
void connectToMqtt() {
  Serial.println("Connecting to MQTT...");
  mqttClient.connect();
}

// Handle MQTT Connect Event
void onMqttConnect(bool sessionPresent) {
  Serial.println("Connected to MQTT.");
  Serial.printf("Session present: %d\n", sessionPresent);

  // Publish connection status to the "Status" topic
  publishStatus("Connected");
}

// Handle MQTT Disconnect Event
void onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
  Serial.println("Disconnected from MQTT.");
  publishStatus("Disconnected");

  if (WiFi.isConnected()) {
    xTimerStart(mqttReconnectTimer, 0);
  }
}

// Publish status messages (connected/disconnected)
void publishStatus(const char* statusMessage) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }
  
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%d.%m.%Y %H:%M:%S", &timeinfo);
  
  String macAddress = WiFi.macAddress();
  String statusMsg = "Device: " + macAddress + " | Status: " + statusMessage + " | Time: " + String(timeStringBuff);

  // Convert String to C-style string
  mqttClient.publish(MQTT_PUB_STATUS, 1, true, statusMsg.c_str());
  Serial.println("Status Published: " + statusMsg);
}

// Publish error messages (Wi-Fi/MQTT errors)
void publishError(const char* errorMessage) {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }
  
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%d.%m.%Y %H:%M:%S", &timeinfo);
  
  String macAddress = WiFi.macAddress();
  String errorMsg = "Device: " + macAddress + " | Error: " + errorMessage + " | Time: " + String(timeStringBuff);

  // Convert String to C-style string
  mqttClient.publish(MQTT_PUB_ERRORS, 1, true, errorMsg.c_str());
  Serial.println("Error Published: " + errorMsg);
}

// Handle MQTT Publish Acknowledgement
void onMqttPublish(uint16_t packetId) {
  Serial.printf("Publish acknowledged. Packet ID: %d\n", packetId);
}

// Print Local Time
void printLocalTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }
  Serial.printf("%A, %B %d %Y %H:%M:%S\n", timeinfo.tm_wday, timeinfo.tm_mon, timeinfo.tm_mday, timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
}

// Setup Function
void setup() {
  Serial.begin(115200);
  sensors.begin();  // Initialize temperature sensors

  // Create Timers
  mqttReconnectTimer = xTimerCreate("mqttTimer", pdMS_TO_TICKS(20000), pdFALSE, (void*)0, reinterpret_cast<TimerCallbackFunction_t>(connectToMqtt));
  wifiReconnectTimer = xTimerCreate("wifiTimer", pdMS_TO_TICKS(20000), pdFALSE, (void*)0, reinterpret_cast<TimerCallbackFunction_t>(connectToWifi));

  // Wi-Fi and MQTT event handlers
  WiFi.onEvent(WiFiEvent);
  mqttClient.onConnect(onMqttConnect);
  mqttClient.onDisconnect(onMqttDisconnect);
  mqttClient.onPublish(onMqttPublish);

  // Set MQTT Broker credentials
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  mqttClient.setCredentials(MQTT_USERNAME, MQTT_PASSWORD);

  // Connect to Wi-Fi and NTP time server
  connectToWifi();
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  printLocalTime();
}

// Loop Function
void loop() {
  // Request temperature reading from sensors
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);  // Temperature in Celsius

  // Get current time
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }

  // Format time
  char timeStringBuff[50];
  strftime(timeStringBuff, sizeof(timeStringBuff), "%d.%m.%Y %H:%M:%S", &timeinfo);

  // Get MAC address
  String macAddress = WiFi.macAddress();

  // Publish every 'interval' milliseconds
  unsigned long currentMillis = millis();
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Combine temperature and timestamp into a message
    String message = "Device: " + macAddress + " T: " + String(temperature) + "°C, on: " + String(timeStringBuff);
    
    // Publish MQTT message
    uint16_t packetIdPub1 = mqttClient.publish(MQTT_PUB_TEST, 1, true, message.c_str());
    
    Serial.printf("Publishing on topic %s at QoS 1, packetId: %d\n", MQTT_PUB_TEST, packetIdPub1);
    Serial.println("Message: " + message);
  }
}
