# Prehraj.to AutoPilot

![Electron](https://img.shields.io/badge/Electron-39.2.7-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-blue)
![React](https://img.shields.io/badge/React-19.2.3-blue)
![License](https://img.shields.io/badge/License-ISC-green)

Desktop application for automated video upload to prehrajto.cz

## Features

- **Multi-account support** - Upload to multiple prehrajto.cz accounts
- **Progress tracking** - Real-time upload progress with speed and ETA
- **Queue management** - Drag & drop reordering, pause/resume
- **Video discovery** - Find and download videos from prehrajto.cz

## Tech Stack

- **Electron** - Desktop application framework
- **TypeScript** - Type-safe JavaScript
- **React** - UI component library
- **TailwindCSS** - Utility-first CSS
- **Web Workers** - Background task processing
- **Playwright** - Browser automation for login

## Quick Start

```bash
# Install dependencies
npm install

# Build application
npm run build

# Start development mode
npm run dev

# Run tests
npm test
```

## Project Structure

```
src/
├── main/          # Electron main process (IPC handlers, app lifecycle)
├── preload/       # Preload scripts (secure IPC bridge)
├── renderer/      # React UI components and state management
└── workers/       # Web Workers for background tasks
    ├── upload.worker.ts    # Video upload to CDN
    ├── discover.worker.ts  # Video discovery/scraping
    └── session.worker.ts   # Session management and login
```

## Building for Distribution

```bash
# macOS (Apple Silicon)
npm run build:mac

# Windows
npm run build:win

# All platforms
npm run build:all
```

## Configuration

Application settings are managed via `app.yaml`:

```yaml
config:
  MAX_SSL_CHUNK_SIZE: 8192  # Chunk size for SSL uploads
```

## License

ISC

---

## [ČESKY]

Desktop aplikace pro automatické nahrávání videí na prehrajto.cz

### Funkce

- **Podpora více účtů** - Nahrávání na více účtů prehrajto.cz
- **Sledování pokroku** -实时ní nahrávání s rychlostí a ETA
- **Správa fronty** - Drag & drop přesunutí, pozastavení/pokračování
- **Objevování videí** - Vyhledávání a stahování videí z prehrajto.cz

### Rychlý start

```bash
# Instalace závislostí
npm install

# Sestavení aplikace
npm run build

# Spuštění vývojového režimu
npm run dev
```

### Struktura projektu

```
src/
├── main/          # Electron hlavní proces (IPC handlers)
├── preload/       # Preload skripty
├── renderer/      # React UI komponenty
└── workers/       # Web Workers pro na pozadí
    ├── upload.worker.ts    # Nahrávání videí na CDN
    ├── discover.worker.ts  # Vyhledávání videí
    └── session.worker.ts   # Správa sessions a přihlášení
```

### Licencování

ISC
