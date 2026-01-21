# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prehrajto.cz AutoPilot is an Electron desktop application for video management (download/upload) from prehrajto.cz platform. Built with Electron 40, React 19, TypeScript, and Zustand for state management.

## Common Commands

```bash
npm run dev              # Start development server with hot reload
npm run build            # Build all (main + renderer + workers)
npm run build:main       # Build main process only
npm run build:workers    # Build worker threads only
npm run build:mac        # Build macOS (Apple Silicon) DMG
npm run build:win        # Build Windows x64 installer
npm run build:all        # Build for all platforms
npm run test             # Run Vitest tests
npm run sync             # Sync configuration from template
npm run release          # Create release artifacts
```

## Architecture

### Directory Structure

```
src/
├── main/                    # Electron main process (Node.js)
│   ├── index.ts            # App entry, window creation, lifecycle
│   ├── constants.ts        # Magic numbers and config values
│   ├── handlers/           # IPC handlers (one per domain)
│   │   ├── index.ts        # Imports all handlers
│   │   ├── download-handler.ts
│   │   ├── upload-handler.ts
│   │   ├── discover-handler.ts
│   │   ├── session-handler.ts
│   │   ├── accounts-handler.ts
│   │   ├── settings-handler.ts
│   │   └── ...
│   └── utils/              # Main process utilities
├── preload/                # Context bridge for renderer
│   └── index.ts            # Exposes electronAPI to window
├── renderer/               # React UI (browser process)
│   ├── src/
│   │   ├── store/          # Zustand state (single source of truth)
│   │   │   └── index.ts    # useAppStore - all app state
│   │   ├── components/     # React components
│   │   ├── types/          # TypeScript interfaces
│   │   └── utils/          # UI utilities
│   └── index.html
└── workers/                # Worker threads (Node.js)
    ├── download.worker.ts  # Video download with chunked streaming
    ├── upload.worker.ts
    ├── discover.worker.ts  # Video discovery/scraping
    ├── session.worker.ts
    └── myvideos.worker.ts
```

### IPC Communication Flow

1. **Renderer → Preload**: Call `window.electronAPI.methodName(args)`
2. **Preload → Main**: `ipcRenderer.invoke('channel', args)`
3. **Main → Handler**: `ipcMain.handle('channel', handlerFn)`
4. **Progress Back**: `BrowserWindow.webContents.send('channel', data)`

### Key Data Types (`src/renderer/src/types/index.ts`)

- `Video`: Downloaded/uploaded video with status, progress, speed, eta
- `QueueItem`: Video + account + status for queue management
- `VideoCandidate`: Discovery result before adding to queue
- `Account`: Prehrajto.cz account with cookie file path
- `Settings`: Download mode, concurrency, watermark, output dir

### Video Status Flow

```
pending → downloading → processing → uploading → completed
                    ↓              ↓
                  failed        failed
```

### Download Modes

- `ffmpeg-chunks`: Parallel 1MB chunk downloads with reassembly
- `curl`: Native curl with progress parsing
- `wget`: Native wget with progress parsing

## State Management

The `useAppStore` (Zustand) is the **single source of truth** for UI state. It handles:
- Accounts, videos, queue, logs
- Settings (persisted to disk via IPC)
- Video discovery candidates
- My videos list with pagination

Persistenced state:
- `settings.json`: User settings
- `processed-videos.json`: Track downloaded URLs to avoid duplicates

## Adding New IPC Channels

1. **Main process**: Create handler in `src/main/handlers/`
   ```typescript
   ipcMain.handle('domain:action', async (_, args) => { /* ... */ })
   ```
2. **Preload**: Expose in `src/preload/index.ts`
   ```typescript
   domainAction: function(args) { return ipcRenderer.invoke('domain:action', args) }
   ```
3. **Renderer**: Call via `window.electronAPI.domainAction(args)`

## Worker Thread Pattern

Workers handle blocking operations. Communication via `parentPort.postMessage()`:
- Workers send progress: `{ type: 'progress', ... }`
- Workers send completion: `{ type: 'complete', success: true/false }`
- Main process forwards progress to renderer via `webContents.send()`

## Code Conventions

- TypeScript strict mode enabled
- ES modules (`"type": "module"`)
- Czech UI strings for user-facing messages
- Named exports for handlers
- Console logging with videoId prefix for worker operations
