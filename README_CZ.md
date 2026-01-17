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

### 💻 Desktopová aplikace pro automatickou správu a nahrávání videí na prehraj.to

### 🚧 !! VE VÝVOJI !!

<br>

[**Funkce**](#-funkce) •
[**Architektura**](#-architektura) •
[**Technologie**](#-technologie) •
[**Instalace**](#-instalace) •
[**Sestavení**](#-sestavení)

<br>

</div>

---

## 📖 Přehled

Prehraj.to AutoPilot je výkonná desktopová aplikace navržená pro automatizaci workflow správy videí pro českou video platformu prehraj.to. Postavena na Electronu a Reactu, poskytuje moderní multiplatformní rozhraní pro objevování, stahování, vodoznakování a nahrávání videí.

Aplikace běží zcela lokálně na vašem počítači, což zajišťuje bezpečnost vašich přihlašovacích údajů a dat. Veškeré zpracování videí probíhá ve vláknech na pozadí, takže rozhraní zůstává responzivní i během náročných operací.

---

## ✨ Funkce

### 📤 Správa více účtů
- Podpora více účtů prehraj.to
- Bezpečné ukládání přihlašovacích údajů s automatickým přihlášením
- Správa sessions s automatickým obnovením tokenů
- Automatická validace sessions před operacemi

### 📋 Systém správy fronty
- **Přetahování (Drag & Drop)** - Snadná změna priority stahování/nahrávání
- **Sledování pokroku v reálném čase** - Živé aktualizace rychlosti, ETA a procenta dokončení
- **Zrušení stahování** - Okamžité ukončení aktivního stahování tlačítkem
- **Opakování neúspěšných položek** - Jedním kliknutím znovu spustit neúspěšná stahování/nahrání
- **Pozastavení/Obnovení** - Dočasně pozastavit frontu a pokračovat později

### 💾 Persistence dat
- Zpracovaná videa se pamatují i po restartu aplikace
- Persistence stavu fronty zachovává historii stahování
- Nastavení se automaticky ukládají a obnovují
- Data uložená lokálně v systémovém adresáři aplikací

### 🔍 Objevování videí
- Automatické objevování videí na prehraj.to
- Filtrování podle délky a velikosti souboru
- Náhled detailů videa před přidáním do fronty
- Podpora multi-výběru pro dávkové operace

### 🎬 Zpracování videí
- **Paralelní stahování po kouscích** - Spolehlivé stahování velkých videí po 2MB částech
- **Více režimů stahování** - Volba mezi ffmpeg-chunks, curl nebo wget
- **Vodoznakování** - Volitelný vodoznak pomocí ffmpeg
- **HQ/LQ zpracování** - Přepínání mezi originální kvalitou a přímými staženími

### 📊 Pokrok a statistiky
- Sledování rychlosti stahování/nahrávání v reálném čase
- Výpočet ETA na základě aktuální rychlosti
- Statistika session (celkem nahráno, staženo, výdělky)
- Sledování kreditů účtu

---

## 🏗️ Architektura

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Hlavní proces Electronu                          │
│  • IPC komunikační most mezi procesy                                 │
│  • Operace se souborovým systémem (nastavení, persistence)          │
│  • Správa vláken workerů (stahování, nahrávání, objevování)         │
│  • Šifrování přihlašovacích údajů účtů                              │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   Stahování  │ │   Nahrávání  │ │  Objevování  │
            │    Worker    │ │    Worker    │ │    Worker    │
            │   (Vlákno)   │ │   (Vlákno)   │ │   (Vlákno)   │
            └─────────────┘ └─────────────┘ └─────────────┘
                    │               │               │
                    └───────────────┴───────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │          React Renderer UI           │
                    │  • Komponenty (React 19)             │
                    │  • Správa stavu (Zustand)            │
                    │  • Drag & Drop (dnd-kit)             │
                    │  • Styly (TailwindCSS 4)             │
                    └─────────────────────────────────────┘
```

### Klíčové principy návrhu

- **Izolace procesů**: Náročné operace běží ve Web Workers pro udržení responzivního UI
- **IPC komunikace**: Bezpečný most mezi rendererem a hlavním procesem přes preload skripty
- **Správa stavu**: Zustand store s perzistencí pro UI stav
- **Typová bezpečnost**: Úplné pokrytí TypeScriptem napříč všemi vrstvami

---

## 🛠️ Technologie

| Vrstva | Technologie | Účel |
|--------|-------------|------|
| **Runtime** | Electron 39.2.7 | Multiplatformní desktop framework |
| **Jazyk** | TypeScript 5.9.3 | Typově bezpečný nadskript JavaScriptu |
| **UI Framework** | React 19.2.3 | Komponentová knihovna UI |
| **Styly** | TailwindCSS 4 | Utility-first CSS framework |
| **Správa stavu** | Zustand | Lehká knihovna pro stav |
| **Drag & Drop** | @dnd-kit | Moderní nástroj pro přetahování |
| **HTTP klient** | Axios | Promise-based HTTP požadavky |
| **Zpracování videa** | FFmpeg | Enkódování/dekódování/vodoznaky videa |
| **Vlákna na pozadí** | Node.js Worker Threads | Paralelní zpracování |
| **Automatizace prohlížeče** | Playwright | Správa sessions a přihlášení |

---

## 📁 Struktura projektu

```
preHrajto-AutoPilot/
├── src/
│   ├── main/                          # Hlavní proces Electronu
│   │   ├── ipc-handlers.ts           # IPC handler implementace
│   │   └── index.ts                   # Vstupní bod hlavního procesu
│   │
│   ├── preload/                       # Preload skripty (bezpečný most)
│   │   └── index.ts                   # Definice context bridge
│   │
│   ├── renderer/                      # React UI aplikace
│   │   ├── src/
│   │   │   ├── App.tsx               # Hlavní komponent aplikace
│   │   │   ├── store/
│   │   │   │   └── index.ts          # Zustand store & persistence
│   │   │   ├── types/
│   │   │   │   ├── index.ts          # TypeScript definice typů
│   │   │   │   └── electron.d.ts     # Typové deklarace Electron API
│   │   │   └── components/           # React komponenty
│   │   │       ├── Header.tsx
│   │   │       ├── QueueList.tsx     # Fronta stahování s drag & drop
│   │   │       ├── VideoCard.tsx
│   │   │       ├── SettingsPanel.tsx
│   │   │       ├── AccountCard.tsx
│   │   │       ├── StatsPanel.tsx
│   │   │       ├── LogViewer.tsx
│   │   │       └── MyVideosCard.tsx
│   │   └── index.html
│   │
│   └── workers/                       # Workery pro zpracování na pozadí
│       ├── download.worker.ts         # Stahování videa s pokrokem
│       ├── upload.worker.ts           # Nahrávání na CDN s opakováním
│       ├── discover.worker.ts         # Automatizace objevování videí
│       ├── session.worker.ts          # Správa sessions a přihlášení
│       └── myvideos.worker.ts         # Výpis videí uživatele
│
├── resources/                         # Build zdroje
│   ├── icon.icns                      # Ikona aplikace pro macOS
│   ├── icon.ico                       # Ikona aplikace pro Windows
│   └── entitlements.mac.plist         # macOS oprávnění
│
├── package.json
├── tsconfig.json
├── tailwind.config.js
└── electron.vite.config.ts
```

---

## 🚀 Instalace

### Požadavky

- **Node.js** 18+ s npm
- **FFmpeg** (pro vodoznakování videí)
- **Git** pro správu verzí

### Instalace

```bash
# Klonovat repository
git clone https://github.com/nykadamec/preHrajto-AutoPilot.git
cd preHrajto-AutoPilot

# Nainstalovat závislosti
npm install

# Spustit vývojový server
npm run dev
```

### Nastavení prostředí

Aplikace vyžaduje následující externí nástroje:

| Nástroj | Pro | Instalace |
|---------|-----|-----------|
| **FFmpeg** | Vodoznakování videí | `brew install ffmpeg` (macOS) / `choco install ffmpeg` (Windows) |
| **curl** | Alternativní režim stahování | Předinstalováno na macOS/Linux |
| **wget** | Alternativní režim stahování | `brew install wget` (macOS) / `choco install wget` (Windows) |

### Nastavení účtů

1. Vytvořte složku `DATA` v kořenovém adresáři projektu
2. Přidejte soubory s cookies pojmenované `login_email@domain.com.dat`
3. Pro automatické přihlášení přidejte soubory s přihlašovacími údaji `credentials_email@domain.com.dat`:

```
email=vas-email@example.com
password= vase-heslo
```

---

## 📦 Sestavení

### Vývojové sestavení

```bash
# Spustit vývojový server s hot reload
npm run dev
```

### Produkční sestavení

```bash
# Sestavit pro aktuální platformu
npm run build

# macOS (Apple Silicon)
npm run build:mac

# Windows (x64)
npm run build:win

# Linux
npm run build:linux

# Všechny platformy
npm run build:all
```

### Výstup sestavení

Build artefakty jsou umístěny v adresáři `release`:

```
release/
├── mac-arm64/        # macOS Apple Silicon
├── mac-x64/          # macOS Intel
├── win-x64/          # Windows
└── linux-x64/        # Linux
```

---

## ⚙️ Konfigurace

### Nastavení

Aplikace ukládá nastavení do systémového adresáře dat aplikací:

| Platforma | Cesta |
|-----------|-------|
| **macOS** | `~/Library/Application Support/prehrajto-autopilot/settings.json` |
| **Windows** | `%APPDATA%\prehrajto-autopilot\settings.json` |
| **Linux** | `~/.config/prehrajto-autopilot/settings.json` |

### Struktura nastavení

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

### Režimy stahování

| Režim | Popis | Nejlepší pro |
|-------|-------|--------------|
| `ffmpeg-chunks` | Paralelní stahování po 2MB částech | Nejspolehlivější, pokračuje v částečných stazích |
| `curl` | curl CLI s progress barem | Jednoduchá stahování, curl nainstalován |
| `wget` | wget CLI s progress barem | Velké soubory, omezené připojení |

### HQ zpracování

- **HQ Processing (ZAPNUTO)**: Používá `?do=download` URL pro originální kvalitu
- **LQ Processing (VYPNUTO)**: Používá přímé URL videí, může mít vodoznaky

---

## 🔧 Vývoj

### Dostupné skripty

| Příkaz | Popis |
|--------|-------|
| `npm run dev` | Spustit vývojový server s hot reload |
| `npm run build` | Sestavit pro aktuální platformu |
| `npm run lint` | Spustit ESLint |
| `npm run lint:fix` | Opravit ESLint chyby automaticky |
| `npm run typecheck` | Spustit TypeScript kontrolu typů |

### Přidávání nových funkcí

1. **IPC Handlery** - Přidat handlery v `src/main/ipc-handlers.ts`
2. **Bridge funkce** - Zpřístupnit v `src/preload/index.ts`
3. **Typové deklarace** - Aktualizovat `src/renderer/src/types/electron.d.ts`
4. **Akce store** - Přidat v `src/renderer/src/store/index.ts`
5. **UI Komponenty** - Vytvořit v `src/renderer/src/components/`

### Ladění

```bash
# Povolit debug logging v rendereru
DEBUG=* npm run dev

# Zobrazit logy hlavního procesu (stderr)
tail -f /path/to/release/*.app/Contents/MacOS/*

# Povolit Chrome DevTools v produkci
npm run dev -- --inspect
```

---

## 📄 Licence

Tento projekt je licencován pod licencí **ISC**.

Podrobnosti naleznete v souboru [LICENSE](LICENSE).

---

## 🤝 Přispívání

1. Forkněte repository
2. Vytvořte větev pro funkci (`git checkout -b feature/nova-funkce`)
3. Commitněte změny (`git commit -m 'feat: přidat novou funkci'`)
4. Pushněte do větve (`git push origin feature/nova-funkce`)
5. Otevřete Pull Request

---

## 📞 Podpora

- **Issues**: Hlaste chyby a žádejte funkce přes GitHub Issues
- **Discussions**: Použijte GitHub Discussions pro dotazy a nápady

---

<div align="center">

**Vytvořeno s ❤️ pro komunitu prehraj.to**

</div>
