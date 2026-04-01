"""
orbital.py — Орбитальная механика: SGP4-пропагация, расчёт положений.
"""

import math
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple

from sgp4.api import Satrec, WGS72
from sgp4.api import jday

from typing import Optional as Opt

from satellites import RUSSIAN_CUBESATS, SatelliteInfo

# ── Константы ───────────────────────────────────────────────────────
EARTH_RADIUS_KM = 6371.0
MU = 398600.4418            # км³/с² — гравитационный параметр Земли
J2 = 1.08263e-3             # вторая зональная гармоника
DEG2RAD = math.pi / 180.0
RAD2DEG = 180.0 / math.pi


def _resolve_tle(
    sat: SatelliteInfo,
    tle_override: Dict[int, tuple] = None,
) -> tuple:
    """Вернуть (tle_line1, tle_line2) — из override или из встроенных."""
    if tle_override and sat.norad_id in tle_override:
        return tle_override[sat.norad_id]
    return sat.tle_line1, sat.tle_line2


def _with_tle(sat: SatelliteInfo, tle1: str, tle2: str) -> SatelliteInfo:
    """Создать копию SatelliteInfo с подменёнными TLE-строками."""
    return SatelliteInfo(
        norad_id=sat.norad_id,
        name=sat.name,
        constellation=sat.constellation,
        purpose=sat.purpose,
        mass_kg=sat.mass_kg,
        form_factor=sat.form_factor,
        launch_date=sat.launch_date,
        status=sat.status,
        tle_line1=tle1,
        tle_line2=tle2,
        description=sat.description,
    )


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


def propagate_all(
    dt: datetime = None,
    tle_override: Dict[int, tuple] = None,
) -> List[Dict[str, Any]]:
    """Пропагировать все спутники на момент dt (или текущий UTC).

    Args:
        dt: момент времени (UTC). По умолчанию — текущий UTC.
        tle_override: dict norad_id → (tle_line1, tle_line2).
            Если передан, для каждого спутника используются TLE из этого dict
            (вместо встроенных). Спутники, отсутствующие в dict, пропагируются
            со встроенными TLE.
    """
    if dt is None:
        dt = datetime.now(timezone.utc)

    results = []
    for sat in RUSSIAN_CUBESATS:
        tle1, tle2 = _resolve_tle(sat, tle_override)
        if tle1 and tle2:
            sat_copy = _with_tle(sat, tle1, tle2)
            data = propagate_satellite(sat_copy, dt)
            if "error" not in data:
                results.append(data)
    return results


def propagate_orbit_path(sat_info: SatelliteInfo, dt_start: datetime,
                         steps: int = 120, step_sec: float = 60.0,
                         tle_override: Dict[int, tuple] = None) -> List[Dict[str, float]]:
    """
    Рассчитать точки орбиты для визуализации трека.
    По умолчанию: 120 точек с шагом 60 сек = 2 часа трека.
    """
    tle1, tle2 = _resolve_tle(sat_info, tle_override)
    satrec = tle_to_satrec(tle1, tle2)
    path = []

    for i in range(steps):
        offset = i * step_sec
        t = dt_start.timestamp() + offset
        dt = datetime.fromtimestamp(t, tz=timezone.utc)

        jd, fr = jday(dt.year, dt.month, dt.day,
                      dt.hour, dt.minute, dt.second + dt.microsecond / 1e6)
        error, position, _ = satrec.sgp4(jd, fr)

        if error == 0:
            x, y, z = position
            path.append({"x": round(x, 3), "y": round(y, 3), "z": round(z, 3)})

    return path


def predict_collisions(
    threshold_km: float = 100.0,
    hours_ahead: float = 24.0,
    step_sec: float = 60.0,
    tle_override: Dict[int, tuple] = None,
) -> List[Dict[str, Any]]:
    """
    Прогнозирование потенциальных коллизий (сближений).
    Проверяет все пары спутников на минимальное расстояние в заданном временном окне.
    """
    dt_start = datetime.now(timezone.utc)
    steps = int(hours_ahead * 3600 / step_sec)
    sats_with_tle = []
    for s in RUSSIAN_CUBESATS:
        t1, t2 = _resolve_tle(s, tle_override)
        if t1 and t2:
            sats_with_tle.append(_with_tle(s, t1, t2))
    satrecs = [(s, tle_to_satrec(s.tle_line1, s.tle_line2)) for s in sats_with_tle]

    close_approaches: List[Dict[str, Any]] = []
    # Для каждой пары находим минимальное расстояние за период
    pair_min: Dict[tuple, Dict[str, Any]] = {}

    for step_i in range(0, steps, max(1, steps // 200)):  # Ограничиваем шаги для оптимизации
        offset = step_i * step_sec
        dt = dt_start + timedelta(seconds=offset)
        jd, fr = jday(dt.year, dt.month, dt.day,
                      dt.hour, dt.minute, dt.second)

        positions = []
        for sat, satrec in satrecs:
            error, pos, _ = satrec.sgp4(jd, fr)
            if error == 0:
                positions.append((sat, pos))

        for i in range(len(positions)):
            for j in range(i + 1, len(positions)):
                s1, p1 = positions[i]
                s2, p2 = positions[j]
                dx = p1[0] - p2[0]
                dy = p1[1] - p2[1]
                dz = p1[2] - p2[2]
                dist = math.sqrt(dx*dx + dy*dy + dz*dz)

                pair_key = (s1.norad_id, s2.norad_id)
                if pair_key not in pair_min or dist < pair_min[pair_key]["min_distance_km"]:
                    pair_min[pair_key] = {
                        "norad_id_1": s1.norad_id,
                        "name_1": s1.name,
                        "norad_id_2": s2.norad_id,
                        "name_2": s2.name,
                        "min_distance_km": round(dist, 2),
                        "time_of_closest_approach": dt.isoformat(),
                        "risk_level": "critical" if dist < 10 else "warning" if dist < threshold_km else "safe",
                    }

    for pair_data in pair_min.values():
        if pair_data["min_distance_km"] <= threshold_km:
            close_approaches.append(pair_data)

    close_approaches.sort(key=lambda x: x["min_distance_km"])
    return close_approaches


def optimize_plane_distribution(
    num_satellites: int,
    num_planes: int,
    altitude_km: float = 550.0,
    inclination_deg: float = 55.0,
) -> Dict[str, Any]:
    """
    Расчёт оптимального распределения КА по орбитальным плоскостям (Walker constellation).
    Возвращает параметры Walker-δ constellation: T/P/F.
    """
    T = num_satellites  # Total satellites
    P = max(1, min(num_planes, T))  # Number of planes
    S = T // P  # Satellites per plane (integer)
    remainder = T % P
    F = 1  # Phase factor (0..P-1), optimal for coverage is usually 1

    # Оптимальный F для максимального покрытия
    if P > 1:
        F = max(1, P // 2)

    a = EARTH_RADIUS_KM + altitude_km
    period_sec = 2 * math.pi * math.sqrt(a**3 / MU)
    period_min = period_sec / 60.0
    velocity = math.sqrt(MU / a)

    planes = []
    sat_idx = 0
    for p_idx in range(P):
        raan_deg = (p_idx / P) * 360.0
        n_in_plane = S + (1 if p_idx < remainder else 0)
        sats_in_plane = []
        for s_idx in range(n_in_plane):
            phase_deg = (s_idx / n_in_plane) * 360.0 + (F * p_idx / P) * (360.0 / n_in_plane)
            phase_deg = phase_deg % 360.0
            sats_in_plane.append({
                "index": sat_idx,
                "mean_anomaly_deg": round(phase_deg, 2),
            })
            sat_idx += 1
        planes.append({
            "plane_index": p_idx,
            "raan_deg": round(raan_deg, 2),
            "satellites_count": n_in_plane,
            "satellites": sats_in_plane,
        })

    return {
        "walker_notation": f"{T}/{P}/{F}",
        "total_satellites": T,
        "num_planes": P,
        "sats_per_plane": S,
        "phase_factor": F,
        "altitude_km": altitude_km,
        "inclination_deg": inclination_deg,
        "orbital_period_min": round(period_min, 2),
        "velocity_km_s": round(velocity, 3),
        "planes": planes,
        "coverage_note": f"Walker-δ {T}/{P}/{F}: {P} плоскостей RAAN через {round(360/P, 1)}°, "
                        f"{S} КА/плоскость, межплоскостный сдвиг F={F}",
    }


def get_orbital_elements(
    sat_info: SatelliteInfo,
    tle_override: Dict[int, tuple] = None,
) -> Dict[str, Any]:
    """Извлечь кеплеровы элементы из TLE."""
    tle1, tle2 = _resolve_tle(sat_info, tle_override)
    satrec = tle_to_satrec(tle1, tle2)

    incl = satrec.inclo * RAD2DEG
    raan = satrec.nodeo * RAD2DEG
    ecc = satrec.ecco
    argp = satrec.argpo * RAD2DEG
    mean_anom = satrec.mo * RAD2DEG
    mean_motion = satrec.no_kozai * 1440.0 / (2 * math.pi)  # рад/мин → об/день

    # Полуось из среднего движения
    n_rad_s = satrec.no_kozai / 60.0  # рад/мин → рад/с
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
