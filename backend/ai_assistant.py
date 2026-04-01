"""
ai_assistant.py — StarAI: ИИ-ассистент, способный отвечать на вопросы
и генерировать команды управления интерфейсом.
"""

import json
import os
from typing import Dict, Any, List, Optional

import httpx
import logging

# Anthropic API (через HTTP, без SDK — для простоты)
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT_BASE = """You are StarAI, the intelligent assistant of the StarVision project.
StarVision is a digital twin of a constellation of Russian cubesats and small spacecraft.

Your capabilities:
1. Answer questions about satellites, orbital mechanics, Russian and global space programs.
2. Control the visualization interface via special commands.
3. Explain physics of orbital motion, Kepler's laws, SGP4 model.
4. Compare constellations (Starlink, OneWeb, Sfera, etc.).
5. Explain inter-satellite links, their principles and limitations.

RESPONSE FORMAT — strictly JSON:
{{
  "message": "Response text to user",
  "actions": [
    // Optional. Array of interface commands:
    // {{"type": "focus_satellite", "norad_id": 56200}}
    // {{"type": "set_time_speed", "speed": 10}}
    // {{"type": "toggle_orbits", "visible": true}}
    // {{"type": "toggle_links", "visible": true}}
    // {{"type": "highlight_constellation", "name": "Сфера"}}
    // {{"type": "set_satellite_count", "count": 10}}
    // {{"type": "set_comm_range", "range_km": 800}}
    // {{"type": "set_orbit_altitude", "altitude_km": 600}}
    // {{"type": "reset_view"}}
  ]
}}

Russian satellites in the system (NORAD ID):
- Sfera constellation: Skif-D (56200), Marathon-IoT-1 (56201), Marathon-IoT-2 (56202), Marathon-IoT-3 (56203)
- Educational: SiriusSat-1 (44394), SiriusSat-2 (44395), Tanyusha-YuZGU-1 (44396)
- MIPT: Dekart (49260)
- Bauman MSTU: UmKA-1 (47951)
- Gonets constellation: Gonets-M #21 (40553), Gonets-M #22 (40554), Gonets-M #23 (40555)
- Earth Observation: Zorkiy-2M (48850), Berkut-S (55120)
- Scientific: Aist-2T (55121)

{lang_instruction}
Be friendly, informative, and passionate about space.
If the user asks to show a satellite — use action focus_satellite with the correct norad_id.
If they ask to speed up/slow down — set_time_speed.
If they ask about count — use set_satellite_count.
If they ask about links — toggle_links and/or set_comm_range.
If they ask about orbit — toggle_orbits and/or set_orbit_altitude.
"""

LANG_INSTRUCTIONS = {
    "ru": "Всегда отвечай на русском языке.",
    "en": "Always respond in English.",
}


def _build_system_prompt(lang: str = "ru") -> str:
    instruction = LANG_INSTRUCTIONS.get(lang, LANG_INSTRUCTIONS["ru"])
    return SYSTEM_PROMPT_BASE.format(lang_instruction=instruction)


async def ask_starai(
    user_message: str,
    conversation_history: List[Dict[str, str]] = None,
    lang: str = "ru",
) -> Dict[str, Any]:
    """
    Отправить сообщение StarAI и получить ответ + команды.
    """
    if not ANTHROPIC_API_KEY:
        # Фоллбэк без API-ключа — базовые ответы
        return _fallback_response(user_message, lang)

    messages = []
    if conversation_history:
        messages.extend(conversation_history)
    messages.append({"role": "user", "content": user_message})

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                ANTHROPIC_API_URL,
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": MODEL,
                    "max_tokens": 1024,
                    "system": _build_system_prompt(lang),
                    "messages": messages,
                },
            )
            response.raise_for_status()
            data = response.json()

        # Извлекаем текст ответа
        content = data.get("content", [])
        text = ""
        for block in content:
            if block.get("type") == "text":
                text += block.get("text", "")

        # Парсим JSON из ответа (с поддержкой ```json блоков)
        try:
            parsed = json.loads(text)
            return {
                "message": parsed.get("message", text),
                "actions": parsed.get("actions", []),
            }
        except json.JSONDecodeError:
            # Попытка извлечь JSON из markdown code block
            import re
            json_match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
            if json_match:
                try:
                    parsed = json.loads(json_match.group(1).strip())
                    return {
                        "message": parsed.get("message", text),
                        "actions": parsed.get("actions", []),
                    }
                except json.JSONDecodeError:
                    pass
            # Попытка найти JSON объект в тексте
            json_obj_match = re.search(r'\{[\s\S]*"message"[\s\S]*\}', text)
            if json_obj_match:
                try:
                    parsed = json.loads(json_obj_match.group(0))
                    return {
                        "message": parsed.get("message", text),
                        "actions": parsed.get("actions", []),
                    }
                except json.JSONDecodeError:
                    pass
            return {"message": text, "actions": []}

    except Exception:
        # Логируем подробности ошибки на сервере, не раскрывая их пользователю
        logging.exception("Ошибка соединения с StarAI")
        return {
            "message": (
                "StarAI connection error. Working in offline mode."
                if lang == "en" else
                "Ошибка соединения с StarAI. Работаю в офлайн-режиме."
            ),
            "actions": [],
        }


def _fallback_response(user_message: str, lang: str = "ru") -> Dict[str, Any]:
    """Офлайн-ответы без API-ключа — расширенный набор команд."""
    msg_lower = user_message.lower().strip()
    en = lang == "en"

    import re

    # ── Приветствия ──────────────────────────────────────
    if any(w in msg_lower for w in ["привет", "здравствуй", "хай", "hello", "добрый", "здрасте", "hi "]):
        return {
            "message": (
                "Hello! ✦ I am StarAI — the intelligent assistant of StarVision. "
                "I can tell you about satellites, control the visualization, "
                "explain orbital mechanics and much more. Ask away!"
                if en else
                "Привет! ✦ Я StarAI — интеллектуальный ассистент StarVision. "
                "Могу рассказать о спутниках, управлять визуализацией, "
                "объяснить орбитальную механику и многое другое. Спрашивай!"
            ),
            "actions": [],
        }

    # ── Программа Сфера ──────────────────────────────────
    if any(w in msg_lower for w in ["сфера", "скиф", "марафон", "sfera", "marathon"]):
        if any(w in msg_lower for w in ["марафон", "marathon"]):
            return {
                "message": (
                    "Marathon-IoT is a subsystem of the Sfera program for the Internet of Things (IoT/M2M). "
                    "6U-format satellites provide data transmission from sensors, meters and industrial devices. "
                    "Our model includes two spacecraft: Marathon-IoT-1 and Marathon-IoT-2. Showing the first one."
                    if en else
                    "«Марафон-IoT» — подсистема программы «Сфера» для Интернета вещей (IoT/M2M). "
                    "Спутники формата 6U обеспечивают передачу данных от датчиков, "
                    "счётчиков и промышленных устройств. В нашей модели два аппарата: "
                    "Марафон-IoT-1 и Марафон-IoT-2. Показываю первый."
                ),
                "actions": [{"type": "focus_satellite", "norad_id": 56201}],
            }
        return {
            "message": (
                "The Sfera program is an ambitious Russian multi-functional satellite constellation project. "
                "It includes subsystems:\n"
                "• Skif — broadband internet (Starlink analogue)\n"
                "• Marathon — IoT/M2M communications\n"
                "• Express-RV — relay\n"
                "Skif-D is a demonstration spacecraft launched in 2022 into ~550 km orbit. "
                "Showing the Sfera constellation."
                if en else
                "Программа «Сфера» — амбициозный российский проект многофункциональной "
                "спутниковой группировки. Включает подсистемы:\n"
                "• «Скиф» — широкополосный интернет (аналог Starlink)\n"
                "• «Марафон» — IoT/M2M связь\n"
                "• «Экспресс-РВ» — ретрансляция\n"
                "Скиф-Д — демонстрационный аппарат, запущенный в 2022 году на орбиту ~550 км. "
                "Показываю группировку «Сфера»."
            ),
            "actions": [
                {"type": "highlight_constellation", "name": "Сфера"},
                {"type": "focus_satellite", "norad_id": 56200},
            ],
        }

    # ── Гонец ────────────────────────────────────────────
    if any(w in msg_lower for w in ["гонец", "gonets"]):
        return {
            "message": (
                "Gonets-M is a Russian low-orbit personal satellite communication system. "
                "It provides short message and data transmission anywhere in the world, including the Arctic. "
                "Orbit inclination ~82.5° ensures polar coverage. "
                "Our model includes 3 spacecraft: #21, #22, #23. Showing the constellation."
                if en else
                "«Гонец-М» — российская низкоорбитальная система персональной "
                "спутниковой связи. Обеспечивает передачу коротких сообщений "
                "и данных в любой точке мира, включая Арктику. "
                "Орбита ~82.5°, что обеспечивает полярное покрытие. "
                "В нашей модели 3 аппарата: №21, №22, №23. Показываю группировку."
            ),
            "actions": [{"type": "highlight_constellation", "name": "Гонец"}],
        }

    # ── Образовательные / Сириус ─────────────────────────
    if any(w in msg_lower for w in ["сириус", "образовани", "школьник", "наноспутник", "sirius", "educational", "nanosatellite"]):
        return {
            "message": (
                "SiriusSat — two 1U nanosatellites (10×10×10 cm, ~1.5 kg), "
                "created by students of the Sirius center together with RSC Energia. "
                "Launched in 2018 from the ISS for radiation monitoring "
                "and cosmic ray research. Showing SiriusSat-1."
                if en else
                "СириусСат — два наноспутника формата 1U (10×10×10 см, ~1.5 кг), "
                "созданные школьниками центра «Сириус» совместно с РКК «Энергия». "
                "Запущены в 2018 году с МКС для мониторинга радиационной обстановки "
                "и изучения космических лучей. Показываю СириусСат-1."
            ),
            "actions": [
                {"type": "highlight_constellation", "name": "Образовательные"},
                {"type": "focus_satellite", "norad_id": 44394},
            ],
        }

    # ── МФТИ / Декарт ────────────────────────────────────
    if any(w in msg_lower for w in ["мфти", "декарт", "физтех", "mipt", "dekart"]):
        return {
            "message": (
                "Dekart is a 12U satellite by MIPT (mass ~50 kg). "
                "Designed for scientific experiments and Earth remote sensing. "
                "Launched in 2021. Showing."
                if en else
                "«Декарт» — спутник МФТИ формата 12U (масса ~50 кг). "
                "Предназначен для научных экспериментов и дистанционного "
                "зондирования Земли. Запущен в 2021 году. Показываю."
            ),
            "actions": [{"type": "focus_satellite", "norad_id": 49260}],
        }

    # ── Баумана / УмКА ───────────────────────────────────
    if any(w in msg_lower for w in ["бауман", "умка", "мгту", "bauman", "umka"]):
        return {
            "message": (
                "UmKA-1 is a 3U cubesat (~3 kg), developed by Bauman MSTU students. "
                "A technology demonstrator launched in 2021. Showing."
                if en else
                "УмКА-1 — кубсат формата 3U (~3 кг), разработанный "
                "студентами МГТУ им. Баумана. Технологический демонстратор, "
                "запущенный в 2021 году. Показываю."
            ),
            "actions": [{"type": "focus_satellite", "norad_id": 47951}],
        }

    # ── ДЗЗ / Зоркий / Беркут ───────────────────────────
    if any(w in msg_lower for w in ["зоркий", "дзз", "зондирован", "съёмк", "беркут", "спутникс", "zorkiy", "berkut", "earth observation"]):
        if any(w in msg_lower for w in ["беркут", "berkut"]):
            return {
                "message": (
                    "Berkut-S is a very high resolution satellite for cartography "
                    "and monitoring. Mass ~200 kg. Launched in 2023."
                    if en else
                    "«Беркут-С» — спутник сверхвысокого разрешения для картографии "
                    "и мониторинга. Масса ~200 кг. Запущен в 2023 году."
                ),
                "actions": [{"type": "focus_satellite", "norad_id": 55120}],
            }
        return {
            "message": (
                "Earth Observation satellites in our model:\n"
                "• Zorkiy-2M (Sputnix) — commercial EO satellite, ~130 kg\n"
                "• Berkut-S — high-detail imaging, ~200 kg\n"
                "Showing EO group."
                if en else
                "Спутники ДЗЗ (дистанционного зондирования Земли) в нашей модели:\n"
                "• Зоркий-2М (Спутникс) — коммерческий спутник ДЗЗ, ~130 кг\n"
                "• Беркут-С — высокодетальная съёмка, ~200 кг\n"
                "Показываю группу ДЗЗ."
            ),
            "actions": [{"type": "highlight_constellation", "name": "ДЗЗ"}],
        }

    # ── Аист / Научные ───────────────────────────────────
    if any(w in msg_lower for w in ["аист", "научн", "прогресс", "самар", "aist", "scientific"]):
        return {
            "message": (
                "Aist-2T is a small spacecraft (~530 kg), developed by RSC Progress "
                "together with SSAU (Samara). Designed for scientific experiments and EO. Showing."
                if en else
                "«Аист-2Т» — малый космический аппарат (~530 кг), "
                "разработанный РКЦ «Прогресс» совместно с СГАУ (Самара). "
                "Предназначен для научных экспериментов и ДЗЗ. Показываю."
            ),
            "actions": [{"type": "focus_satellite", "norad_id": 55121}],
        }

    # ── Управление скоростью ─────────────────────────────
    if any(w in msg_lower for w in ["ускор", "быстр", "speed up", "faster"]):
        # Попытка извлечь число
        nums = re.findall(r'\d+', msg_lower)
        speed = int(nums[0]) if nums else 50
        speed = min(200, max(1, speed))
        return {
            "message": (
                f"Speeding up simulation to {speed}×! Satellites will move faster."
                if en else
                f"Ускоряю симуляцию в {speed}× раз! Спутники будут двигаться быстрее."
            ),
            "actions": [{"type": "set_time_speed", "speed": speed}],
        }

    if any(w in msg_lower for w in ["замедл", "стоп", "пауз", "остано", "медленн", "реальн", "slow", "stop", "pause", "real time"]):
        return {
            "message": (
                "Returning to real time (1×)."
                if en else
                "Возвращаю реальное время (1×)."
            ),
            "actions": [{"type": "set_time_speed", "speed": 1}],
        }

    if any(w in msg_lower for w in ["врем", "скорость", "time", "speed"]) and not any(w in msg_lower for w in ["сколько", "какой", "какая", "how many", "what"]):
        nums = re.findall(r'\d+', msg_lower)
        if nums:
            speed = min(200, max(1, int(nums[0])))
            return {
                "message": (
                    f"Setting simulation speed: {speed}×"
                    if en else
                    f"Устанавливаю скорость симуляции: {speed}×"
                ),
                "actions": [{"type": "set_time_speed", "speed": speed}],
            }

    # ── Орбиты ───────────────────────────────────────────
    if any(w in msg_lower for w in ["орбит", "трек", "траектор", "orbit", "track", "trajectory"]):
        if any(w in msg_lower for w in ["скры", "убери", "выключ", "спряч", "hide", "off", "disable"]):
            return {
                "message": "Hiding orbital tracks." if en else "Скрываю орбитальные треки.",
                "actions": [{"type": "toggle_orbits", "visible": False}],
            }
        return {
            "message": (
                "Enabling orbital track display. Each line shows the satellite path for one orbit."
                if en else
                "Включаю отображение орбитальных треков. "
                "Каждая линия показывает путь спутника за один виток."
            ),
            "actions": [{"type": "toggle_orbits", "visible": True}],
        }

    # ── Линии связи ──────────────────────────────────────
    if any(w in msg_lower for w in ["связ", "линии", "мсс", "isl", "link"]):
        if any(w in msg_lower for w in ["скры", "убери", "выключ", "спряч", "hide", "off", "disable"]):
            return {
                "message": "Hiding inter-satellite links." if en else "Скрываю линии межспутниковой связи.",
                "actions": [{"type": "toggle_links", "visible": False}],
            }
        if any(w in msg_lower for w in ["покаж", "включ", "отобраз", "show", "on", "enable", "display"]):
            return {
                "message": (
                    "Enabling inter-satellite links. Green lines — active connections "
                    "within communication range. Red — satellites almost in range."
                    if en else
                    "Включаю линии межспутниковой связи. Зелёные линии — активные соединения "
                    "в пределах дальности связи. Красные — спутники почти в зоне видимости."
                ),
                "actions": [{"type": "toggle_links", "visible": True}],
            }
        # Информационный ответ про связи
        return {
            "message": (
                "Inter-satellite link (ISL) is data transmission between satellites "
                "without ground station relay. In StarVision we model ISL considering:\n"
                "• Distance between satellites (communication range threshold)\n"
                "• Line of sight (link must not intersect Earth)\n"
                "Green lines — active links, red — potential."
                if en else
                "Межспутниковая связь (ISL) — это передача данных между спутниками "
                "без ретрансляции через наземные станции. В StarVision мы моделируем ISL "
                "с учётом:\n"
                "• Расстояния между спутниками (порог дальности связи)\n"
                "• Прямой видимости (линия связи не должна пересекать Землю)\n"
                "Зелёные линии — активные связи, красные — потенциальные."
            ),
            "actions": [{"type": "toggle_links", "visible": True}],
        }

    # ── Количество спутников ─────────────────────────────
    if any(w in msg_lower for w in ["количеств", "сколько спут", "число спут", "добав", "установи", "how many sat", "satellite count", "set satellite", "add satellite"]):
        nums = re.findall(r'\d+', msg_lower)
        if nums:
            count = min(15, max(3, int(nums[0])))
            return {
                "message": (
                    f"Setting {count} satellites in the constellation."
                    if en else
                    f"Устанавливаю {count} спутников в группировке."
                ),
                "actions": [{"type": "set_satellite_count", "count": count}],
            }
        return {
            "message": (
                "Currently the model displays up to 15 real Russian satellites. "
                "You can change the count from 3 to 15 via the slider or tell me, "
                "e.g.: 'Set 10 satellites'."
                if en else
                "Сейчас в модели отображается до 15 реальных российских спутников. "
                "Ты можешь изменить количество от 3 до 15 через ползунок или сказать мне, "
                "например: «Установи 10 спутников»."
            ),
            "actions": [],
        }

    # ── Дальность связи ──────────────────────────────────
    if any(w in msg_lower for w in ["дальност", "радиус связ", "зона связ", "comm range", "communication range"]):
        nums = re.findall(r'\d+', msg_lower)
        if nums:
            rng = min(2000, max(50, int(nums[0])))
            return {
                "message": (
                    f"Setting communication range: {rng} km. "
                    "Links will be displayed between satellites "
                    "within this distance threshold."
                    if en else
                    f"Устанавливаю дальность связи: {rng} км. "
                    "Линии связи будут отображаться между спутниками, "
                    "расстояние между которыми не превышает этот порог."
                ),
                "actions": [{"type": "set_comm_range", "range_km": rng}],
            }
        return {
            "message": (
                "Communication range defines the maximum distance between satellites "
                "for establishing a connection. Typical values: 500–1500 km for LEO."
                if en else
                "Дальность связи определяет максимальное расстояние между спутниками "
                "для установления соединения. Типичные значения: 500–1500 км для LEO."
            ),
            "actions": [],
        }

    # ── Высота орбиты ────────────────────────────────────
    if any(w in msg_lower for w in ["высот", "altitude"]):
        nums = re.findall(r'\d+', msg_lower)
        if nums:
            alt = min(2000, max(0, int(nums[0])))
            if alt == 0:
                return {
                    "message": (
                        "Switching to real TLE satellite orbits."
                        if en else
                        "Переключаюсь на реальные TLE-орбиты спутников."
                    ),
                    "actions": [{"type": "set_orbit_altitude", "altitude_km": 0}],
                }
            return {
                "message": (
                    f"Setting virtual circular orbit altitude: {alt} km. "
                    "All satellites will be evenly distributed at this altitude."
                    if en else
                    f"Устанавливаю высоту виртуальной круговой орбиты: {alt} км. "
                    "Все спутники будут равномерно распределены на этой высоте."
                ),
                "actions": [{"type": "set_orbit_altitude", "altitude_km": alt}],
            }

    # ── Показать спутник по имени ────────────────────────
    if any(w in msg_lower for w in ["покаж", "найди", "где ", "фокус", "show", "find", "where", "focus"]):
        sat_map = {
            "скиф": 56200, "skif": 56200,
            "марафон-1": 56201, "marathon-1": 56201,
            "марафон-2": 56202, "marathon-2": 56202,
            "марафон-3": 56203, "marathon-3": 56203,
            "сириус-1": 44394, "сириуссат-1": 44394, "sirius-1": 44394, "siriussat-1": 44394,
            "сириус-2": 44395, "sirius-2": 44395,
            "танюша": 44396, "tanyusha": 44396,
            "декарт": 49260, "dekart": 49260,
            "умка": 47951, "umka": 47951,
            "гонец-21": 40553, "gonets-21": 40553,
            "гонец-22": 40554, "gonets-22": 40554,
            "гонец-23": 40555, "gonets-23": 40555,
            "зоркий": 48850, "zorkiy": 48850,
            "беркут": 55120, "berkut": 55120,
            "аист": 55121, "aist": 55121,
        }
        for name, nid in sat_map.items():
            if name in msg_lower:
                return {
                    "message": "Focusing camera on satellite." if en else "Навожу камеру на спутник.",
                    "actions": [{"type": "focus_satellite", "norad_id": nid}],
                }

    # ── Сброс ────────────────────────────────────────────
    if any(w in msg_lower for w in ["сброс", "reset", "начал", "по умолч", "верн", "default"]):
        return {
            "message": (
                "Resetting all parameters to default values."
                if en else
                "Сбрасываю все параметры к начальным значениям."
            ),
            "actions": [{"type": "reset_view"}],
        }

    # ── Кеплер / орбитальная механика ────────────────────
    if any(w in msg_lower for w in ["кеплер", "механик", "физик", "гравитац", "закон", "kepler", "mechanic", "physic", "gravit", "law"]):
        return {
            "message": (
                "Orbital mechanics is based on Kepler's laws:\n"
                "1. Orbits are ellipses with the center of mass at one focus\n"
                "2. The radius vector sweeps equal areas in equal time\n"
                "3. T² ∝ a³ (period² is proportional to semi-major axis³)\n\n"
                "In StarVision we use the SGP4 model for precise satellite position calculation "
                "accounting for atmospheric drag, J2 gravitational harmonics and other perturbations."
                if en else
                "Орбитальная механика основана на законах Кеплера:\n"
                "1. Орбиты — эллипсы с центром масс в фокусе\n"
                "2. Радиус-вектор заметает равные площади за равное время\n"
                "3. T² ∝ a³ (период² пропорционален полуоси³)\n\n"
                "В StarVision мы используем модель SGP4 для точного расчёта "
                "позиций спутников с учётом атмосферного торможения, "
                "гравитационных гармоник J2 и других возмущений."
            ),
            "actions": [],
        }

    # ── Starlink / OneWeb / сравнение ────────────────────
    if any(w in msg_lower for w in ["starlink", "oneweb", "сравн", "илон", "маск", "compar", "elon", "musk"]):
        return {
            "message": (
                "Comparison of major constellations:\n"
                "• Starlink (SpaceX): ~5000+ satellites, 550 km, broadband\n"
                "• OneWeb: ~600 satellites, 1200 km, broadband\n"
                "• Sfera (Russia): planned 600+ S/C, comms + IoT + EO\n"
                "• Gonets-M: ~12 satellites, 1500 km, personal comms\n\n"
                "Russian constellations focus on polar coverage "
                "and multi-purpose design (comms + IoT + observation)."
                if en else
                "Сравнение крупнейших группировок:\n"
                "• Starlink (SpaceX): ~5000+ спутников, 550 км, ШПД\n"
                "• OneWeb: ~600 спутников, 1200 км, ШПД\n"
                "• Сфера (Россия): планируется 600+ КА, связь + IoT + ДЗЗ\n"
                "• Гонец-М: ~12 спутников, 1500 км, персональная связь\n\n"
                "Российские группировки отличаются акцентом на полярное покрытие "
                "и комплексность (связь + IoT + наблюдение)."
            ),
            "actions": [],
        }

    # ── TLE / SGP4 ───────────────────────────────────────
    if any(w in msg_lower for w in ["tle", "sgp4", "двухстрочн", "элемент", "two-line", "element"]):
        return {
            "message": (
                "TLE (Two-Line Elements) is a standard orbital element format including:\n"
                "• Inclination, RAAN, eccentricity\n"
                "• Argument of perigee, mean anomaly\n"
                "• Mean motion (revolutions/day)\n\n"
                "SGP4 is an analytical propagation model that accounts for "
                "J2 perturbations, atmospheric drag and other effects. "
                "We use it for real-time position calculation."
                if en else
                "TLE (Two-Line Elements) — двухстрочные элементы орбиты. "
                "Это стандартный формат описания орбиты, включающий:\n"
                "• Наклонение, RAAN, эксцентриситет\n"
                "• Аргумент перигея, средняя аномалия\n"
                "• Среднее движение (обороты/сутки)\n\n"
                "SGP4 — аналитическая модель распространения, которая учитывает "
                "возмущения J2, атмосферное торможение и другие эффекты. "
                "Мы используем её для расчёта позиций в реальном времени."
            ),
            "actions": [],
        }

    # ── Кубсат / формфактор ──────────────────────────────
    if any(w in msg_lower for w in ["кубсат", "cubesat", "формфактор", "форм-фактор", "размер", "form factor", "size"]):
        return {
            "message": (
                "CubeSat — small satellite standard:\n"
                "• 1U: 10×10×10 cm, ~1.3 kg (SiriusSat)\n"
                "• 3U: 10×10×30 cm, ~4 kg (UmKA-1)\n"
                "• 6U: 10×20×30 cm, ~12 kg (Marathon-IoT)\n"
                "• 12U: 20×20×30 cm, ~24 kg (Dekart)\n\n"
                "Standardization reduces launch costs and enables "
                "use of unified deployers."
                if en else
                "CubeSat — стандарт малых спутников:\n"
                "• 1U: 10×10×10 см, ~1.3 кг (СириусСат)\n"
                "• 3U: 10×10×30 см, ~4 кг (УмКА-1)\n"
                "• 6U: 10×20×30 см, ~12 кг (Марафон-IoT)\n"
                "• 12U: 20×20×30 см, ~24 кг (Декарт)\n\n"
                "Стандартизация позволяет удешевить запуск и использовать "
                "унифицированные пусковые контейнеры."
            ),
            "actions": [],
        }

    # ── Помощь ───────────────────────────────────────────
    if any(w in msg_lower for w in ["помощ", "help", "команд", "что ты умеешь", "что можешь", "возможност", "what can you", "capabilities"]):
        return {
            "message": (
                "Here's what I can do:\n"
                "✦ Tell about satellites: 'Tell me about Sfera', 'What is Gonets?'\n"
                "✦ Show a satellite: 'Show Skif-D', 'Where is Dekart?'\n"
                "✦ Control speed: 'Speed up 50x', 'Slow down'\n"
                "✦ Control links: 'Show links', 'Set range 1000 km'\n"
                "✦ Change orbits: 'Altitude 600 km', 'Set 10 satellites'\n"
                "✦ Explain mechanics: 'What is SGP4?', 'Kepler's laws'\n"
                "✦ Compare: 'Compare Starlink and Sfera'\n"
                "✦ Reset everything: 'Reset'"
                if en else
                "Вот что я умею:\n"
                "✦ Рассказать о спутниках: «Расскажи про Сферу», «Что такое Гонец?»\n"
                "✦ Показать спутник: «Покажи Скиф-Д», «Где Декарт?»\n"
                "✦ Управлять скоростью: «Ускорь в 50 раз», «Замедли»\n"
                "✦ Управлять связями: «Покажи связи», «Установи дальность 1000 км»\n"
                "✦ Менять орбиты: «Высота 600 км», «Установи 10 спутников»\n"
                "✦ Объяснять механику: «Что такое SGP4?», «Законы Кеплера»\n"
                "✦ Сравнивать: «Сравни Starlink и Сферу»\n"
                "✦ Сбросить всё: «Сброс»"
            ),
            "actions": [],
        }

    # ── Коллизии / столкновения ────────────────────────────
    if any(w in msg_lower for w in ["коллизи", "столкнов", "сближен", "опасност", "collision", "close approach"]):
        return {
            "message": (
                "Collision prediction is an important constellation management task. "
                "StarVision analyzes all satellite trajectories 24 hours ahead "
                "and identifies potential close approaches (threshold: 100 km).\n\n"
                "Main prevention methods:\n"
                "• NORAD / 18th Space Defense Squadron catalog monitoring\n"
                "• Avoidance maneuvers at P(collision) > 10⁻⁴\n"
                "• Walker distribution minimizes risk within the constellation\n\n"
                "Use API: /api/collisions for predictions."
                if en else
                "Прогнозирование коллизий — важная задача управления группировкой. "
                "StarVision анализирует траектории всех спутников на 24 часа вперёд "
                "и выявляет потенциальные сближения (порог: 100 км).\n\n"
                "Основные методы предотвращения:\n"
                "• Мониторинг каталога NORAD / 18-й эскадрильи ВКС США\n"
                "• Манёвры уклонения при P(collision) > 10⁻⁴\n"
                "• Walker-распределение минимизирует риск внутри группировки\n\n"
                "Используйте API: /api/collisions для получения прогноза."
            ),
            "actions": [],
        }

    # ── Оптимизация плоскостей ──────────────────────────
    if any(w in msg_lower for w in ["оптимиз", "walker", "распредел", "плоскост", "optimiz", "plane", "distribut"]):
        return {
            "message": (
                "Orbital plane distribution optimization uses "
                "the Walker-δ constellation model (T/P/F):\n\n"
                "• T — total number of satellites\n"
                "• P — number of orbital planes\n"
                "• F — phase factor (inter-plane shift)\n\n"
                "Optimal distribution provides:\n"
                "✦ Maximum Earth surface coverage\n"
                "✦ Minimum communication gaps\n"
                "✦ Uniform ISL channel load\n\n"
                "Use the 'Orbital planes' slider in the control panel "
                "or API: /api/optimize-planes."
                if en else
                "Оптимизация распределения по орбитальным плоскостям использует "
                "модель Walker-δ constellation (T/P/F):\n\n"
                "• T — общее число спутников\n"
                "• P — число орбитальных плоскостей\n"
                "• F — фазовый фактор (межплоскостный сдвиг)\n\n"
                "Оптимальное распределение обеспечивает:\n"
                "✦ Максимальное покрытие поверхности Земли\n"
                "✦ Минимальные перерывы в связи\n"
                "✦ Равномерную нагрузку на каналы ISL\n\n"
                "Используйте ползунок «Орбитальные плоскости» в панели управления "
                "или API: /api/optimize-planes."
            ),
            "actions": [],
        }

    # ── Космос / общие вопросы ───────────────────────────
    if any(w in msg_lower for w in ["космос", "мкс", "ракет", "запуск", "space", "iss", "rocket", "launch"]):
        return {
            "message": (
                "Small satellite launches are typically carried out as secondary payloads "
                "on Soyuz-2, Falcon 9, or specialized cubesat launchers. "
                "From the ISS, satellites are deployed through the Kibo module (JAXA) airlock. "
                "Russia is also developing the Sputnix platform "
                "for serial small spacecraft production."
                if en else
                "Космические запуски малых спутников обычно осуществляются как попутная "
                "нагрузка на ракетах-носителях «Союз-2», Falcon 9 или специализированных "
                "носителях для кубсатов. С МКС спутники выводятся через шлюзовую камеру "
                "модуля Kibo (JAXA). Россия также развивает платформу «Спутникс» "
                "для серийного производства малых КА."
            ),
            "actions": [],
        }

    # ── Благодарность ────────────────────────────────────
    if any(w in msg_lower for w in ["спасибо", "благодар", "круто", "класс", "отлично", "thanks", "thank you", "great", "awesome"]):
        return {
            "message": (
                "Glad to help! ✦ If you have more questions about satellites or visualization — "
                "just ask. I'm always online!"
                if en else
                "Рад помочь! ✦ Если есть ещё вопросы о спутниках или визуализации — "
                "спрашивай. Я всегда на связи!"
            ),
            "actions": [],
        }

    # ── Общий ответ ──────────────────────────────────────
    return {
        "message": (
            "I am StarAI — StarVision's intelligent assistant. Here's what I can do:\n"
            "✦ Tell about any satellite in the constellation\n"
            "✦ Show a satellite in the visualization\n"
            "✦ Control speed, orbits and links\n"
            "✦ Explain orbital mechanics and TLE\n\n"
            "Try: 'Tell me about Sfera', 'Show Gonets', "
            "'Speed up 50x' or 'What is a cubesat?'"
            if en else
            "Я StarAI — интеллектуальный ассистент StarVision. Вот что я могу:\n"
            "✦ Рассказать о любом спутнике в группировке\n"
            "✦ Показать спутник на визуализации\n"
            "✦ Управлять скоростью, орбитами и связями\n"
            "✦ Объяснить орбитальную механику и TLE\n\n"
            "Попробуй: «Расскажи про Сферу», «Покажи Гонец», "
            "«Ускорь в 50 раз» или «Что такое кубсат?»"
        ),
        "actions": [],
    }
