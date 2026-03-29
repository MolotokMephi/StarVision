# ⭐ StarGrid — Цифровой двойник группировки российских кубсатов

> **Национальный центр космических компетенций (НЦКК)**
> Задача: Цифровые двойники космических систем — Группировка кубсатов

---

## 🌐 Функциональность

- **14 российских КА** в 3D: Сфера, Гонец, СириусСат, Декарт, УмКА, Зоркий, Беркут, Аист
- **Клиентская SGP4-пропагация** через `satellite.js` — плавная покадровая анимация без задержек сети
- **Межспутниковые линии связи (МСС/ISL)** — расчёт на каждом кадре, LOS-проверка, зелёные/красные линии
- **NASA Blue Marble текстура** Земли с Suspense-fallback
- **2 типа 3D-моделей КА**: 1U CubeSat (2 панели) и 3U CubeSat (4 панели), процедурные Three.js
- **Плавная анимация камеры** (lerp) к выбранному спутнику
- **StarAI** — встроенный ИИ-ассистент на Anthropic Claude API с управлением интерфейсом
- **Управление орбитами**: ползунок высоты генерирует виртуальную Walker-группировку

---

## 🏗 Архитектура

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React 18)                       │
│                                                                   │
│  ┌──────────┐  ┌──────────────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Scene3D  │  │ InterSatellite   │  │ Control  │  │ StarAI   │  │
│  │ (R3F)    │  │ Links (ISL)      │  │ Panel    │  │ Chat     │  │
│  └────┬─────┘  └────────┬─────────┘  └────┬─────┘  └────┬─────┘  │
│       │                 │                  │              │        │
│  ┌────▼─────────────────▼──────────────────▼──────────────▼─────┐ │
│  │                        Zustand Store                          │ │
│  │  timeSpeed · satelliteCount · orbitAltitudeKm · commRangeKm  │ │
│  │  showLinks · activeLinksCount · tleData · positions           │ │
│  └────────────────────────────┬──────────────────────────────────┘ │
│                                │ REST API (позиции, TLE, орбиты)   │
├────────────────────────────────┼───────────────────────────────────┤
│                       BACKEND (FastAPI)                            │
│                                                                    │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐  │
│  │ orbital.py   │  │ satellites.py │  │ /api/links (ISL + LOS) │  │
│  │ SGP4 python  │  │ каталог 14 КА │  │ ai_assistant.py        │  │
│  └──────────────┘  └───────────────┘  └────────────────────────┘  │
└────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Быстрый старт

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Linux/Mac
# venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env           # Добавить ANTHROPIC_API_KEY для StarAI
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # → http://localhost:3000
```

Фронтенд автоматически проксирует `/api/*` на `localhost:8000`.

---

## 📡 Спутники в системе

| Группировка | Спутники | Назначение | Модель КА |
|---|---|---|---|
| **Сфера** | Скиф-Д, Марафон-IoT-1/2 | Интернет, IoT | 3U |
| **Гонец** | Гонец-М №21/22/23 | Персональная спутниковая связь | 3U |
| **Образовательные** | СириусСат-1/2, УмКА-1 | Наука, обучение | 1U |
| **МФТИ** | Декарт | Эксперименты МФТИ | 1U |
| **МГТУ им. Баумана** | (группировка) | Образовательные проекты | 1U |
| **ДЗЗ** | Зоркий-2М, Беркут-С | Дистанционное зондирование | 3U |
| **Научные** | Аист-2Т | Научные эксперименты | 1U |

---

## 🎮 Параметры управления

| Параметр | Диапазон | Описание |
|---|---|---|
| Количество КА | 3 – 15 | Равномерный выбор из каталога по орбитальным плоскостям |
| Высота орбиты | 0 – 2000 км | 0 = реальные TLE; >0 = виртуальная Walker-группировка |
| Дальность связи | 50 – 2000 км | Порог отображения линий МСС |
| Скорость симуляции | 1× – 200× | Ускорение времени |
| Линии связи (МСС) | вкл/выкл | Показать/скрыть межспутниковые линии |
| Орбитальные треки | вкл/выкл | Показать/скрыть трассы орбит |
| Подписи спутников | вкл/выкл | |
| Фильтр группировок | 7 кнопок | Выборочное отображение по группировкам |

---

## 📁 Структура проекта

```
StarVision/
├── backend/
│   ├── main.py               # FastAPI + все эндпоинты (/api/links, /api/positions, …)
│   ├── satellites.py         # Каталог 14 российских КА + TLE
│   ├── orbital.py            # SGP4-пропагация (python-sgp4), ECI→геодезика
│   ├── ai_assistant.py       # StarAI — Anthropic Claude API + офлайн-фоллбэк
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   └── src/
│       ├── components/
│       │   ├── Scene3D.tsx            # Canvas (R3F), CameraController (lerp)
│       │   ├── Earth.tsx              # NASA Blue Marble TextureLoader + fallback
│       │   ├── Satellites.tsx         # SGP4 (satellite.js), 2 модели КА, Walker-орбиты
│       │   ├── InterSatelliteLinks.tsx # МСС per-frame, LOS-check, зел/кр линии
│       │   ├── ControlPanel.tsx       # Все ползунки и тоглы
│       │   ├── Header.tsx             # UTC, КА, Скорость, МСС-счётчик
│       │   ├── SatelliteInfoPanel.tsx # Телеметрия выбранного КА
│       │   └── StarAIChat.tsx         # ИИ-ассистент
│       ├── hooks/useStore.ts          # Zustand state
│       ├── services/api.ts            # REST API-клиент
│       └── types.ts
├── ROADMAP.md
└── README.md
```

---

## 🔧 Технологии

| Компонент | Технология | Версия |
|---|---|---|
| Frontend | React + TypeScript | 18 / 5 |
| 3D Engine | Three.js / React Three Fiber | 0.164 / 8 |
| Клиентская орбитальная механика | satellite.js | 5.0 |
| UI | Tailwind CSS | 3.4 |
| State | Zustand | 4.5 |
| Backend | Python FastAPI | 0.115 |
| Серверная орбитальная механика | python-sgp4 | 2.23 |
| ИИ-ассистент | Anthropic Claude API (Sonnet) | — |
| Bundler | Vite | 5.2 |

---

## 🌍 API эндпоинты

| Метод | URL | Описание |
|---|---|---|
| GET | `/api/satellites` | Список всех 14 КА с метаданными |
| GET | `/api/positions` | Текущие ECI-координаты всех КА |
| GET | `/api/tle` | TLE-данные для клиентской SGP4 |
| GET | `/api/orbit/{norad_id}` | Орбитальный трек (120 точек) |
| GET | `/api/links?comm_range_km=500` | Межспутниковые связи с LOS-проверкой |
| GET | `/api/orbital-elements/{norad_id}` | Кеплеровы элементы орбиты |
| POST | `/api/starai/chat` | StarAI — чат с управлением интерфейсом |
| GET | `/api/config` | Начальная конфигурация фронтенда |

---

## 📚 Источники данных

### TLE (Two-Line Element) орбитальные данные
- **CelesTrak** — https://celestrak.org — актуальные TLE для российских КА
  - Гонец-М: NORAD IDs 40553, 40554, 40555 | Аист-2Т: 55121 | Зоркий-2М: 48850 | Беркут-С: 55120
- **Space-Track.org** — https://www.space-track.org — официальная БД US Space Force
- **Roscosmos** — https://www.roscosmos.ru — информация о российских группировках

### Орбитальная механика
- **SGP4 модель** — Hoots & Roehrich (1980); реализации: `python-sgp4` v2.23 (MIT) и `satellite.js` v5.0 (MIT)
- Документация: [Revisiting Spacetrack Report #3](https://celestrak.org/publications/AIAA/2006-6753/)

### Текстуры Земли
- **NASA Blue Marble** «World, April 2004» — NASA Earth Observatory / EOSDIS
  - Авторы: Reto Stöckli et al., NASA Goddard Space Flight Center
  - URL: https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74393/
  - Лицензия: открытые данные NASA (некоммерческое использование разрешено)

### 3D-модели спутников
- **Собственные процедурные модели** на Three.js (BoxGeometry + PlaneGeometry)
  - 1U CubeSat: корпус 10×10×10 мм + 2 солнечных панели
  - 3U CubeSat: корпус 10×30×10 мм + 4 солнечных панели в двух ярусах
- **Спецификация**: CubeSat Design Specification Rev. 14 — https://www.cubesat.org/

### Открытые библиотеки (все MIT License)
- Three.js — https://threejs.org | React Three Fiber — https://r3f.docs.pmnd.rs
- satellite.js — https://github.com/shashwatak/satellite-js
- Tailwind CSS — https://tailwindcss.com | Zustand — https://github.com/pmndrs/zustand
- FastAPI — https://fastapi.tiangolo.com | Anthropic SDK — https://github.com/anthropics/anthropic-sdk-python
