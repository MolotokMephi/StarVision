# StarVision — CubeSat Constellation Digital Twin

> **Hackathon: Digital Twins of Space Systems**
> Interactive 3D prototype of a CubeSat constellation digital twin

---

## About / О проекте

**StarVision** is a digital twin of a CubeSat constellation that enables:
- Real-time 3D visualization of 3–15 satellites in orbit
- Orbital motion modeling via SGP4 propagation (client-side `satellite.js`)
- Dynamic inter-satellite link (ISL) visualization with LOS checks
- UI controls for satellite count, orbit altitude, communication range, and more
- Multilingual interface (Russian / English)
- AI assistant (StarAI) powered by Anthropic Claude API

**StarVision** — цифровой двойник группировки кубсатов:
- 3D-визуализация группировки из 3–15 спутников на орбите
- Моделирование орбитального движения через SGP4 (клиентский `satellite.js`)
- Динамические межспутниковые связи (МСС) с проверкой затенения Землёй
- Параметризация: количество КА, высота орбиты, дальность связи
- Мультиязычный интерфейс (русский / английский)
- ИИ-ассистент StarAI на Anthropic Claude API

---

## Features / Возможности

- **15 Russian spacecraft** in catalog: Sfera, Gonets, SiriusSat, Descartes, UmKA, Zorkiy, Berkut, Aist, Tanyusha
- **Client-side SGP4** via `satellite.js` — smooth per-frame animation
- **Inter-satellite links (ISL)** — per-frame distance calculation with LOS check (Earth shadow)
- **NASA Blue Marble** Earth texture with Suspense fallback
- **2 CubeSat 3D models**: 1U (2 solar panels) and 3U (4 panels) — procedural Three.js
- **Smooth camera animation** (lerp) with satellite follow mode
- **StarAI** — built-in AI assistant (Anthropic Claude API) with UI control commands
- **Virtual Walker orbits** — configurable altitude (400–2000 km), 1–7 orbital planes
- **Multilingual UI** — Russian / English with instant switching
- **Optimized rendering** — object pooling, throttled raycasting, adaptive DPR

### Parameters (per spec 3.5)

| Parameter | Range | Description |
|---|---|---|
| Satellite count | 3–15 | Uniform selection from catalog |
| Orbit altitude | TLE / 400–2000 km | TLE = real data; otherwise virtual Walker constellation |
| Communication range | 50–10 000 km | ISL link visibility threshold |
| Simulation speed | 1×–200× | Time acceleration presets |
| ISL links | on/off | Show/hide inter-satellite links |
| Orbital tracks | on/off | Show/hide orbit traces |
| Satellite labels | on/off | Show/hide spacecraft names |
| Constellation filter | 7 groups | Selective display by constellation |
| Language | RU / EN | Interface language |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18 + TypeScript)          │
│                                                                   │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────┐  ┌──────────┐ │
│  │ Scene3D  │  │ InterSatellite   │  │ Control  │  │ StarAI   │ │
│  │ (R3F)    │  │ Links (ISL)      │  │ Panel    │  │ Chat     │ │
│  │ Earth    │  │ LOS-check        │  │ Sliders  │  │ Claude   │ │
│  │ Camera   │  │ Green/Red lines  │  │ Toggles  │  │ API      │ │
│  └────┬─────┘  └────────┬─────────┘  └────┬─────┘  └────┬─────┘ │
│       │                 │                  │              │       │
│  ┌────▼─────────────────▼──────────────────▼──────────────▼────┐  │
│  │                     Zustand Store + i18n                    │  │
│  │  lang · timeSpeed · satelliteCount · orbitAltitudeKm        │  │
│  │  commRangeKm · showLinks · activeLinksCount · tleData       │  │
│  └──────────────────────────┬──────────────────────────────────┘  │
│                              │ REST API                           │
├──────────────────────────────┼────────────────────────────────────┤
│                       BACKEND (FastAPI + Python)                  │
│                                                                   │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐ │
│  │ orbital.py   │  │ satellites.py │  │ ai_assistant.py        │ │
│  │ SGP4 python  │  │ catalog 15 SC │  │ Claude API + fallback  │ │
│  │ ECI→geodetic │  │ TLE data      │  │ JSON commands          │ │
│  └──────────────┘  └───────────────┘  └────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### Key architectural decisions
- **Client-side SGP4**: `satellite.js` on frontend for smooth per-frame animation without network dependency
- **Shared simClock**: single time source for synchronized camera, satellites, and ISL
- **Zustand Store**: lightweight state management
- **Virtual orbits**: when `orbitAltitudeKm > 0`, analytical circular Walker-type orbits are generated
- **LOS check**: geometric ray-sphere test for Earth shadow detection on ISL
- **i18n**: lightweight translation module with `t()` helper, no external dependencies

---

## Quick Start

### Requirements
- **Node.js** >= 18.0
- **npm** >= 9.0
- **Python** >= 3.10
- Modern browser (Chrome 90+, Firefox 90+, Safari 15+)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Linux/Mac
# venv\Scripts\activate        # Windows
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

### Production build

```bash
cd frontend
npm run build                  # -> dist/
```

---

## Satellites / Спутники

| Constellation | Satellites | Purpose | Model |
|---|---|---|---|
| **Sfera / Сфера** | Skif-D, Marathon-IoT-1/2/3 | Internet, IoT | 3U |
| **Gonets / Гонец** | Gonets-M No. 21/22/23 | Personal satellite communication | 3U |
| **Educational / Образовательные** | SiriusSat-1/2, Tanyusha-YUZGU-1 | Science, education | 1U |
| **MIPT / МФТИ** | Descartes | MIPT experiments | 1U |
| **Bauman MSTU / МГТУ** | UmKA-1 | Educational projects | 1U |
| **EO / ДЗЗ** | Zorkiy-2M, Berkut-S | Earth observation | 3U |
| **Scientific / Научные** | Aist-2T | Scientific experiments | 1U |

---

## Project Structure

```
StarVision/
├── backend/
│   ├── main.py               # FastAPI endpoints
│   ├── satellites.py         # 15 Russian spacecraft catalog + TLE data
│   ├── orbital.py            # SGP4 propagation (python-sgp4), ECI → geodetic
│   ├── ai_assistant.py       # StarAI — Claude API + offline fallback
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Scene3D.tsx            # Canvas (R3F), CameraController
│       │   ├── Earth.tsx              # NASA Blue Marble + Suspense fallback
│       │   ├── Satellites.tsx         # SGP4, 2 CubeSat models, Walker orbits
│       │   ├── InterSatelliteLinks.tsx # ISL per-frame, LOS, object pooling
│       │   ├── ControlPanel.tsx       # Speed, sliders, toggles, constellations
│       │   ├── Header.tsx             # UTC, status, language switcher
│       │   ├── SatelliteInfoPanel.tsx # Selected spacecraft telemetry
│       │   └── StarAIChat.tsx         # AI assistant with UI commands
│       ├── hooks/useStore.ts          # Zustand state
│       ├── i18n.ts                    # Multilingual RU/EN translations
│       ├── services/api.ts            # REST API client
│       ├── simClock.ts                # Shared simulation clock
│       └── types.ts                   # TypeScript interfaces
├── ARCHITECTURE.md
├── ROADMAP.md
└── README.md
```

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
| GET | `/api/tle` | TLE data for client-side SGP4 propagation |
| GET | `/api/orbit/{norad_id}` | Orbital track (120 points, 60s step) |
| GET | `/api/links?comm_range_km=3000` | Inter-satellite links with LOS check |
| GET | `/api/orbital-elements/{norad_id}` | Keplerian orbital elements |
| POST | `/api/starai/chat` | StarAI — chat with JSON UI commands |
| GET | `/api/config` | Initial frontend configuration |

---

## Data Sources

### TLE (Two-Line Element) — orbital data
- **CelesTrak** — https://celestrak.org — source of TLE for Russian spacecraft
- **Space-Track.org** — https://www.space-track.org — US Space Force official database
- License: TLE data is public domain
- **Note:** TLE data is currently embedded in `backend/satellites.py` for demo purposes. Live fetch from CelesTrak/Space-Track is planned but not yet implemented.

### Earth Textures
- **NASA Blue Marble** "World, April 2004" — NASA Earth Observatory / EOSDIS
  - Authors: Reto Stockli et al., NASA Goddard Space Flight Center
  - License: NASA Media Usage Guidelines — free use with attribution

### 3D Satellite Models
- **Custom procedural models** in Three.js (BoxGeometry + PlaneGeometry)
  - 1U CubeSat: 10×10×10 mm body + 2 solar panels
  - 3U CubeSat: 10×30×10 mm body + 4 solar panels
- **Specification**: CubeSat Design Specification Rev. 14 — https://www.cubesat.org/

### Open-Source Libraries (MIT License)
- Three.js — https://threejs.org | React Three Fiber — https://r3f.docs.pmnd.rs
- satellite.js — https://github.com/shashwatak/satellite-js
- Tailwind CSS — https://tailwindcss.com | Zustand — https://github.com/pmndrs/zustand
- FastAPI — https://fastapi.tiangolo.com | Anthropic SDK — https://github.com/anthropics/anthropic-sdk-python

---

## Use Cases / Сценарии использования

### Engineering Analysis
Engineer adjusts orbit altitude and observes how ISL density changes. The interface helps evaluate at which altitude maximum connectivity is achieved.

### Educational Scenario
Student studies the effect of satellite count on constellation connectivity. Increasing from 3 to 15 satellites, they observe ISL growth and learn about orbital configuration.

### Presentation Scenario
Expert demonstrates constellation capabilities: satellite motion, ISL appearance/disappearance during orbital movement. The visualization clearly explains satellite communication principles.

---

## Security & Ethics (spec 7.6)

- All orbital data (TLE) from open public sources (CelesTrak, Space-Track.org) with no distribution restrictions
- Earth textures used per NASA Media Usage Guidelines
- 3D satellite models created independently (procedural Three.js generation)
- All libraries have open MIT license
- Project license: Unlicense (public domain)

---

## References

| Project | Description |
|---|---|
| [Stuff in Space](https://stuffin.space) | Interactive satellite map on Three.js with real TLE |
| [Satellite Map](https://satellitemap.space) | Starlink visualization on WebGL |
| [NASA Eyes on the Earth](https://eyes.nasa.gov/apps/earth) | NASA satellite 3D visualization |
| [CesiumJS](https://cesium.com/platform/cesiumjs) | 3D globe with satellite animation support |
| [satellite.js](https://github.com/shashwatak/satellite-js) | SGP4 propagation for JavaScript |
| [poliastro](https://docs.poliastro.space) | Python astrodynamics library |
