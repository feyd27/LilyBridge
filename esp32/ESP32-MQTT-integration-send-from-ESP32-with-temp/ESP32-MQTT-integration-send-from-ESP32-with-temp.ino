/*
  Rui Santos & Sara Santos - Random Nerd Tutorials
  Complete project details at https://RandomNerdTutorials.com/cloud-mqtt-mosquitto-broker-access-anywhere-digital-ocean/
  Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files.
  The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/
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

// GPIO where the DS18B20 is connected to
const int oneWireBus = 13;

// Setup a oneWire instance to communicate with any OneWire devices
OneWire oneWire(oneWireBus);

// Pass our oneWire reference to Dallas Temperature sensor
DallasTemperature sensors(&oneWire);

// Wi-Fi information

#define WIFI_SSID "HUAWEI-B315-D4C8"
#define WIFI_PASSWORD "T9DFD1H4RDJ"

// Time server config

const char* ntpServer = "pool.ntp.org";
const long  gmtOffset_sec = 3600;
const int   daylightOffset_sec = 0;

// Digital Ocean MQTT Mosquitto Broker
// #define MQTT_HOST IPAddress(165, 22, 65, 210)
// For a cloud MQTT broker, type the domain name
#define MQTT_HOST "lily-bridge.online"
#define MQTT_PORT 1883
#define MQTT_USERNAME "lily"
#define MQTT_PASSWORD "Radar#Cicler"

// Temperature MQTT Topic
#define MQTT_PUB_TEMP "temperature"
// Status MQTT Topic
#define MQTT_PUB_STATUS "status"
// Errors MQTT Topic
#define MQTT_PUB_ERROR "errors"

AsyncMqttClient mqttClient;
TimerHandle_t mqttReconnectTimer;
TimerHandle_t wifiReconnectTimer;

unsigned long previousMillis = 0;   // Stores last time temperature was published
const long interval = 600000;         // Interval at which to publish sensor readings

unsigned long previousStatusCheckMillis = 0;
const long statusCheckInterval = 60000;  // Check status every 60 seconds

int i = 0;

void connectToWifi() {
  Serial.println("Connecting to Wi-Fi...");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

void connectToMqtt() {
  Serial.println("Connecting to MQTT...");
  mqttClient.connect();
}

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
      xTimerStop(mqttReconnectTimer, 0); // ensure we don't reconnect to MQTT while reconnecting to Wi-Fi
      xTimerStart(wifiReconnectTimer, 0);
      break;
  }
}

void onMqttConnect(bool sessionPresent) {
  Serial.println("Connected to MQTT.");
  Serial.print("Session present: ");
  Serial.println(sessionPresent);
  // Get the current time
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    String timeErrorString = String(ESP.getChipModel()) + String(ESP.getChipRevision()) + " Failed to obtain time";
    // Publish an MQTT message in errors topic
    uint16_t packetIdPub1 = mqttClient.publish(MQTT_PUB_ERROR, 1, true, timeErrorString.c_str());
    Serial.printf("Publishing on topic %s at QoS 1, packetId: %i\n", MQTT_PUB_ERROR, packetIdPub1);
    Serial.println("Message: " + timeErrorString);
    return;
  }
  String macAddress = WiFi.macAddress();
  // Get the current time in a formatted string
  char timeStringBuff[50];  // Buffer to store the formatted time string
  strftime(timeStringBuff, sizeof(timeStringBuff), "%d.%m.%Y %H:%M:%S", &timeinfo);
  // Combine MQTT session and message
  //Serial.println(&timeinfo, "%A, %B %d %Y %H:%M:%S");  // Print the formatted time
  strftime(timeStringBuff, sizeof(timeStringBuff), "%d.%m.%Y %H:%M:%S", &timeinfo);
  String mqttStatusString = String(ESP.getChipModel()) + String(ESP.getChipRevision()) + "@" + macAddress + "| CONNECTED to broker | Time: " + String(timeStringBuff);

  // Publish an MQTT message
  uint16_t packetIdPub1 = mqttClient.publish(MQTT_PUB_STATUS, 1, true, mqttStatusString.c_str());

  Serial.printf("Publishing on topic %s at QoS 1, packetId: %i\n", MQTT_PUB_STATUS, packetIdPub1);
  Serial.println("Message: " + mqttStatusString);
}

void onMqttDisconnect(AsyncMqttClientDisconnectReason reason) {
  Serial.println("Disconnected from MQTT.");
  if (WiFi.isConnected()) {
    xTimerStart(mqttReconnectTimer, 0);
  }
}


void onMqttPublish(uint16_t packetId) {
  Serial.print("Publish acknowledged.");
  Serial.print("  packetId: ");
  Serial.println(packetId);
}

void setup() {
  Serial.begin(115200);
  Serial.println();
  sensors.begin();

  mqttReconnectTimer = xTimerCreate("mqttTimer", pdMS_TO_TICKS(20000), pdFALSE, (void*)0, reinterpret_cast<TimerCallbackFunction_t>(connectToMqtt));
  wifiReconnectTimer = xTimerCreate("wifiTimer", pdMS_TO_TICKS(20000), pdFALSE, (void*)0, reinterpret_cast<TimerCallbackFunction_t>(connectToWifi));

  WiFi.onEvent(WiFiEvent);

  mqttClient.onConnect(onMqttConnect);
  mqttClient.onDisconnect(onMqttDisconnect);
  /*mqttClient.onSubscribe(onMqttSubscribe);
    mqttClient.onUnsubscribe(onMqttUnsubscribe);*/
  mqttClient.onPublish(onMqttPublish);
  mqttClient.setServer(MQTT_HOST, MQTT_PORT);
  // If your broker requires authentication (username and password), set them below
  mqttClient.setCredentials(MQTT_USERNAME, MQTT_PASSWORD);
  connectToWifi();
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  printLocalTime();
}



// Function to print local time
void printLocalTime() {
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    return;
  }
  // Serial.println(&timeinfo, "%A, %B %d %Y %H:%M:%S");  // Print the formatted time
}

void loop() {
  // Request temperature reading from sensors
  sensors.requestTemperatures();

  // Temperature in Celsius degrees
  float temperature = sensors.getTempCByIndex(0);
  //  Serial.print(temperature);
  //  Serial.println("°C");

  // Get the current time
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    Serial.println("Failed to obtain time");
    String timeErrorString = String(ESP.getChipModel()) + String(ESP.getChipRevision()) + " Failed to obtain time";
    // Publish an MQTT message in errors topic
    uint16_t packetIdPub1 = mqttClient.publish(MQTT_PUB_ERROR, 1, true, timeErrorString.c_str());
    Serial.printf("Publishing on topic %s at QoS 1, packetId: %i\n", MQTT_PUB_ERROR, packetIdPub1);
    Serial.println("Message: " + timeErrorString);
    return;
  }
  String macAddress = WiFi.macAddress();
  // Get the current time in a formatted string
  char timeStringBuff[50];  // Buffer to store the formatted time string
  strftime(timeStringBuff, sizeof(timeStringBuff), "%d.%m.%Y %H:%M:%S", &timeinfo);

  unsigned long currentMillis = millis();
  unsigned long currentStatusMillis = millis();

  // Every X number of seconds (interval = 60 seconds)
  // it publishes a new MQTT message
  if (currentMillis - previousMillis >= interval) {
    previousMillis = currentMillis;

    // Combine temperature and timestamp into a message string
    String temperatureString = String(ESP.getChipModel()) + String(ESP.getChipRevision()) + "@" + macAddress + "| T: " + String(temperature) + "°C| Time: " + String(timeStringBuff);

    // Publish an MQTT message
    uint16_t packetIdPub1 = mqttClient.publish(MQTT_PUB_TEMP, 1, true, temperatureString.c_str());

    Serial.printf("Publishing on topic %s at QoS 1, packetId: %i\n", MQTT_PUB_TEMP, packetIdPub1);
    Serial.println("Message: " + temperatureString);
  }

  if (currentStatusMillis - previousStatusCheckMillis >= statusCheckInterval) {
    previousStatusCheckMillis = currentStatusMillis;
     String statusCheckString = String(ESP.getChipModel()) + String(ESP.getChipRevision()) + "@" + macAddress + "| Wifi OK | MQTT OK | Time: " + String(timeStringBuff);
    if ((WiFi.status() == WL_CONNECTED) && (mqttClient.connected()))
     uint16_t packetIdPub1 = mqttClient.publish(MQTT_PUB_STATUS, 1, true, statusCheckString.c_str());
    Serial.println("Message: " + statusCheckString);
  }


}
