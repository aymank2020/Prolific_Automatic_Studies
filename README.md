# 🚀 Prolific Auto-Reserve Extension

<p align="center">
  <img src="imgs/logo.png" alt="Prolific Auto-Reserve" height="80">
</p>

<p align="center">
  <strong>Lightning-fast study detection & auto-reservation for Prolific</strong><br>
  <em>Detect studies in ~15ms • Auto-click "Take part" • WhatsApp group monitoring</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-2.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/manifest-v3-green" alt="Manifest V3">
  <img src="https://img.shields.io/badge/TypeScript-5.3-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/Chrome-Extension-yellow" alt="Chrome Extension">
</p>

---

## ✨ Features

### ⚡ Auto-Reserve Engine
- **6-layer study detection** — catches new studies in milliseconds
- **Instant auto-click** on "Take part in this study" button
- **Multiple click methods** (direct, MouseEvent, PointerEvent) for React compatibility
- **Fast polling fallback** (50ms) when buttons aren't immediately available

### 📱 WhatsApp Web Integration
- **Monitors WhatsApp Web groups** for Prolific study links
- **Auto-opens study links** in a new focused tab the moment they appear
- **Visual notification banner** inside WhatsApp when a study is detected
- **Audio alert** when a new study link is found

### 🔔 Smart Notifications
- Desktop notifications with one-click access to Prolific
- Customizable audio alerts (3 built-in sounds)
- Badge counter for detected studies
- Auto-focus Prolific tab when studies appear

### 🛡️ Error Handling
- **404 auto-redirect** — if a study is expired, automatically returns to `/studies`
- **"Study is full" detection** — redirects to studies list when a study fills up
- **Connection recovery** — re-initializes detection when tab becomes visible

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Chrome Extension (MV3)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Background.js   │  │   Content.js     │  │  WhatsApp    │  │
│  │  (Service Worker) │  │ (Prolific Page)  │  │  Monitor.js  │  │
│  │                  │  │                  │  │              │  │
│  │ • Alarms (30s)   │◄─┤ • MutationObs    │  │ • Link scan  │  │
│  │ • Tab management │  │ • API intercept  │  │ • MutationObs│  │
│  │ • Notifications  │  │ • DOM polling    │  │ • Auto-open  │  │
│  │ • Audio playback │  │ • Nav monitor    │  │ • Notify BG  │  │
│  │ • Badge updates  │  │ • Auto-click     │  │              │  │
│  └──────┬───────────┘  └──────────────────┘  └──────┬───────┘  │
│         │                                           │          │
│         └───────────────────┬───────────────────────┘          │
│                             │                                   │
│                    ┌────────┴────────┐                          │
│                    │   Popup.html    │                          │
│                    │ • Toggle on/off │                          │
│                    │ • Status display│                          │
│                    │ • Force check   │                          │
│                    │ • Audio config  │                          │
│                    └─────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

### Detection Layers (by speed)

| # | Layer | Latency | Description |
|---|-------|---------|-------------|
| 1 | **Fetch Interception** | ~0ms | Intercepts API responses before DOM renders |
| 2 | **XHR Interception** | ~0ms | Catches XMLHttpRequest-based API calls |
| 3 | **MutationObserver** | ~10ms | Instant DOM change detection |
| 4 | **Navigation Monitor** | ~100ms | Detects SPA route changes |
| 5 | **Regular Polling** | ~500ms | Safety net for missed events |
| 6 | **Background Alarms** | ~30s | Catches studies when service worker sleeps |

---

## 📦 Installation

### From Source (Developer Mode)

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aymank2020/Prolific_Automatic_Studies.git
   cd ProlificAutomaticStudies
   ```

2. **Install dependencies & build:**
   ```bash
   npm install
   npx tsc
   ```

3. **Load in Chrome:**
   - Open `chrome://extensions/`
   - Enable **Developer mode** (toggle in top-right)
   - Click **"Load unpacked"**
   - Select the project folder

4. **Setup:**
   - Open [app.prolific.com/studies](https://app.prolific.com/studies) — you'll see a 🚀 indicator
   - Open [web.whatsapp.com](https://web.whatsapp.com) — you'll see a 📱 indicator
   - Click the extension icon to configure settings

---

## 🎮 Usage

### On Prolific (app.prolific.com)
- **🚀 Green indicator** = Auto-reserve is active
- **🔴 Red indicator** = Auto-reserve is disabled
- Click the indicator to toggle on/off
- Studies are auto-reserved the instant they appear

### On WhatsApp Web (web.whatsapp.com)
- **📱 Green indicator** = WhatsApp monitor is active
- When a Prolific study link appears in any chat, it auto-opens in a new tab
- A blue notification banner slides down when a study is detected
- Existing links at page load are marked as "seen" (not auto-opened)

### Popup Controls
- **⚡ Auto-Reserve Studies** — master toggle for auto-reservation
- **🔍 Force Check** — manually trigger an immediate study check
- **Status** — live connection status with the content script
- **Reserved** — count of studies auto-reserved this session

---

## 📁 Project Structure

```
ProlificAutomaticStudies/
├── manifest.json           # Extension manifest (MV3)
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript configuration
├── src/
│   ├── background.ts       # Service worker (alarms, notifications, tab mgmt)
│   ├── content.ts          # Prolific page auto-reserve engine
│   ├── whatsapp-monitor.ts # WhatsApp Web link monitor
│   └── popup.ts            # Popup interface logic
├── dist/                   # Compiled JavaScript (auto-generated)
│   ├── background.js
│   ├── content.js
│   ├── whatsapp-monitor.js
│   └── popup.js
├── popup/
│   └── popup.html          # Extension popup interface
├── styles/
│   └── popup.css           # Popup styling
├── audio/
│   ├── alert1.mp3          # Notification sounds
│   ├── alert2.mp3
│   ├── alert3.mp3
│   ├── audio.html          # Offscreen audio player
│   └── audio.js            # Audio playback handler
└── imgs/
    └── logo.png            # Extension icon
```

---

## 🔧 Development

### Build
```bash
npm install
npx tsc          # Compile TypeScript
npx tsc --watch  # Watch mode for development
```

### Key Technologies
- **TypeScript 5.3** — Type-safe development
- **Chrome Extension Manifest V3** — Modern extension architecture
- **MutationObserver API** — Real-time DOM monitoring
- **Fetch/XHR Interception** — API response monitoring
- **Chrome Alarms API** — Reliable periodic checks
- **Offscreen Document** — Background audio playback

---

## ⚙️ Configuration

All settings are persisted via `chrome.storage.sync`:

| Setting | Default | Description |
|---------|---------|-------------|
| `autoReserveEnabled` | `true` | Enable/disable auto-reservation |
| `audioActive` | `true` | Play sound on new study |
| `showNotification` | `true` | Show desktop notification |
| `openProlific` | `false` | Open Prolific on browser startup |
| `volume` | `100` | Audio volume (0-100) |
| `audio` | `alert1.mp3` | Selected alert sound |

---

## 📋 Changelog

### v2.0.0 (Current)
- ✅ **Content Script** — auto-reserve engine injected into Prolific pages
- ✅ **WhatsApp Monitor** — detects study links from WhatsApp Web groups
- ✅ **API Interception** — catches studies from fetch/XHR responses
- ✅ **MutationObserver** — instant DOM change detection (~10ms)
- ✅ **404 Handling** — auto-redirect on expired studies
- ✅ **"Study Full" Handling** — redirect when study fills up
- ✅ **Multi-click** — 3 click methods for React compatibility
- ✅ **Chrome Alarms** — reliable background checking
- ✅ **Visual indicators** — 🚀 on Prolific, 📱 on WhatsApp

### v1.0.6 (Original)
- Notification-only extension
- Tab title monitoring for study detection
- Audio alerts and desktop notifications

---

## 📄 License

This project is for educational and personal use.

## 🤝 Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.

## 📬 Contact

For questions or suggestions, open an issue on [GitHub](https://github.com/aymank2020/Prolific_Automatic_Studies).