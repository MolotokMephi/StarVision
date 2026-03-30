# Архитектура StarVision

> Документация архитектуры цифрового двойника группировки российских кубсатов

## Общая схема системы

```mermaid
graph TB
    subgraph Frontend["Frontend (React + Three.js)"]
        UI[UI Panels]
        Scene[3D Scene]
        Store[Zustand Store]
        SGP4c[satellite.js SGP4]
        API_Client[API Client]

        UI -->|setState| Store
        Store -->|useStore| Scene
        Store -->|useStore| UI
        Scene -->|useFrame| SGP4c
        API_Client -->|fetch| Store
    end

    subgraph Backend["Backend (FastAPI + Python)"]
        REST[REST API]
        Orbital[orbital.py - SGP4]
        Catalog[satellites.py - Каталог]
        AI[ai_assistant.py - StarAI]
        Collision[Collision Prediction]
        Optimizer[Plane Optimizer]

        REST --> Orbital
        REST --> Catalog
        REST --> AI
        REST --> Collision
        REST --> Optimizer
        Orbital --> Catalog
    end

    subgraph External["Внешние сервисы"]
        Claude[Anthropic Claude API]
        TLE_src[CelesTrak / Space-Track]
        NASA[NASA Blue Marble]
    end

    API_Client -->|HTTP/JSON| REST
    AI -->|API call| Claude
    Catalog -.->|TLE данные| TLE_src
    Scene -.->|текстура| NASA

    style Frontend fill:#0d1b2a,stroke:#3389ff,color:#d9ecff
    style Backend fill:#1b2838,stroke:#33ffaa,color:#d9ecff
    style External fill:#2a1b38,stroke:#aa33ff,color:#d9ecff
```

## Потоки данных

```mermaid
sequenceDiagram
    participant User
    participant UI as UI (React)
    participant Store as Zustand Store
    participant Scene as 3D Scene
    participant API as FastAPI
    participant SGP4 as SGP4 Engine

    User->>UI: Взаимодействие (клик, ползунок)
    UI->>Store: setState()
    Store->>Scene: Re-render

    Note over Scene: useFrame() — каждый кадр
    Scene->>SGP4: propagate(satrec, date)
    SGP4-->>Scene: ECI позиция (x, y, z)
    Scene->>Scene: Обновление 3D-объектов

    Note over UI,API: Периодический поллинг
    UI->>API: GET /api/positions
    API->>SGP4: propagate_all()
    SGP4-->>API: Позиции всех КА
    API-->>Store: JSON response
```

## Архитектура компонентов

```mermaid
graph LR
    subgraph App["App.tsx"]
        Header
        ControlPanel
        InfoPanel[SatelliteInfoPanel]
        Chat[StarAIChat]
        Scene3D
    end

    subgraph Scene3D_inner["Scene3D"]
        Camera[CameraController]
        Earth
        Grid[CoordinateGrid]
        Sats[Satellites]
        ISL[InterSatelliteLinks]
        Stars
    end

    subgraph Satellites_inner["Satellites"]
        SatMarker[SatMarker × N]
        OrbitLine[OrbitLine / VirtualOrbitLine]
        CubeSat1U
        CubeSat3U
    end

    Scene3D --> Scene3D_inner
    Sats --> Satellites_inner
    SatMarker --> CubeSat1U
    SatMarker --> CubeSat3U

    style App fill:#0d1b2a,stroke:#3389ff,color:#d9ecff
    style Scene3D_inner fill:#1b2838,stroke:#33ffaa,color:#d9ecff
    style Satellites_inner fill:#2a1b38,stroke:#aa33ff,color:#d9ecff
```

## Модель данных

```mermaid
erDiagram
    SatelliteInfo {
        int norad_id PK
        string name
        string constellation
        string purpose
        float mass_kg
        string form_factor
        string launch_date
        string status
        string tle_line1
        string tle_line2
    }

    SatellitePosition {
        int norad_id FK
        float x_eci
        float y_eci
        float z_eci
        float altitude_km
        float speed_km_s
        float period_min
        float lat
        float lon
    }

    ISLLink {
        int norad_id_1 FK
        int norad_id_2 FK
        float distance_km
        boolean line_of_sight
        boolean connected
    }

    CollisionPrediction {
        int norad_id_1 FK
        int norad_id_2 FK
        float min_distance_km
        string time_closest_approach
        string risk_level
    }

    SatelliteInfo ||--o{ SatellitePosition : "propagated to"
    SatelliteInfo ||--o{ ISLLink : "linked with"
    SatelliteInfo ||--o{ CollisionPrediction : "predicted for"
```

## Backend API

```mermaid
graph LR
    subgraph Endpoints["REST API Endpoints"]
        E1[GET /api/satellites]
        E2[GET /api/tle]
        E3[GET /api/positions]
        E4[GET /api/orbit/:id]
        E5[GET /api/orbital-elements/:id]
        E6[GET /api/links]
        E7[GET /api/collisions]
        E8[GET /api/optimize-planes]
        E9[POST /api/starai/chat]
        E10[GET /api/config]
    end

    E1 --> Catalog[(satellites.py)]
    E2 --> Catalog
    E3 --> SGP4[orbital.py]
    E4 --> SGP4
    E5 --> SGP4
    E6 --> SGP4
    E7 --> SGP4
    E8 --> SGP4
    E9 --> AI[ai_assistant.py]
    E10 --> Config[Static Config]

    style Endpoints fill:#0d1b2a,stroke:#3389ff,color:#d9ecff
```

## Орбитальная механика

```mermaid
graph TD
    TLE[TLE Data] -->|twoline2rv| Satrec[SGP4 Satrec Object]
    Satrec -->|sgp4 jd, fr| ECI[ECI Position x,y,z]
    ECI -->|scale 1/R_E| Scene[Scene Coordinates]
    ECI -->|GMST rotation| Geo[Lat/Lon]

    subgraph Virtual["Виртуальные орбиты"]
        Params[N, Alt, Planes] -->|Walker-δ| RAAN[RAAN per plane]
        RAAN --> Kepler[Kepler Equation]
        Kepler --> VECI[Virtual ECI]
        VECI --> Scene
    end

    subgraph ISL_Calc["Расчёт ISL"]
        ECI --> Pairs[All Pairs N²]
        Pairs --> Distance[Distance Check]
        Pairs --> LOS[LOS Check]
        Distance --> Link[Link Status]
        LOS --> Link
    end

    style Virtual fill:#1b2838,stroke:#33ffaa,color:#d9ecff
    style ISL_Calc fill:#2a1b38,stroke:#aa33ff,color:#d9ecff
```

## Технологический стек

| Слой | Технология | Назначение |
|------|-----------|------------|
| **Frontend** | React 18 + TypeScript | UI Framework |
| **3D Engine** | Three.js / R3F / Drei | WebGL визуализация |
| **State** | Zustand | Управление состоянием |
| **Styling** | Tailwind CSS | Стилизация |
| **Bundler** | Vite | Сборка и dev-server |
| **Backend** | FastAPI (Python) | REST API |
| **Orbital** | sgp4 (Python) + satellite.js | SGP4 пропагация |
| **AI** | Anthropic Claude API | ИИ-ассистент |

## Принципы оптимизации

1. **Dual SGP4**: клиентская propagation для плавной анимации (60fps), серверная — для точных расчётов
2. **Object Pooling**: пул Line-объектов в InterSatelliteLinks вместо пересоздания каждый кадр
3. **Throttled Raycasting**: проверка наведения на линии каждый 3-й кадр
4. **Gated State Updates**: обновление Zustand только при изменении значений
5. **Uniform Selection**: O(N) выбор спутников вместо сортировки O(N log N)
6. **Shared SimClock**: единый источник времени для всех компонентов
