#include <Arduino.h>
#include <ArduinoJson.h>
#include <M5Unified.h>
#include <math.h>

// Transport feeds complete JSON lines into acceptMessage(). A future Wi-Fi
// adapter can call the same function without changing the UI or protocol.
struct DisplayState {
  String status = "waiting";
  String label;
  float confidence = -1;
};
DisplayState current;
uint32_t lastMessage = 0;
bool received = false;
bool stale = false;
bool dirty = true;
constexpr uint32_t TIMEOUT_MS = 5000;
constexpr size_t MAX_LINE = 512;
char lineBuffer[MAX_LINE + 1];
size_t lineLength = 0;
bool overflow = false;

bool knownStatus(const String& s) {
  return s == "ready" || s == "recognizing" || s == "result" ||
         s == "too_close" || s == "too_far" || s == "blurry" ||
         s == "non_target" || s == "too_dark" || s == "glare" || s == "error";
}

bool knownLabel(const String& s) {
  return s == "healthy" || s == "common_rust" || s == "gray_leaf_spot" ||
         s == "northern_leaf_blight";
}

bool acceptMessage(const char* payload) {
  JsonDocument doc;
  if (deserializeJson(doc, payload) || !doc.is<JsonObject>() ||
      !doc["v"].is<int>() || doc["v"].as<int>() != 1 ||
      !doc["status"].is<const char*>()) return false;
  DisplayState next;
  next.status = doc["status"].as<const char*>();
  if (!knownStatus(next.status)) return false;
  if (next.status == "result") {
    if (!doc["label"].is<const char*>()) return false;
    next.label = doc["label"].as<const char*>();
    if (!knownLabel(next.label)) return false;
    if (!doc["confidence"].isNull()) {
      if (!doc["confidence"].is<float>()) return false;
      next.confidence = doc["confidence"].as<float>();
      if (!isfinite(next.confidence) || next.confidence < 0 || next.confidence > 1)
        return false;
    }
  }
  dirty |= stale || !received || current.status != next.status ||
           current.label != next.label ||
           int(current.confidence * 100) != int(next.confidence * 100);
  current = next;
  lastMessage = millis();
  received = true;
  stale = false;
  return true;
}

void pollUsb() {
  // Bound work per loop so malformed or continuous input cannot starve the UI.
  for (size_t n = 0; n < 1024 && Serial.available(); ++n) {
    char c = Serial.read();
    if (c == '\n') {
      if (!overflow && lineLength) {
        lineBuffer[lineLength] = '\0';
        acceptMessage(lineBuffer);
      }
      lineLength = 0;
      overflow = false;
    } else if (c != '\r' && !overflow) {
      if (c == '\0' || lineLength == MAX_LINE) overflow = true;
      else lineBuffer[lineLength++] = c;
    }
  }
}

void render() {
  auto& lcd = M5.Display;
  uint16_t color = TFT_CYAN;
  const char* title = "WAITING";
  const char* body = "Connect USB\nto UNO Q";
  if (stale) { title = "NO DATA"; body = "Check USB\nand sender"; color = TFT_ORANGE; }
  else if (received) {
    const String& s = current.status;
    if (s == "result") {
      title = current.label == "healthy" ? "HEALTHY" : "SUSPECTED";
      color = current.label == "healthy" ? TFT_GREEN : TFT_ORANGE;
      if (current.label == "healthy") body = "Corn leaf";
      if (current.label == "common_rust") body = "Common\nrust";
      if (current.label == "gray_leaf_spot") body = "Gray leaf\nspot";
      if (current.label == "northern_leaf_blight") body = "Northern\nleaf blight";
    } else if (s == "ready") { title = "READY"; body = "Aim at one\ncorn leaf"; }
    else if (s == "recognizing") { title = "SCANNING"; body = "Hold still"; }
    else if (s == "too_close") { title = "TOO CLOSE"; body = "Move back"; }
    else if (s == "too_far") { title = "TOO FAR"; body = "Move closer"; }
    else if (s == "blurry") { title = "BLURRY"; body = "Hold still\nWait for focus"; }
    else if (s == "non_target") { title = "NO TARGET"; body = "Aim at one\ncorn leaf"; }
    else if (s == "too_dark") { title = "TOO DARK"; body = "Add light"; }
    else if (s == "glare") { title = "GLARE"; body = "Change angle"; }
    else { title = "ERROR"; body = "Check UNO Q"; color = TFT_RED; }
  }
  lcd.fillScreen(TFT_BLACK);
  lcd.setTextColor(color, TFT_BLACK);
  lcd.setTextSize(1);
  lcd.setCursor(5, 5);
  lcd.print("FieldSense / USB");
  lcd.fillRect(4, 21, 120, 2, color);
  lcd.setCursor(5, 32);
  lcd.setTextSize(2);
  lcd.println(title);
  lcd.setTextSize(1);
  lcd.setCursor(5, 64);
  lcd.println(body);
  lcd.setCursor(5, 110);
  if (received && !stale && current.status == "result" && current.confidence >= 0)
    lcd.printf("Model score: %.0f%%", current.confidence * 100);
  else lcd.print(stale ? "Update timed out" : "Live status");
  dirty = false;
}

void setup() {
  auto cfg = M5.config();
  M5.begin(cfg);
  M5.Display.setRotation(0);
  M5.Display.setTextFont(1);
  M5.Display.setBrightness(100);
  Serial.begin(115200);
  // Do not wait for Serial: display must start with power alone.
  render();
}

void loop() {
  M5.update();
  pollUsb();
  if (received && !stale && uint32_t(millis() - lastMessage) >= TIMEOUT_MS) {
    stale = true;
    dirty = true;
  }
  if (dirty) render();
  delay(5);
}
