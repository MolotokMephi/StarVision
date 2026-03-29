# ⭐ StarGrid — Цифровой двойник группировки российских кубсатов

> **Национальный центр космических компетенций**
> Задача: Цифровые двойники космических систем — Группировка кубсатов

---

## 🏗 Архитектура

```
┌──────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Scene3D  │  │ Control  │  │ SatInfo  │  │ StarAI   │  │
│  │ (R3F)    │  │ Panel    │  │ Panel    │  │ Chat     │  │
│  └────┬─────┘  └─────┬────┘  └──────┬───┘  └───────┬──┘  │
│       └──────────────┴──────────────┴──────────────┘     │
│                         Zustand Store                    │
│                           │ REST API                     │
├───────────────────────────┼──────────────────────────────┤
│                     BACKEND (FastAPI)                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐            │
│  │ Orbital  │  │Satellites│  │ AI Assistant │            │
│  │ (SGP4)   │  │ (каталог)│  │              │            │
│  └──────────┘  └──────────┘  └──────────────┘            │
└──────────────────────────────────────────────────────────┘
```

## 🚀 Быстрый старт

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate       # Linux/Mac
# venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env           # Прописать API ключ нейронки
uvicorn main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev                    # → http://localhost:3000
```

Фронтенд автоматически проксирует `/api/*` на `localhost:8000`.

## 📡 Спутники в системе

| Группировка | Спутники | Назначение |
|---|---|---|
| **Сфера** | Скиф-Д, Марафон-IoT-1/2 | Интернет, IoT |
| **Гонец** | Гонец-М №21/22/23 | Персональная связь |
| **Образовательные** | СириусСат-1/2, Декарт, УмКА-1 | Наука, обучение |
| **ДЗЗ** | Зоркий-2М, Беркут-С | Дистанционное зондирование |
| **Научные** | Аист-2Т | Научные эксперименты |

## 📁 Структура проекта

```
stargrid/
├── backend/
│   ├── main.py               # FastAPI приложение
│   ├── satellites.py          # Каталог российских КА
│   ├── orbital.py             # Орбитальная механика (SGP4)
│   ├── ai_assistant.py        # StarAI (Anthropic API)
│   ├── requirements.txt
│   └── .env.example
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Scene3D.tsx    # 3D-сцена (R3F)
│   │   │   ├── Earth.tsx      # Земля с вращением
│   │   │   ├── Satellites.tsx # Спутники и орбиты
│   │   │   ├── ControlPanel.tsx
│   │   │   ├── SatelliteInfoPanel.tsx
│   │   │   ├── StarAIChat.tsx
│   │   │   └── Header.tsx
│   │   ├── hooks/
│   │   │   └── useStore.ts    # Zustand state
│   │   ├── services/
│   │   │   └── api.ts         # API-клиент
│   │   ├── types.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   └── tsconfig.json
└── README.md
```

## 🔧 Технологии

| Компонент | Технология |
|---|---|
| Frontend | React 18 + TypeScript |
| 3D Engine | Three.js / React Three Fiber |
| UI Framework | Tailwind CSS |
| State | Zustand |
| Backend | Python FastAPI |
| Орбитальная механика | SGP4 (python-sgp4) |
| ИИ-ассистент | Anthropic Claude API |
| Bundler | Vite |

## 📚 Источники данных

### TLE (Two-Line Element) орбитальные данные
- **CelesTrak** — https://celestrak.org/SOCRATES/ — актуальные TLE для российских КА
  - Гонец-М: NORAD IDs 40553, 40554, 40555
  - Аист-2Т: NORAD ID 55121
  - Зоркий-2М: NORAD ID 48850
  - Беркут-С: NORAD ID 55120
- **Space-Track.org** — https://www.space-track.org — официальная база данных US Space Force
- **Roscosmos** — https://www.roscosmos.ru — данные о российских группировках

### Орбитальная механика
- **SGP4 модель** — Hoots & Roehrich (1980), реализация: `python-sgp4` v2.23 (MIT License)
- **satellite.js** — https://github.com/shashwatak/satellite-js — клиентская SGP4 для браузера (v5.0, MIT License)
- **WGS72 эллипсоид** — используется для координатных преобразований

### Текстуры Земли
- **NASA Blue Marble** — «World, April» (NASA Earth Observatory / EOSDIS)
  - URL: https://eoimages.gsfc.nasa.gov/images/imagerecords/74000/74393/
  - Авторы: Reto Stöckli, NASA Earth Observatory
  - Лицензия: открытые данные NASA (https://www.nasa.gov/multimedia/guidelines/index.html)

### 3D-модели спутников
- **Процедурные модели** — разработаны в Three.js (BoxGeometry + PlaneGeometry)
  - Тип 1: 1U CubeSat (10×10×10 см), 2 солнечные панели
  - Тип 2: 3U CubeSat (10×10×30 см), 4 солнечные панели
  - Источник моделирования: собственная реализация (код открыт)
- **Справочник по конструкции**: CubeSat Design Specification Rev. 14 — https://www.cubesat.org/

### Открытые библиотеки
- **Three.js / React Three Fiber** — https://threejs.org, MIT License
- **Tailwind CSS** — https://tailwindcss.com, MIT License
- **Zustand** — https://github.com/pmndrs/zustand, MIT License
- **FastAPI** — https://fastapi.tiangolo.com, MIT License

## 📚 Использованные ресурсы

- **NASA 3D Resources** — модели КА
- **GrabCAD** — проекты кубсатов
- **CelesTrak** — TLE-данные
- **SGP4** — модель пропагации
- **Three.js / R3F** — 3D-визуализация