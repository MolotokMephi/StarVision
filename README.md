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

## 📚 Использованные ресурсы

- **LROC** (lroc.sese.asu.edu) — данные о Луне
- **NASA 3D Resources** — модели КА
- **GrabCAD** — проекты кубсатов
- **CelesTrak** — TLE-данные
- **SGP4** — модель пропагации
- **Three.js / R3F** — 3D-визуализация
- **CesiumJS** — справочник по планетарному масштабу