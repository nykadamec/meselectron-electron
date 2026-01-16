# Prehraj.to AutoPilot

<div align="center">

[![Electron](https://img.shields.io/badge/Electron-39.2.7-47848F?style=flat-square&logo=electron)](https://electronjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?style=flat-square&logo=typescript)](https://typescriptlang.org)
[![React](https://img.shields.io/badge/React-19.2.3-61DAFB?style=flat-square&logo=react)](https://reactjs.org)
[![License](https://img.shields.io/badge/License-ISC-FDAD00?style=flat-square)](LICENSE)

<br>

```
        ____           _                _ _        
        |  _ \ _ __ ___| |__  _ __ __ _ (_) |_ ___  
        | |_) | '__/ _ \ '_ \| '__/ _` || | __/ _ \ 
        |  __/| | |  __/ | | | | | (_| || | || (_) |
        |_|   |_|  \___|_| |_|_|  \__,_|/ |\__\___/ 
                                      |__/          
```

### Desktop application for automated video upload

<br>

**Progress: [████....] 4%**

</div>

---

## Features

| Feature | Status |
|---------|--------|
| Multi-account upload | ✅ |
| Progress tracking | ✅ |
| Queue management | ✅ |
| Drag & drop reordering | ✅ |
| Video discovery | ✅ |
| Session management | ✅ |
| Dark/Light theme | 🔄 |
| Auto-updater | 🔄 |

## Quick Start

```bash
npm install
npm run build
npm run dev
```

## Tech Stack

```
Electron + TypeScript ─────┬── Main process & IPC
                           │
React + TailwindCSS ───────┼── UI Components
                           │
Web Workers ───────────────┤ Background tasks
                           │
Playwright ────────────────┘ Browser automation
```

## Project Structure

```
src/
├── main/       → Electron IPC handlers
├── preload/    → Secure bridge
├── renderer/   → React UI
└── workers/    → Background tasks
    ├── upload.worker.ts
    ├── discover.worker.ts
    └── session.worker.ts
```

---

## [ČESKY]

<div align="center">

**Desktop aplikace pro automatické nahrávání videí**

**Stav: [████....] 4%**

</div>

### Funkce

| Funkce | Stav |
|--------|------|
| Nahrávání na více účtů | ✅ |
| Sledování pokroku | ✅ |
| Správa fronty | ✅ |
| Drag & drop přesun | ✅ |
| Objevování videí | ✅ |
| Správa sessions | ✅ |
| Tmavý/světlý motiv | 🔄 |
| Automatické aktualizace | 🔄 |

### Rychlý start

```bash
npm install
npm run build
npm run dev
```

### Licence

ISC

---

<div align="right">

_Generated with Claude Code_

</div>
