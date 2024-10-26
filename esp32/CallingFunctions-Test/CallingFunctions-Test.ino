void innerFunction() {
  Serial.println("This is the inner function.");
}

void outerFunction() {
  Serial.println("This is the outer function.");
  innerFunction();  // Call the inner function
}

void setup() {
  Serial.begin(115200);
  outerFunction();  // Call the outer function
}

void loop() {
  Serial.println("Within the loop");
  innerFunction();
  outerFunction();
  delay(10000);
}
