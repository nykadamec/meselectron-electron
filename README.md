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

### 💻 Desktop application for automated video management and upload to prehraj.to

### 🚧 !! IN DEVELOPMENT !!

<br>

[**Features**](#-features) •
[**Architecture**](#-architecture) •
[**Tech Stack**](#-tech-stack) •
[**Setup**](#-setup) •
[**Building**](#-building)

<br>

</div>

---

## 📸 Screenshots

<div align="center">

![Video Discovery](./.images/prehrajto001.png)
*Video Discovery - Browse and select videos to download*

---

![Queue Management](./.images/prehrajto002.png)
*Queue Management - Drag & drop reordering with real-time progress*

---

![Download Progress](./.images/prehrajto003.png)
*Download Progress - Live speed, ETA, and phase tracking*

---

![My Videos Dashboard](./.images/prehrajto004.png)
*My Videos - Manage your uploaded videos*

</div>

---

## 📖 Overview

Prehraj.to AutoPilot is a powerful desktop application designed to automate video management workflows for the Czech video platform prehraj.to. Built with Electron and React, it provides a modern, cross-platform interface for handling video discovery, downloading, watermarking, and uploading.

The application runs entirely locally on your machine, ensuring your credentials and data remain secure. All video processing happens in background workers, keeping the UI responsive even during heavy operations.

---

## ✨ Features

### 📤 Multi-Account Management
- Support for multiple prehraj.to accounts
- Secure credential storage with auto-login capability
- Session management with automatic token refresh
- Automatic session validation before operations

### 📋 Queue Management System
- **Drag & Drop Reordering** - Easily change download/upload priority by dragging items
- **Real-time Progress Tracking** - Live updates on speed, ETA, and completion percentage
- **Download Cancellation** - Terminate active downloads instantly with the cancel button
- **Retry Failed Items** - One-click retry for failed downloads or uploads
- **Pause/Resume** - Temporarily pause the queue and resume later

### 💾 Data Persistence
- Processed videos are remembered across application restarts
- Persistent queue state preserves download history
- Settings are automatically saved and restored
- Data stored locally in system app data directory

### 🔍 Video Discovery
- Automatic video discovery from prehraj.to
- Filter by video length and file size
- Preview video details before adding to queue
- Multi-select support for batch operations

### 🎬 Video Processing
- **Parallel Chunk Downloads** - Download large videos in 2MB chunks for reliability
- **Multiple Download Modes** - Choose between ffmpeg-chunks, curl, or wget
- **Watermarking** - Optional watermark overlay with ffmpeg
- **HQ/LQ Processing** - Toggle between high-quality original and direct downloads

### 📊 Progress & Statistics
- Real-time download/upload speed monitoring
- ETA calculation based on current speed
- Session statistics (total uploaded, downloaded, earnings)
- Account credit tracking

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Electron Main Process                        │
│  • IPC communication bridge between processes                        │
│  • File system operations (settings, persistence)                    │
│  • Worker thread management (download, upload, discovery)            │
│  • Account credentials encryption                                    │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   Download  │ │    Upload   │ │  Discovery  │
            │   Worker    │ │   Worker    │ │   Worker    │
            │  (Thread)   │ │  (Thread)   │ │  (Thread)   │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │          React Renderer UI           │
                    │  • Components (React 19)             │
                    │  • State Management (Zustand)        │
                    │  • Drag & Drop (dnd-kit)             │
                    │  • Styling (TailwindCSS 4)           │
                    └─────────────────────────────────────┘
```

### Key Design Principles

- **Process Isolation**: Heavy operations run in Web Workers to keep the UI responsive
- **IPC Communication**: Secure bridge between renderer and main processes via preload scripts
- **State Management**: Zustand store with persistence for UI state
- **Type Safety**: Full TypeScript coverage across all layers

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Runtime** | Electron 39.2.7 | Cross-platform desktop framework |
| **Language** | TypeScript 5.9.3 | Type-safe JavaScript superset |
| **UI Framework** | React 19.2.3 | Component-based UI library |
| **Styling** | TailwindCSS 4 | Utility-first CSS framework |
| **State Management** | Zustand | Lightweight state container |
| **Drag & Drop** | @dnd-kit | Modern drag-and-drop toolkit |
| **HTTP Client** | Axios | Promise-based HTTP requests |
| **Video Processing** | FFmpeg | Video encoding/decoding/watermarking |
| **Background Workers** | Node.js Worker Threads | Parallel processing |
| **Browser Automation** | Playwright | Session management & login |

---

## 📁 Project Structure

```
preHrajto-AutoPilot/
├── src/
│   ├── main/                          # Electron main process
│   │   ├── ipc-handlers.ts           # IPC handler implementations
│   │   └── index.ts                   # Main process entry point
│   │
│   ├── preload/                       # Preload scripts (secure bridge)
│   │   └── index.ts                   # Context bridge definitions
│   │
│   ├── renderer/                      # React UI application
│   │   ├── src/
│   │   │   ├── App.tsx               # Main application component
│   │   │   ├── store/
│   │   │   │   └── index.ts          # Zustand store & persistence
│   │   │   ├── types/
│   │   │   │   ├── index.ts          # TypeScript type definitions
│   │   │   │   └── electron.d.ts     # Electron API type declarations
│   │   │   └── components/           # React components
│   │   │       ├── Header.tsx
│   │   │       ├── QueueList.tsx     # Download queue with drag & drop
│   │   │       ├── VideoCard.tsx
│   │   │       ├── SettingsPanel.tsx
│   │   │       ├── AccountCard.tsx
│   │   │       ├── StatsPanel.tsx
│   │   │       ├── LogViewer.tsx
│   │   │       └── MyVideosCard.tsx
│   │   └── index.html
│   │
│   └── workers/                       # Background processing workers
│       ├── download.worker.ts         # Video download with progress
│       ├── upload.worker.ts           # CDN upload with retries
│       ├── discover.worker.ts         # Video discovery automation
│       ├── session.worker.ts          # Session & login management
│       └── myvideos.worker.ts         # User's videos listing
│
├── resources/                         # Build resources
│   ├── icon.icns                      # macOS app icon
│   ├── icon.ico                       # Windows app icon
│   └── entitlements.mac.plist         # macOS entitlements
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── electron.vite.config.ts
```

---

## 🚀 Setup

### Prerequisites

- **Node.js** 18+ with npm
- **FFmpeg** (for video watermarking)
- **Git** for version control

### Installation

```bash
# Clone the repository
git clone https://github.com/nykadamec/preHrajto-AutoPilot.git
cd preHrajto-AutoPilot

# Install dependencies
npm install

# Start development server
npm run dev
```

### Environment Setup

The application requires the following external tools:

| Tool | Required For | Installation |
|------|--------------|--------------|
| **FFmpeg** | Video watermarking | `brew install ffmpeg` (macOS) / `choco install ffmpeg` (Windows) |
| **curl** | Alternative download mode | Pre-installed on macOS/Linux |
| **wget** | Alternative download mode | `brew install wget` (macOS) / `choco install wget` (Windows) |

### Account Setup

1. Create a `DATA` folder in the project root
2. Add cookie files named `login_email@domain.com.dat`
3. For auto-login, add credentials files named `credentials_email@domain.com.dat`:

```
email=your-email@example.com
password=your-password
```

---

## 📦 Building

### Development Build

```bash
# Start development server with hot reload
npm run dev
```

### Production Builds

```bash
# Build for current platform
npm run build

# macOS (Apple Silicon)
npm run build:mac

# Windows (x64)
npm run build:win

# Linux
npm run build:linux

# All platforms
npm run build:all
```

### Build Output

Build artifacts are located in the `release` directory:

```
release/
├── mac-arm64/        # macOS Apple Silicon
├── mac-x64/          # macOS Intel
├── win-x64/          # Windows
└── linux-x64/        # Linux
```

---

## ⚙️ Configuration

### Settings

The application stores settings in the system app data directory:

| Platform | Path |
|----------|------|
| **macOS** | `~/Library/Application Support/prehrajto-autopilot/settings.json` |
| **Windows** | `%APPDATA%\prehrajto-autopilot\settings.json` |
| **Linux** | `~/.config/prehrajto-autopilot/settings.json` |

### Settings Structure

```json
{
  "autoReset": true,
  "downloadConcurrency": 2,
  "uploadConcurrency": 2,
  "videoCount": 20,
  "nospeed": false,
  "addWatermark": true,
  "outputDir": "~/Videos/meselectron",
  "downloadMode": "ffmpeg-chunks",
  "hqProcessing": true
}
```

### Download Modes

| Mode | Description | Best For |
|------|-------------|----------|
| `ffmpeg-chunks` | Parallel 2MB chunk downloads | Most reliable, resumes partial downloads |
| `curl` | curl CLI with progress bar | Simple downloads, curl installed |
| `wget` | wget CLI with progress bar | Large files, limited connectivity |

### HQ Processing

- **HQ Processing (ON)**: Uses `?do=download` URLs for original quality
- **LQ Processing (OFF)**: Uses direct video URLs, may have watermarks

---

## 🔧 Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build for current platform |
| `npm run lint` | Run ESLint |
| `npm run lint:fix` | Fix ESLint errors automatically |
| `npm run typecheck` | Run TypeScript type checking |

### Adding New Features

1. **IPC Handlers** - Add handlers in `src/main/ipc-handlers.ts`
2. **Bridge Functions** - Expose in `src/preload/index.ts`
3. **Type Declarations** - Update `src/renderer/src/types/electron.d.ts`
4. **Store Actions** - Add in `src/renderer/src/store/index.ts`
5. **UI Components** - Create in `src/renderer/src/components/`

### Debugging

```bash
# Enable debug logging in renderer
DEBUG=* npm run dev

# View main process logs (stderr)
tail -f /path/to/release/*.app/Contents/MacOS/*

# Enable Chrome DevTools in production
npm run dev -- --inspect
```

---

## 📄 License

This project is licensed under the **ISC License**.

See the [LICENSE](LICENSE) file for full details.

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📞 Support

- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Use GitHub Discussions for questions and ideas

---

<div align="center">

**Built with ❤️ for the prehraj.to community**

</div>
