# StarVision — CubeSat Constellation Digital Twin

> **Hackathon: Digital Twins of Space Systems**
> Interactive 3D prototype of a CubeSat constellation digital twin

---

## About

**StarVision** is a digital twin of a Russian CubeSat constellation that enables:
- Real-time 3D visualization of 3–15 satellites in orbit
- Orbital motion modeling via SGP4 propagation (client-side `satellite.js`)
- Dynamic inter-satellite link (ISL) visualization with LOS checks
- **Automatic TLE loading from CelesTrak** with source selection (embedded / live)
- UI controls for satellite count, orbit altitude, communication range, and more
- Multilingual interface (Russian / English)
- AI assistant (StarAI) powered by Anthropic Claude API

---

## Features

- **15 Russian spacecraft** catalog: Sfera, Gonets, SiriusSat, Descartes, UmKA, Zorkiy, Berkut, Aist, Tanyusha
- **Client-side SGP4** via `satellite.js` — smooth per-frame animation
- **Inter-satellite links (ISL)** — per-frame distance calculation with LOS check (Earth shadow)
- **TLE source: embedded data or CelesTrak** — one-click switching
- **NASA Blue Marble** Earth texture with Suspense fallback
- **2 CubeSat 3D models**: 1U (2 solar panels) and 3U (4 panels) — procedural Three.js
- **StarAI** — built-in AI assistant (Anthropic Claude API) with UI control commands
- **Virtual Walker orbits** — configurable altitude (400–2000 km), 1–7 orbital planes
- **Optimized rendering** — object pooling, throttled raycasting, adaptive DPR

### Parameters

| Parameter | Range | Description |
|---|---|---|
| Satellite count | 3–15 | Uniform selection from catalog |
| Orbit altitude | TLE / 400–2000 km | TLE = real data; otherwise virtual Walker constellation |
| TLE source | Embedded / CelesTrak | Choose between demo data and live CelesTrak TLE |
| Communication range | 50–10,000 km | ISL link visibility threshold |
| Simulation speed | 1×–200× | Time acceleration presets |
| ISL links | on/off | Show/hide inter-satellite links |
| Orbital tracks | on/off | Show/hide orbit traces |
| Satellite labels | on/off | Show/hide spacecraft names |
| Constellation filter | 7 groups | Selective display by constellation |
| Language | RU / EN | Interface language |

---

## Quick Start

### Requirements
- **Node.js** >= 18.0, **npm** >= 9.0
- **Python** >= 3.10
- Modern browser (Chrome 90+, Firefox 90+, Safari 15+)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env           # Add ANTHROPIC_API_KEY for StarAI (optional)
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # -> http://localhost:3000
```

Frontend auto-proxies `/api/*` to `localhost:8000` (configured in `vite.config.ts`).

---

## Satellites

| Constellation | Satellites | Purpose | Model |
|---|---|---|---|
| **Sfera** | Skif-D, Marathon-IoT-1/2/3 | Internet, IoT | 3U |
| **Gonets** | Gonets-M No. 21/22/23 | Personal satellite communication | 3U |
| **Educational** | SiriusSat-1/2, Tanyusha-YUZGU-1 | Science, education | 1U |
| **MIPT** | Descartes | MIPT experiments | 1U |
| **Bauman MSTU** | UmKA-1 | Educational projects | 1U |
| **EO** | Zorkiy-2M, Berkut-S | Earth observation | 3U |
| **Scientific** | Aist-2T | Scientific experiments | 1U |

---

## Tech Stack

| Component | Technology | License |
|---|---|---|
| Frontend | React 18 + TypeScript | MIT |
| 3D Engine | Three.js / React Three Fiber / Drei | MIT |
| Orbital mechanics (client) | satellite.js | MIT |
| UI framework | Tailwind CSS | MIT |
| State management | Zustand | MIT |
| Backend | Python FastAPI | MIT |
| Orbital mechanics (server) | python-sgp4 | MIT |
| AI assistant | Anthropic Claude API | — |
| Bundler | Vite | MIT |

---

## API Endpoints

| Method | URL | Description |
|---|---|---|
| GET | `/api/satellites` | List of all 15 spacecraft with metadata |
| GET | `/api/positions` | Current ECI coordinates of all spacecraft |
| GET | `/api/tle?source=embedded\|celestrak` | TLE data (embedded or from CelesTrak) |
| POST | `/api/tle/refresh` | Force refresh TLE cache from CelesTrak |
| GET | `/api/orbit/{norad_id}` | Orbital track (120 points, 60s step) |
| GET | `/api/links?comm_range_km=3000` | ISL with LOS check |
| GET | `/api/orbital-elements/{norad_id}` | Keplerian orbital elements |
| GET | `/api/collisions` | Close approach predictions |
| POST | `/api/starai/chat` | StarAI — chat with JSON UI commands |
| GET | `/api/config` | Initial frontend configuration |

---

## Data Sources

### TLE (Two-Line Element)
- **CelesTrak** — https://celestrak.org — automatic TLE loading for Russian spacecraft
- Data is cached for 1 hour, with fallback to embedded data if service is unavailable
- Source switching via control panel (Embedded / CelesTrak)

### Earth Textures
- **NASA Blue Marble** — NASA Earth Observatory / EOSDIS
- License: NASA Media Usage Guidelines — free use with attribution

### 3D Satellite Models
- **Custom procedural models** in Three.js (BoxGeometry + PlaneGeometry)
  - 1U CubeSat: 10×10×10 mm body + 2 solar panels
  - 3U CubeSat: 10×30×10 mm body + 4 solar panels

---

## Architecture

For detailed architecture documentation with Mermaid diagrams (system overview, data flows, component hierarchy, data model, orbital mechanics), see the main [README.md](../README.md).

---

## Security & Ethics

- All orbital data (TLE) from open public sources (CelesTrak)
- Earth textures used per NASA Media Usage Guidelines
- 3D satellite models created independently (procedural Three.js generation)
- All libraries have open MIT license
- Project license: Unlicense (public domain)
