# 🌟 VEDA (Voice Efficient Digital Assistant)

<p align="center">
  <b>A Multi-Agent Voice AI and Cross-Platform Remote Control System</b>
</p>

<p align="center">
  <a href="https://github.com/HaniDwivedi/VEDA/releases/tag/v1.0.7"><img src="https://img.shields.io/badge/Release-v1.0.7-blue.svg" alt="Release"></a>
  <a href="https://github.com/HaniDwivedi/VEDA/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"></a>
  <a href="https://github.com/HaniDwivedi/VEDA"><img src="https://img.shields.io/badge/Platform-Windows%20%7C%20Android%20%7C%20Linux-orange.svg" alt="Platforms"></a>
</p>

---

## 🚀 Overview

**VEDA** is an advanced, hybrid voice-controlled ecosystem built for seamless desktop and mobile remote management. It combines offline/online speech recognition, multi-agent AI execution, secure device pairing, and system automation into a single cohesive platform.

---

## 🛠️ Key Features

* **Hybrid AI Voice Control:** Powered by local speech recognition (like Vosk STT) for fast, privacy-focused interactions, coupled with intelligent backend agent processing.
* **Secure Device Pairing:** Real-time pairing bridge between mobile and desktop clients using WebSockets/WebRTC signaling and Redis session management.
* **System Automation:** Direct OS-level control via `PyAutoGUI` for executing local workflows and commands securely.
* **Cross-Platform Support:** 
  * **Desktop Agent:** Electron/Python-based desktop daemon with an intuitive floating widget interface.
  * **Android App:** Dedicated mobile controller companion built with Capacitor.

---

## 📂 Project Structure

```text
VEDA/
├── android/          # Android application source & Gradle configs
├── desktop/          # Desktop agent daemon & UI widgets (Python/Electron)
├── mobile/           # Cross-platform mobile client codebase
├── shared/           # Shared communication protocols and utilities
├── veda/             # Core multi-agent AI engine and modules
├── capacitor.config.json
└── package.json
