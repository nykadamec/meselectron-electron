# Prehraj.to AutoPilot

<div align="center">

<!-- Badges Row -->
[![Electron](https://img.shields.io/badge/Electron-39.2.7-47848F?style=for-the-badge&logo=electron)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=for-the-badge&logo=typescript)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org)
[![License](https://img.shields.io/badge/License-ISC-FDAD00?style=for-the-badge)](LICENSE)

<br><br>

<!-- ASCII Banner -->
```
     ____           _                _ _        
    |  _ \ _ __ ___| |__  _ __ __ _ (_) |_ ___  
    | |_) | '__/ _ \ '_ \| '__/ _` || | __/ _ \ 
    |  __/| | |  __/ | | | | | (_| || | || (_) |
    |_|   |_|  \___|_| |_|_|  \__,_|/ |\__\___/ 
                                  |__/          
```

<br>

### 💻 Desktop application for automated video upload

### 🚧 !! IN DEVELOPMENT !!

<br>

</div>

---

## ✨ Features

<div align="center">

| 🎯 Multi-account upload | ✅ |
|------------------------|----|
| 📊 Progress tracking | ✅ |
| 📋 Queue management | ✅ |
| ✋ Drag & drop | ✅ |
| 🔍 Video discovery | ✅ |
| 🔐 Session management | ✅ |
| 🌙 Dark/Light theme | 🔄 |
| 🔄 Auto-updater | 🔄 |

</div>

---

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Build application
npm run build

# Start development
npm run dev
```

---

## 🛠️ Tech Stack

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   ┌─────────────────┐     ┌─────────────────────────────┐  │
│   │   Electron 39   │────▶│  TypeScript 5.9            │  │
│   └─────────────────┘     └─────────────────────────────┘  │
│                                                             │
│   ┌─────────────────┐     ┌─────────────────────────────┐  │
│   │   React 19      │────▶│  TailwindCSS 4             │  │
│   └─────────────────┘     └─────────────────────────────┘  │
│                                                             │
│   ┌─────────────────┐     ┌─────────────────────────────┐  │
│   │  Web Workers    │────▶│  Background Processing     │  │
│   └─────────────────┘     └─────────────────────────────┘  │
│                                                             │
│   ┌─────────────────┐     ┌─────────────────────────────┐  │
│   │   Playwright    │────▶│  Browser Automation        │  │
│   └─────────────────┘     └─────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
📦 src
├── 📂 main/          → Electron main process & IPC
├── 📂 preload/       → Secure bridge (preload scripts)
├── 📂 renderer/      → React UI components
└── 📂 workers/       → Background workers
    ├── 📄 upload.worker.ts      → CDN upload
    ├── 📄 discover.worker.ts    → Video discovery
    └── 📄 session.worker.ts     → Session management
```

---

## 📦 Build

```bash
# macOS (Apple Silicon)
npm run build:mac

# Windows
npm run build:win

# All platforms
npm run build:all
```

---

## ⚙️ Funkce

### 📤 Nahrávání na více účtů
- Podpora více účtů prehraj.to
- Automatické přihlášení pomocí uložených credentials
- Správa sessions a automatické obnovení

### 📋 Správa fronty
- **Řazení přetažením** (drag & drop) - změna pořadí stahování
- **Zrušení stahování** - aktivní stahování lze kdykoliv zrušit
- **Pokračování** - aplikace si pamatuje zpracovaná videa i po restartu

### 💾 Persistence dat
- Zpracovaná videa se ukládají a zůstanou označena i po restartu aplikace
- Ukládá se do: `~/Library/Application Support/prehrajto-autopilot/processed.json`

### 🔍 Objevování videí
- Automatické hledání videí na prehraj.to
- Filtrování podle délky a velikosti
- Export do fronty stahování

---

### 🚀 Rychlý start

```bash
npm install
npm run build
npm run dev
```

---

### 📝 Licence
