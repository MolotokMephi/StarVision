"""
main.py — StarVision Backend (FastAPI)
Цифровой двойник группировки российских кубсатов.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from satellites import get_all_satellites, get_satellite_by_id, get_tle_data
from orbital import (
    propagate_all, propagate_satellite, propagate_orbit_path,
    get_orbital_elements, predict_collisions, optimize_plane_distribution,
)
from ai_assistant import ask_starai

# ── Приложение ──────────────────────────────────────────────────────
app = FastAPI(
    title="StarVision API",
    description="API цифрового двойника группировки российских кубсатов",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],        # В проде — конкретный домен фронта
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Модели запросов ─────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str       # "user" | "assistant"
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


class SimulationParams(BaseModel):
    time_speed: float = 1.0
    show_orbits: bool = True
    show_coverage: bool = False
    selected_constellations: List[str] = []


# ── Эндпоинты: Спутники ────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "project": "StarVision",
        "version": "1.0.0",
        "description": "Цифровой двойник группировки российских кубсатов",
    }


@app.get("/api/satellites")
async def list_satellites():
    """Список всех спутников с метаданными."""
    sats = get_all_satellites()
    return {"satellites": sats, "count": len(sats)}


@app.get("/api/satellites/{norad_id}")
async def get_satellite(norad_id: int):
    """Информация о конкретном спутнике."""
    sat = get_satellite_by_id(norad_id)
    if not sat:
        raise HTTPException(status_code=404, detail="Спутник не найден")
    return {
        "norad_id": sat.norad_id,
        "name": sat.name,
        "constellation": sat.constellation,
        "purpose": sat.purpose,
        "mass_kg": sat.mass_kg,
        "form_factor": sat.form_factor,
        "launch_date": sat.launch_date,
        "status": sat.status,
        "description": sat.description,
    }


@app.get("/api/tle")
async def get_tle():
    """TLE-данные для клиентской SGP4-пропагации."""
    return {"tle_data": get_tle_data()}


# ── Эндпоинты: Орбитальная механика ────────────────────────────────
@app.get("/api/positions")
async def get_positions(timestamp: Optional[str] = None):
    """
    Текущие позиции всех спутников (ECI + geo).
    ?timestamp=2026-03-29T12:00:00Z — для конкретного момента.
    """
    dt = None
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат timestamp")
    return {"positions": propagate_all(dt), "timestamp": (dt or datetime.now(timezone.utc)).isoformat()}


@app.get("/api/orbit/{norad_id}")
async def get_orbit_path(
    norad_id: int,
    steps: int = Query(default=120, ge=10, le=500),
    step_sec: float = Query(default=60.0, ge=10, le=600),
):
    """Орбитальный трек для визуализации."""
    sat = get_satellite_by_id(norad_id)
    if not sat:
        raise HTTPException(status_code=404, detail="Спутник не найден")
    path = propagate_orbit_path(sat, datetime.now(timezone.utc), steps, step_sec)
    return {"norad_id": norad_id, "name": sat.name, "path": path, "steps": steps}


@app.get("/api/orbital-elements/{norad_id}")
async def get_elements(norad_id: int):
    """Кеплеровы элементы орбиты."""
    sat = get_satellite_by_id(norad_id)
    if not sat:
        raise HTTPException(status_code=404, detail="Спутник не найден")
    return get_orbital_elements(sat)


# ── Эндпоинт: Межспутниковые связи ────────────────────────────────
@app.get("/api/links")
async def get_links(
    comm_range_km: float = Query(default=500.0, ge=50.0, le=5000.0),
    timestamp: Optional[str] = None,
):
    """
    Расчёт межспутниковых связей (ISL).
    Возвращает все пары спутников с расстоянием и статусом связи.
    ?comm_range_km=500 — порог дальности (км)
    ?timestamp=... — момент расчёта (по умолчанию текущий UTC)
    """
    import math

    dt = None
    if timestamp:
        try:
            dt = datetime.fromisoformat(timestamp.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(status_code=400, detail="Неверный формат timestamp")

    positions = propagate_all(dt)

    def has_los(p1, p2):
        """Проверка прямой видимости (линии связи не пересекает Землю)."""
        R = 6371.0
        ax, ay, az = p1["eci"]["x"], p1["eci"]["y"], p1["eci"]["z"]
        bx, by, bz = p2["eci"]["x"], p2["eci"]["y"], p2["eci"]["z"]
        dx, dy, dz = bx - ax, by - ay, bz - az
        len_sq = dx * dx + dy * dy + dz * dz
        if len_sq == 0:
            return True
        t = max(0.0, min(1.0, -(ax * dx + ay * dy + az * dz) / len_sq))
        cx, cy, cz = ax + t * dx, ay + t * dy, az + t * dz
        return (cx * cx + cy * cy + cz * cz) >= R * R

    links = []
    for i in range(len(positions)):
        for j in range(i + 1, len(positions)):
            p1, p2 = positions[i], positions[j]
            dx = p1["eci"]["x"] - p2["eci"]["x"]
            dy = p1["eci"]["y"] - p2["eci"]["y"]
            dz = p1["eci"]["z"] - p2["eci"]["z"]
            dist = math.sqrt(dx * dx + dy * dy + dz * dz)
            los = has_los(p1, p2)
            connected = dist <= comm_range_km and los
            links.append({
                "norad_id_1": p1["norad_id"],
                "norad_id_2": p2["norad_id"],
                "name_1": p1["name"],
                "name_2": p2["name"],
                "distance_km": round(dist, 2),
                "los": los,
                "connected": connected,
            })

    active_count = sum(1 for lnk in links if lnk["connected"])
    return {
        "links": links,
        "active_count": active_count,
        "total_pairs": len(links),
        "comm_range_km": comm_range_km,
        "timestamp": (dt or datetime.now(timezone.utc)).isoformat(),
    }


# ── Эндпоинт: Прогнозирование коллизий ────────────────────────────
@app.get("/api/collisions")
async def get_collisions(
    threshold_km: float = Query(default=100.0, ge=1.0, le=1000.0),
    hours_ahead: float = Query(default=24.0, ge=1.0, le=168.0),
):
    """
    Прогнозирование потенциальных коллизий между спутниками.
    Возвращает пары с минимальным расстоянием ≤ threshold_km за период hours_ahead.
    """
    approaches = predict_collisions(threshold_km, hours_ahead)
    return {
        "close_approaches": approaches,
        "count": len(approaches),
        "threshold_km": threshold_km,
        "hours_ahead": hours_ahead,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── Эндпоинт: Оптимизация распределения по плоскостям ─────────────
@app.get("/api/optimize-planes")
async def get_optimized_planes(
    num_satellites: int = Query(default=12, ge=3, le=50),
    num_planes: int = Query(default=3, ge=1, le=12),
    altitude_km: float = Query(default=550.0, ge=200.0, le=2000.0),
    inclination_deg: float = Query(default=55.0, ge=0.0, le=180.0),
):
    """
    Расчёт оптимального Walker-δ распределения КА по орбитальным плоскостям.
    """
    result = optimize_plane_distribution(num_satellites, num_planes, altitude_km, inclination_deg)
    return result


# ── Эндпоинт: StarAI ───────────────────────────────────────────────
@app.post("/api/starai/chat")
async def starai_chat(req: ChatRequest):
    """Чат с StarAI — ответ + команды для интерфейса."""
    history = [{"role": m.role, "content": m.content} for m in req.history]
    result = await ask_starai(req.message, history)
    return result


# ── Эндпоинт: Конфигурация ─────────────────────────────────────────
@app.get("/api/config")
async def get_config():
    """Начальная конфигурация для фронтенда."""
    return {
        "earth_texture_url": "https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74393/world.200412.3x5400x2700.jpg",
        "earth_radius_km": 6371.0,
        "scale_factor": 1 / 6371.0,     # нормализация: 1 unit = 1 earth radius
        "constellations": ["Сфера", "Гонец", "Образовательные", "ДЗЗ", "Научные", "МФТИ", "МГТУ им. Баумана"],
        "default_time_speed": 1.0,
        "update_interval_ms": 1000,
    }


# ── Запуск ──────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
