"""
main.py — StarGrid Backend (FastAPI)
Цифровой двойник группировки российских кубсатов.
"""

import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from satellites import get_all_satellites, get_satellite_by_id, get_tle_data
from orbital import propagate_all, propagate_satellite, propagate_orbit_path, get_orbital_elements
from ai_assistant import ask_starai

# ── Приложение ──────────────────────────────────────────────────────
app = FastAPI(
    title="StarGrid API",
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
        "project": "StarGrid",
        "version": "1.0.0",
        "description": "Цифровой двойник группировки российских кубсатов",
    }


@app.get("/api/satellites")
async def list_satellites():
    """Список всех спутников с метаданными."""
    return {"satellites": get_all_satellites(), "count": len(get_all_satellites())}


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
