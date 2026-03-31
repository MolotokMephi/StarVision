"""
satellites.py — Каталог российских спутников (CubeSat / малые КА).
TLE-данные для демонстрации. В продакшене — подгрузка с celestrak / spacetrack.
"""

from dataclasses import dataclass, field
from typing import List, Optional

@dataclass
class SatelliteInfo:
    norad_id: int
    name: str
    constellation: str
    purpose: str
    mass_kg: float
    form_factor: str          # "3U", "6U", "16U" и т.д.
    launch_date: str
    status: str               # "active" | "inactive" | "deorbited"
    tle_line1: str = ""
    tle_line2: str = ""
    description: str = ""


# ── Российские кубсаты и малые КА ──────────────────────────────────
RUSSIAN_CUBESATS: List[SatelliteInfo] = [
    # --- Группировка «Сфера» (планируемая / демо) ---
    SatelliteInfo(
        norad_id=56200,
        name="Сфера-Скиф-Д",
        constellation="Сфера",
        purpose="Широкополосный доступ в Интернет (демонстратор)",
        mass_kg=200.0,
        form_factor="Микросат",
        launch_date="2022-10-22",
        status="active",
        tle_line1="1 56200U 23001A   26088.50000000  .00000100  00000-0  10000-3 0  9990",
        tle_line2="2 56200  97.5700 120.0000 0010000  90.0000 270.0000 14.80000000 10000",
        description="Демонстратор системы «Скиф» — часть программы «Сфера» для обеспечения широкополосного интернета."
    ),
    SatelliteInfo(
        norad_id=56201,
        name="Сфера-Марафон-IoT-1",
        constellation="Сфера",
        purpose="IoT / M2M связь",
        mass_kg=50.0,
        form_factor="6U",
        launch_date="2023-06-15",
        status="active",
        tle_line1="1 56201U 23002A   26088.50000000  .00000120  00000-0  11000-3 0  9991",
        tle_line2="2 56201  97.6000 130.0000 0012000 100.0000 260.0000 14.85000000 10001",
        description="IoT-спутник программы «Марафон» для передачи данных Интернета вещей."
    ),
    SatelliteInfo(
        norad_id=56202,
        name="Сфера-Марафон-IoT-2",
        constellation="Сфера",
        purpose="IoT / M2M связь",
        mass_kg=50.0,
        form_factor="6U",
        launch_date="2023-06-15",
        status="active",
        tle_line1="1 56202U 23002B   26088.50000000  .00000120  00000-0  11000-3 0  9992",
        tle_line2="2 56202  97.6000 130.0000 0012000 100.0000 200.0000 14.85000000 10002",
        description="Второй IoT-спутник программы «Марафон»."
    ),

    # --- Университетские кубсаты ---
    SatelliteInfo(
        norad_id=44394,
        name="СириусСат-1",
        constellation="Образовательные",
        purpose="Мониторинг радиационной обстановки",
        mass_kg=1.5,
        form_factor="1U",
        launch_date="2018-08-15",
        status="active",
        tle_line1="1 44394U 18065E   26088.50000000  .00001500  00000-0  80000-4 0  9993",
        tle_line2="2 44394  51.6400 200.0000 0005000  45.0000 315.0000 15.54000000 40000",
        description="Образовательный наноспутник, созданный школьниками «Сириуса»."
    ),
    SatelliteInfo(
        norad_id=44395,
        name="СириусСат-2",
        constellation="Образовательные",
        purpose="Мониторинг радиационной обстановки",
        mass_kg=1.5,
        form_factor="1U",
        launch_date="2018-08-15",
        status="active",
        tle_line1="1 44395U 18065F   26088.50000000  .00001500  00000-0  80000-4 0  9994",
        tle_line2="2 44395  51.6400 200.0000 0005000  45.0000 250.0000 15.54000000 40001",
        description="Второй образовательный спутник проекта «СириусСат»."
    ),
    SatelliteInfo(
        norad_id=49260,
        name="Декарт",
        constellation="МФТИ",
        purpose="Научные эксперименты, ДЗЗ",
        mass_kg=50.0,
        form_factor="12U",
        launch_date="2021-03-22",
        status="active",
        tle_line1="1 49260U 21001A   26088.50000000  .00000500  00000-0  30000-4 0  9995",
        tle_line2="2 49260  97.4000 150.0000 0015000  80.0000 280.0000 15.20000000 25000",
        description="Спутник МФТИ для научных экспериментов и дистанционного зондирования."
    ),
    SatelliteInfo(
        norad_id=47951,
        name="УмКА-1",
        constellation="МГТУ им. Баумана",
        purpose="Технологический демонстратор",
        mass_kg=3.0,
        form_factor="3U",
        launch_date="2021-03-22",
        status="active",
        tle_line1="1 47951U 21001B   26088.50000000  .00000800  00000-0  50000-4 0  9996",
        tle_line2="2 47951  97.4000 150.0000 0014000  75.0000 285.0000 15.18000000 25001",
        description="Университетский кубсат МГТУ им. Баумана."
    ),

    # --- Группировка «Гонец» ---
    SatelliteInfo(
        norad_id=40553,
        name="Гонец-М №21",
        constellation="Гонец",
        purpose="Персональная спутниковая связь",
        mass_kg=280.0,
        form_factor="Микросат",
        launch_date="2015-02-01",
        status="active",
        tle_line1="1 40553U 15005A   26088.50000000  .00000060  00000-0  50000-4 0  9997",
        tle_line2="2 40553  82.5000  60.0000 0020000 120.0000 240.0000 14.70000000 60000",
        description="Спутник связи группировки «Гонец-М» — российская система персональной связи."
    ),
    SatelliteInfo(
        norad_id=40554,
        name="Гонец-М №22",
        constellation="Гонец",
        purpose="Персональная спутниковая связь",
        mass_kg=280.0,
        form_factor="Микросат",
        launch_date="2015-02-01",
        status="active",
        tle_line1="1 40554U 15005B   26088.50000000  .00000060  00000-0  50000-4 0  9998",
        tle_line2="2 40554  82.5000  60.0000 0020000 120.0000 180.0000 14.70000000 60001",
        description="Спутник связи группировки «Гонец-М»."
    ),
    SatelliteInfo(
        norad_id=40555,
        name="Гонец-М №23",
        constellation="Гонец",
        purpose="Персональная спутниковая связь",
        mass_kg=280.0,
        form_factor="Микросат",
        launch_date="2015-02-01",
        status="active",
        tle_line1="1 40555U 15005C   26088.50000000  .00000060  00000-0  50000-4 0  9999",
        tle_line2="2 40555  82.5000  60.0000 0020000 120.0000 120.0000 14.70000000 60002",
        description="Спутник связи группировки «Гонец-М»."
    ),

    # --- Технологические / ДЗЗ ---
    SatelliteInfo(
        norad_id=48850,
        name="Зоркий-2М",
        constellation="ДЗЗ",
        purpose="Дистанционное зондирование Земли",
        mass_kg=130.0,
        form_factor="Микросат",
        launch_date="2022-08-09",
        status="active",
        tle_line1="1 48850U 22002A   26088.50000000  .00000200  00000-0  15000-3 0  9980",
        tle_line2="2 48850  97.3000 140.0000 0008000  60.0000 300.0000 15.10000000 20000",
        description="Коммерческий спутник ДЗЗ компании «Спутникс»."
    ),
    SatelliteInfo(
        norad_id=55120,
        name="Беркут-С",
        constellation="ДЗЗ",
        purpose="Высокодетальная съёмка",
        mass_kg=200.0,
        form_factor="Микросат",
        launch_date="2023-12-01",
        status="active",
        tle_line1="1 55120U 23005A   26088.50000000  .00000150  00000-0  12000-3 0  9981",
        tle_line2="2 55120  97.8000 160.0000 0009000  70.0000 290.0000 15.05000000 15000",
        description="Спутник сверхвысокого разрешения для картографии и мониторинга."
    ),
    SatelliteInfo(
        norad_id=55121,
        name="Аист-2Т",
        constellation="Научные",
        purpose="Научные эксперименты / ДЗЗ",
        mass_kg=530.0,
        form_factor="Малый КА",
        launch_date="2024-03-15",
        status="active",
        tle_line1="1 55121U 24001A   26088.50000000  .00000100  00000-0  10000-3 0  9982",
        tle_line2="2 55121  51.6500 180.0000 0012000  50.0000 310.0000 15.50000000 12000",
        description="Малый космический аппарат для научных экспериментов (РКЦ «Прогресс» / СГАУ)."
    ),

    # --- Дополнительные спутники ---
    SatelliteInfo(
        norad_id=56203,
        name="Сфера-Марафон-IoT-3",
        constellation="Сфера",
        purpose="IoT / M2M связь",
        mass_kg=50.0,
        form_factor="6U",
        launch_date="2024-03-01",
        status="active",
        tle_line1="1 56203U 24010A   26088.50000000  .00000120  00000-0  11000-3 0  9993",
        tle_line2="2 56203  97.6200 145.0000 0011000 110.0000 250.0000 14.83000000 10003",
        description="Третий IoT-спутник программы «Марафон» для расширения покрытия."
    ),
    SatelliteInfo(
        norad_id=44396,
        name="Танюша-ЮЗГУ-1",
        constellation="Образовательные",
        purpose="Образовательный эксперимент",
        mass_kg=1.0,
        form_factor="1U",
        launch_date="2017-08-17",
        status="active",
        tle_line1="1 44396U 17049E   26088.50000000  .00001200  00000-0  70000-4 0  9994",
        tle_line2="2 44396  51.6300 210.0000 0006000  55.0000 305.0000 15.55000000 45000",
        description="Образовательный наноспутник ЮЗГУ, запущен с МКС. Эксперименты по связи."
    ),
]


def get_all_satellites() -> List[dict]:
    """Вернуть все спутники как список dict."""
    return [
        {
            "norad_id": s.norad_id,
            "name": s.name,
            "constellation": s.constellation,
            "purpose": s.purpose,
            "mass_kg": s.mass_kg,
            "form_factor": s.form_factor,
            "launch_date": s.launch_date,
            "status": s.status,
            "description": s.description,
        }
        for s in RUSSIAN_CUBESATS
    ]


def get_satellite_by_id(norad_id: int) -> Optional[SatelliteInfo]:
    for s in RUSSIAN_CUBESATS:
        if s.norad_id == norad_id:
            return s
    return None


def get_tle_data() -> List[dict]:
    """Вернуть TLE для всех спутников (для фронтенда)."""
    return [
        {
            "norad_id": s.norad_id,
            "name": s.name,
            "constellation": s.constellation,
            "tle_line1": s.tle_line1,
            "tle_line2": s.tle_line2,
        }
        for s in RUSSIAN_CUBESATS
        if s.tle_line1 and s.tle_line2
    ]
