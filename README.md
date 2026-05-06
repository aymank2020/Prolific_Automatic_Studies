# 🚀 Ayman Prolific Studies Notifier (v2.2.0)

<p align="center">
  <img src="imgs/logo.png" alt="Ayman Prolific Notifier" height="100">
</p>

<p align="center">
  <strong>The ultimate Prolific assistant: Smart Auto-Reserve, AI Solving, and WhatsApp Monitoring</strong><br>
  <em>Premium Design • Randomized Jitter • Limited Capacity Retry • Human Behavior Simulation</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.2.0-gold" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-green" alt="Manifest V3">
  <img src="https://img.shields.io/badge/AI-Solver-blueviolet" alt="AI Solver">
  <img src="https://img.shields.io/badge/Anti--Ban-Protected-green" alt="Anti-Ban">
</p>

---

## ✨ New in v2.2.0: "Smart Resilience"

### 🛡️ Human Behavior Simulation (Anti-Ban)
- **Randomized Jitter:** No more fixed polling. Background checks occur every 2-4 minutes randomly, and foreground checks every 2-4 seconds with jitter.
- **Rate Limit Protection:** Automatically detects `429 - Too Many Requests` errors and pauses all automation for 30 minutes to protect your account from suspension.

### 🔄 Limited Capacity "Chasing" Mode
- **Smart Detection:** Automatically detects studies that are temporarily full ("Limited Capacity").
- **🔄 Auto-Chasing:** Instead of closing the tab, the extension enters a spinning "Chasing Mode", performing randomized refreshes (3-7s) until a spot opens up.

### 🤖 AI Auto-Solver (Optional)
- **Intelligent Answering:** Uses GPT-4o to analyze survey questions in real-time.
- **Attention Trap Detection:** Specifically designed to catch and correctly answer "attention checks" to protect your Prolific standing.
- **Shadow Mode:** View AI suggestions without auto-clicking.

### ⚡ Ultra-Robust Connection
- **Zero "Error Connecting":** Implements a 10-retry "Smart Wake-up" sequence for the Service Worker, ensuring the extension works instantly every time you open it.

---

## 🚀 Core Features

### 📱 WhatsApp Web Integration
- **Real-time Monitoring:** Scans WhatsApp Web groups for Prolific study links.
- **Instant Auto-Open:** Opens links in a focused tab the moment they are posted.
- **Visual Feedback:** Shows a 📱 indicator and slide-down banners inside WhatsApp.

### ⚡ Advanced Reserve Engine
- **6-Layer Detection:** Combines Fetch/XHR interception, MutationObservers, and Navigation monitoring.
- **Multi-Method Clicking:** Uses direct DOM clicks + Mouse/Pointer events for maximum compatibility with Prolific's React frontend.

### 📊 Professional History & Dashboard
- **Detailed Tracking:** View a log of all detected and reserved studies.
- **One-Click Access:** Direct links to Prolific studies from your history.
- **Status Badges:** Clearly see which studies were `RESERVED` vs `DETECTED`.

---

## 🏗️ Architecture

| Layer | Latency | Description |
|---|---|---|
| **API Interception** | ~0ms | Catches studies before they even render on the page. |
| **MutationObserver** | ~10ms | Instant DOM change detection for new study cards. |
| **Human Polling** | 2s + Jitter | Periodic safety check with randomized timing. |
| **WA Monitor** | 500ms | DOM scanning for WhatsApp Web link detection. |
| **Background Alarm** | 2-4min | Randomized background wake-up for persistent monitoring. |

---

## 📦 Installation

1. **Clone & Build:**
   ```bash
   git clone https://github.com/aymank2020/Prolific_Automatic_Studies.git
   cd ProlificAutomaticStudies
   npm install && npx tsc
   ```
2. **Load in Chrome:**
   - Go to `chrome://extensions/` -> Enable **Developer mode**.
   - Click **Load unpacked** -> Select the project folder.
3. **Configure:**
   - Open Prolific (🚀 indicator appears).
   - Open WhatsApp Web (📱 indicator appears).
   - Use the popup to set your **AI API Key** and preferences.

---

## 📋 Changelog

### v2.2.0 (Current)
- ✅ **Randomized Jitter** — Bypasses bot detection by mimicking human timing.
- ✅ **Limited Capacity Mode** — Smart retries for temporarily full studies.
- ✅ **Anti-Ban Protection** — 429 error detection and emergency cooling.
- ✅ **Spinning UI Indicator** — Real-time visual feedback for active "chasing".
- ✅ **10-Retry Wake-up** — Fixed the "Error Connecting" startup issue.

### v2.1.0
- ✅ **AI Solver Integration** — GPT-4o powered survey answering.
- ✅ **Enhanced History UI** — Professional table view with direct links.
- ✅ **Flat Design Icons** — New high-clarity icon set.

---

## 📄 License & Disclaimer
This project is for educational and personal use. Use at your own risk. Automating Prolific may violate their Terms of Service; use conservative settings to minimize risk.

## 🤝 Contributing
Contributions are welcome! Open an issue or submit a pull request on [GitHub](https://github.com/aymank2020/Prolific_Automatic_Studies).