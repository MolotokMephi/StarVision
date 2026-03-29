"""
ai_assistant.py — StarAI: ИИ-ассистент, способный отвечать на вопросы
и генерировать команды управления интерфейсом.
"""

import json
import os
from typing import Dict, Any, List, Optional

import httpx

# Anthropic API (через HTTP, без SDK — для простоты)
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
MODEL = "claude-sonnet-4-20250514"

SYSTEM_PROMPT = """Ты — StarAI, интеллектуальный ассистент проекта StarGrid.
Проект StarGrid — цифровой двойник группировки российских кубсатов и малых космических аппаратов.

Твои возможности:
1. Отвечать на вопросы о спутниках, орбитальной механике, космических программах России.
2. Управлять интерфейсом визуализации через специальные команды.

ФОРМАТ ОТВЕТА — строго JSON:
{
  "message": "Текст ответа пользователю (на русском)",
  "actions": [
    // Необязательно. Массив команд для интерфейса:
    // {"type": "focus_satellite", "norad_id": 56200}
    // {"type": "set_time_speed", "speed": 10}
    // {"type": "toggle_orbits", "visible": true}
    // {"type": "set_view", "view": "top" | "side" | "free"}
    // {"type": "highlight_constellation", "name": "Сфера"}
    // {"type": "show_coverage", "norad_id": 56200}
    // {"type": "reset_view"}
  ]
}

Российские спутники в системе:
- Группировка «Сфера»: Скиф-Д (демонстратор интернета), Марафон-IoT-1/2 (IoT)
- Образовательные: СириусСат-1/2 (радиация), Декарт (МФТИ, ДЗЗ), УмКА-1 (МГТУ Баумана)
- Группировка «Гонец»: Гонец-М №21/22/23 (персональная связь)
- ДЗЗ: Зоркий-2М (Спутникс), Беркут-С (высокодетальная съёмка)
- Научные: Аист-2Т (РКЦ «Прогресс»)

Всегда отвечай на русском языке. Будь дружелюбным и информативным.
Если пользователь просит показать спутник — используй action focus_satellite.
Если просит ускорить/замедлить — set_time_speed.
"""


async def ask_starai(
    user_message: str,
    conversation_history: List[Dict[str, str]] = None
) -> Dict[str, Any]:
    """
    Отправить сообщение StarAI и получить ответ + команды.
    """
    if not ANTHROPIC_API_KEY:
        # Фоллбэк без API-ключа — базовые ответы
        return _fallback_response(user_message)

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
                    "system": SYSTEM_PROMPT,
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

        # Парсим JSON из ответа
        try:
            parsed = json.loads(text)
            return {
                "message": parsed.get("message", text),
                "actions": parsed.get("actions", []),
            }
        except json.JSONDecodeError:
            return {"message": text, "actions": []}

    except Exception as e:
        return {
            "message": f"Ошибка соединения с StarAI: {str(e)}. Работаю в офлайн-режиме.",
            "actions": [],
        }


def _fallback_response(user_message: str) -> Dict[str, Any]:
    """Офлайн-ответы без API-ключа."""
    msg_lower = user_message.lower()

    # Простые паттерны
    if any(w in msg_lower for w in ["привет", "здравствуй", "хай", "hello"]):
        return {
            "message": "Привет! Я StarAI — ассистент проекта StarGrid. "
                       "Могу рассказать о спутниках, показать их орбиты "
                       "и управлять визуализацией. Спрашивай!",
            "actions": [],
        }

    if any(w in msg_lower for w in ["сфера", "скиф"]):
        return {
            "message": "Программа «Сфера» — российский проект многофункциональной "
                       "спутниковой группировки. Включает подсистемы «Скиф» (широкополосный "
                       "интернет) и «Марафон» (IoT). Скиф-Д — демонстрационный аппарат, "
                       "запущенный в 2022 году. Показываю его на визуализации.",
            "actions": [{"type": "focus_satellite", "norad_id": 56200}],
        }

    if any(w in msg_lower for w in ["гонец", "связь"]):
        return {
            "message": "«Гонец-М» — российская низкоорбитальная система персональной "
                       "спутниковой связи. Обеспечивает передачу коротких сообщений "
                       "и данных в любой точке мира. Показываю группировку.",
            "actions": [{"type": "highlight_constellation", "name": "Гонец"}],
        }

    if any(w in msg_lower for w in ["сириус", "образовани"]):
        return {
            "message": "СириусСат — два наноспутника формата 1U, созданные школьниками "
                       "центра «Сириус». Запущены в 2018 году с МКС для мониторинга "
                       "радиационной обстановки.",
            "actions": [{"type": "focus_satellite", "norad_id": 44394}],
        }

    if any(w in msg_lower for w in ["ускор", "быстр", "время"]):
        return {
            "message": "Ускоряю симуляцию в 10 раз!",
            "actions": [{"type": "set_time_speed", "speed": 10}],
        }

    if any(w in msg_lower for w in ["замедл", "стоп", "пауз", "остано"]):
        return {
            "message": "Возвращаю реальное время.",
            "actions": [{"type": "set_time_speed", "speed": 1}],
        }

    if any(w in msg_lower for w in ["орбит", "трек", "траектор"]):
        return {
            "message": "Включаю отображение орбитальных треков всех спутников.",
            "actions": [{"type": "toggle_orbits", "visible": True}],
        }

    if any(w in msg_lower for w in ["сброс", "reset", "начал"]):
        return {
            "message": "Сбрасываю вид к начальному состоянию.",
            "actions": [{"type": "reset_view"}],
        }

    # Общий ответ
    return {
        "message": "Я StarAI — ассистент StarGrid. Могу рассказать о любом спутнике "
                   "в группировке, показать его орбиту, ускорить или замедлить время. "
                   "Попробуй спросить: «Расскажи про Сферу» или «Покажи Гонец».",
        "actions": [],
    }
