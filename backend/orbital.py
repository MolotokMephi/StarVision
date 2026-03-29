"""
orbital.py — Орбитальная механика: SGP4-пропагация, расчёт положений.
"""

import math
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple

from sgp4.api import Satrec, WGS72
from sgp4.api import jday

from satellites import RUSSIAN_CUBESATS, SatelliteInfo

# ── Константы ───────────────────────────────────────────────────────
EARTH_RADIUS_KM = 6371.0
MU = 398600.4418            # км³/с² — гравитационный параметр Земли
J2 = 1.08263e-3             # вторая зональная гармоника
DEG2RAD = math.pi / 180.0
RAD2DEG = 180.0 / math.pi


def tle_to_satrec(tle1: str, tle2: str) -> Satrec:
    """Создать объект SGP4 из TLE-строк."""
    return Satrec.twoline2rv(tle1, tle2, WGS72)


def propagate_satellite(sat_info: SatelliteInfo, dt: datetime) -> Dict[str, Any]:
    """
    Пропагировать спутник на момент dt.
    Возвращает ECI-координаты (км), скорость (км/с) и орбитальные элементы.
    """
    satrec = tle_to_satrec(sat_info.tle_line1, sat_info.tle_line2)

    jd, fr = jday(dt.year, dt.month, dt.day,
                  dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)

    error, position, velocity = satrec.sgp4(jd, fr)

    if error != 0:
        return {"error": f"SGP4 error code {error}"}

    x, y, z = position       # км (ECI)
    vx, vy, vz = velocity    # км/с

    # Высота над поверхностью
    r = math.sqrt(x**2 + y**2 + z**2)
    altitude_km = r - EARTH_RADIUS_KM

    # Скорость
    speed = math.sqrt(vx**2 + vy**2 + vz**2)

    # Орбитальный период (приблизительно)
    a = satrec.a * EARTH_RADIUS_KM if satrec.a > 1 else r  # полуось
    period_min = 2 * math.pi * math.sqrt(a**3 / MU) / 60.0

    # Географические координаты (упрощённый ECI → lat/lon)
    lat, lon = eci_to_geodetic(x, y, z, jd + fr)

    return {
        "norad_id": sat_info.norad_id,
        "name": sat_info.name,
        "eci": {"x": round(x, 3), "y": round(y, 3), "z": round(z, 3)},
        "velocity": {"vx": round(vx, 4), "vy": round(vy, 4), "vz": round(vz, 4)},
        "altitude_km": round(altitude_km, 2),
        "speed_km_s": round(speed, 4),
        "period_min": round(period_min, 2),
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "timestamp": dt.isoformat(),
    }


def eci_to_geodetic(x: float, y: float, z: float, jd_total: float) -> Tuple[float, float]:
    """Преобразование ECI → геодезические координаты (lat, lon в градусах)."""
    r = math.sqrt(x**2 + y**2 + z**2)
    lat = math.asin(z / r) * RAD2DEG

    # Звёздное время (GMST) для пересчёта в долготу
    t = (jd_total - 2451545.0) / 36525.0
    gmst = 280.46061837 + 360.98564736629 * (jd_total - 2451545.0) + \
           0.000387933 * t**2 - t**3 / 38710000.0
    gmst = gmst % 360.0

    lon_eci = math.atan2(y, x) * RAD2DEG
    lon = (lon_eci - gmst + 180.0) % 360.0 - 180.0

    return lat, lon


def propagate_all(dt: datetime = None) -> List[Dict[str, Any]]:
    """Пропагировать все спутники на момент dt (или текущий UTC)."""
    if dt is None:
        dt = datetime.now(timezone.utc)

    results = []
    for sat in RUSSIAN_CUBESATS:
        if sat.tle_line1 and sat.tle_line2:
            data = propagate_satellite(sat, dt)
            if "error" not in data:
                results.append(data)
    return results


def propagate_orbit_path(sat_info: SatelliteInfo, dt_start: datetime,
                         steps: int = 120, step_sec: float = 60.0) -> List[Dict[str, float]]:
    """
    Рассчитать точки орбиты для визуализации трека.
    По умолчанию: 120 точек с шагом 60 сек = 2 часа трека.
    """
    satrec = tle_to_satrec(sat_info.tle_line1, sat_info.tle_line2)
    path = []

    for i in range(steps):
        offset = i * step_sec
        t = dt_start.timestamp() + offset
        dt = datetime.fromtimestamp(t, tz=timezone.utc)

        jd, fr = jday(dt.year, dt.month, dt.day,
                      dt.hour, dt.minute, dt.second)
        error, position, _ = satrec.sgp4(jd, fr)

        if error == 0:
            x, y, z = position
            path.append({"x": round(x, 3), "y": round(y, 3), "z": round(z, 3)})

    return path


def get_orbital_elements(sat_info: SatelliteInfo) -> Dict[str, Any]:
    """Извлечь кеплеровы элементы из TLE."""
    satrec = tle_to_satrec(sat_info.tle_line1, sat_info.tle_line2)

    incl = satrec.inclo * RAD2DEG
    raan = satrec.nodeo * RAD2DEG
    ecc = satrec.ecco
    argp = satrec.argpo * RAD2DEG
    mean_anom = satrec.mo * RAD2DEG
    mean_motion = satrec.no_kozai * (RAD2DEG * 1440.0 / (2 * math.pi))  # об/день

    # Полуось из среднего движения
    n_rad_min = satrec.no_kozai / 60.0  # рад/с → рад/мин... нет, satrec.no_kozai в рад/мин
    n_rad_s = satrec.no_kozai / 60.0
    a_km = (MU / (n_rad_s**2))**(1/3) if n_rad_s > 0 else 0

    return {
        "norad_id": sat_info.norad_id,
        "name": sat_info.name,
        "inclination_deg": round(incl, 4),
        "raan_deg": round(raan, 4),
        "eccentricity": round(ecc, 6),
        "arg_perigee_deg": round(argp, 4),
        "mean_anomaly_deg": round(mean_anom, 4),
        "mean_motion_rev_day": round(mean_motion, 6),
        "semi_major_axis_km": round(a_km, 2),
        "altitude_approx_km": round(a_km - EARTH_RADIUS_KM, 2),
    }
