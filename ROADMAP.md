# ROADMAP — StarVision

> Updated 31.03.2026

---

## Spec Coverage / Покрытие ТЗ

### Core Requirements (spec 3–4)

| Requirement | Status |
|---|---|
| Constellation of 3–15 spacecraft (spec 4.1) | Done |
| 15 Russian SC catalog, 7 color-coded constellations | Done |
| Satellite count slider (3–15) with uniform distribution | Done |
| Client-side SGP4 via `satellite.js` — per-frame animation | Done |
| Server-side SGP4 via `python-sgp4` (fallback) | Done |
| Virtual circular Walker orbits (400–2000 km, 1–7 planes) | Done |
| Time control: 1×–200× presets | Done |
| Orbital tracks (120+ points) | Done |
| ISL: per-frame distance calc, green/red lines, LOS check | Done |
| ISL: comm range slider (50–2000 km), toggle, link counter | Done |
| ISL: tooltip with distance on hover (Raycaster) | Done |
| UI panel: satellite count, orbit altitude, comm range, speed | Done |
| UI: toggles for orbits, labels, ISL; constellation filter | Done |
| UI: reset button | Done |
| NASA Blue Marble Earth texture + atmosphere | Done |
| 2 CubeSat 3D models (1U + 3U) — procedural Three.js | Done |
| Camera: rotate, zoom, damping, satellite follow (lerp) | Done |
| TLE from CelesTrak, NASA textures, procedural models | Done |
| 30+ FPS, Chrome/Firefox/Safari, interactive camera | Done |

### Bonus Requirements (spec 7)

| Requirement | Status |
|---|---|
| AI assistant StarAI (Claude API + offline fallback) — spec 7.5 | Done |
| Collision prediction API (/api/collisions) — spec 7.5 | Done |
| Orbital plane optimization (Walker-delta) — spec 7.5 | Done |
| LOS check (Earth shadow on ISL) — spec 3.4 | Done |
| Open data & ethics compliance — spec 7.6 | Done |
| Architecture docs (ARCHITECTURE.md) — spec 7.3 | Done |
| **Multilingual UI (RU/EN)** — spec 7.2 | Done |

---

## Performance Optimizations

- Object pooling for ISL lines (120 pre-allocated)
- Throttled ISL computation (every 2nd frame)
- Throttled raycasting (every 6th frame)
- Early exit for distant satellite pairs (squared distance)
- Reduced star count (1500)
- Adaptive DPR cap [1, 1.5]
- Batched orbit loading (4 concurrent)
- Backend polling interval 5–10s

---

## Remaining Tasks

1. Deploy (Vercel + Railway)
2. Screenshots / video for presentation (spec 3.8)
