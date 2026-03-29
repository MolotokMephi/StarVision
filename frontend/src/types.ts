// ── Satellite Types ──────────────────────────────────────────────────

export interface SatelliteData {
  norad_id: number;
  name: string;
  constellation: string;
  purpose: string;
  mass_kg: number;
  form_factor: string;
  launch_date: string;
  status: string;
  description: string;
}

export interface TLEData {
  norad_id: number;
  name: string;
  constellation: string;
  tle_line1: string;
  tle_line2: string;
}

export interface SatellitePosition {
  norad_id: number;
  name: string;
  eci: { x: number; y: number; z: number };
  velocity: { vx: number; vy: number; vz: number };
  altitude_km: number;
  speed_km_s: number;
  period_min: number;
  lat: number;
  lon: number;
  timestamp: string;
}

export interface OrbitPoint {
  x: number;
  y: number;
  z: number;
}

// ── UI State ────────────────────────────────────────────────────────

export interface AppState {
  // Данные
  satellites: SatelliteData[];
  positions: SatellitePosition[];
  orbitPaths: Record<number, OrbitPoint[]>;
  tleData: TLEData[];

  // Управление
  timeSpeed: number;
  showOrbits: boolean;
  showLabels: boolean;
  showCoverage: boolean;
  showLinks: boolean;
  selectedSatellite: number | null;
  focusedSatellite: number | null;
  cameraFollowing: boolean;
  highlightedConstellation: string | null;
  activeConstellations: string[];
  satelliteCount: number;
  orbitAltitudeKm: number;   // 0 = используются реальные TLE; >0 = виртуальные круговые орбиты
  commRangeKm: number;       // порог дальности связи (50–2000 км)
  activeLinksCount: number;  // текущее количество активных МСС

  // StarAI
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  chatLoading: boolean;

  // Actions
  setTimeSpeed: (speed: number) => void;
  setShowOrbits: (show: boolean) => void;
  setShowLabels: (show: boolean) => void;
  setShowCoverage: (show: boolean) => void;
  setShowLinks: (show: boolean) => void;
  selectSatellite: (id: number | null) => void;
  focusSatellite: (id: number | null) => void;
  setCameraFollowing: (following: boolean) => void;
  highlightConstellation: (name: string | null) => void;
  toggleConstellation: (name: string) => void;
  setSatelliteCount: (count: number) => void;
  setOrbitAltitudeKm: (km: number) => void;
  setCommRangeKm: (km: number) => void;
  setActiveLinksCount: (count: number) => void;
  setChatOpen: (open: boolean) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  setSatellites: (sats: SatelliteData[]) => void;
  setPositions: (pos: SatellitePosition[]) => void;
  setOrbitPath: (id: number, path: OrbitPoint[]) => void;
  setTleData: (data: TLEData[]) => void;
  resetView: () => void;
}

// ── Chat ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: StarAIAction[];
  timestamp: number;
}

export interface StarAIAction {
  type: string;
  [key: string]: any;
}

// ── API Responses ───────────────────────────────────────────────────

export interface APIPositionsResponse {
  positions: SatellitePosition[];
  timestamp: string;
}

export interface APISatellitesResponse {
  satellites: SatelliteData[];
  count: number;
}

export interface APIOrbitResponse {
  norad_id: number;
  name: string;
  path: OrbitPoint[];
  steps: number;
}

export interface APIChatResponse {
  message: string;
  actions: StarAIAction[];
}
