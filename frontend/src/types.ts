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
  operational: boolean;
  archive_date?: string | null;
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

// ── Data source / freshness metadata ────────────────────────────────

export type TleEffectiveSource = 'embedded' | 'celestrak' | 'embedded_fallback' | 'mixed';

export interface TleMeta {
  requested_source: 'embedded' | 'celestrak';
  effective_source: TleEffectiveSource;
  fallback: boolean;
  error: string | null;
  entries: number;
  cache_age_sec: number | null;
  cache_ttl_sec: number;
  stale: boolean;
  last_fetch_ok: boolean;
  last_fetch_error: string | null;
  last_fetch_age_sec: number | null;
}

export type BackendStatus = 'ok' | 'degraded' | 'offline' | 'unknown';

export interface BackendHealth {
  status: BackendStatus;
  reasons: string[];
  timestamp: string | null;
  checked_at: number;          // local epoch ms of last check
  error: string | null;        // populated when backend is unreachable
}

// ── UI State ────────────────────────────────────────────────────────

export interface AppState {
  // Language
  lang: 'ru' | 'en';

  // Data
  satellites: SatelliteData[];
  positions: SatellitePosition[];
  orbitPaths: Record<number, OrbitPoint[]>;
  tleData: TLEData[];
  tleMeta: TleMeta | null;
  health: BackendHealth;
  userError: string | null;      // Last user-visible error banner message

  // Controls
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
  tleSource: 'embedded' | 'celestrak';  // TLE data source
  orbitAltitudeKm: number;   // 0 = real TLE; >0 = virtual circular orbits
  commRangeKm: number;       // communication range threshold (50–2000 km per spec)
  activeLinksCount: number;  // current number of active ISL
  orbitalPlanes: number;     // number of orbital planes (1–7)

  // StarAI
  chatOpen: boolean;
  chatMessages: ChatMessage[];
  chatLoading: boolean;

  // Actions
  setLang: (lang: 'ru' | 'en') => void;
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
  setTleSource: (source: 'embedded' | 'celestrak') => void;
  setOrbitAltitudeKm: (km: number) => void;
  setCommRangeKm: (km: number) => void;
  setActiveLinksCount: (count: number) => void;
  setOrbitalPlanes: (planes: number) => void;
  setChatOpen: (open: boolean) => void;
  addChatMessage: (msg: ChatMessage) => void;
  setChatLoading: (loading: boolean) => void;
  setSatellites: (sats: SatelliteData[]) => void;
  setPositions: (pos: SatellitePosition[]) => void;
  setOrbitPath: (id: number, path: OrbitPoint[]) => void;
  setTleData: (data: TLEData[], meta: TleMeta | null) => void;
  setHealth: (h: BackendHealth) => void;
  setUserError: (err: string | null) => void;
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
  source?: string;
  meta?: TleMeta;
}

export interface APISatellitesResponse {
  satellites: SatelliteData[];
  count: number;
  operational_count?: number;
  archive_count?: number;
}

export interface APIOrbitResponse {
  norad_id: number;
  name: string;
  path: OrbitPoint[];
  steps: number;
  source?: string;
  meta?: TleMeta;
}

export interface APITleResponse {
  tle_data: TLEData[];
  source: TleEffectiveSource;
  meta: TleMeta;
}

export interface APIHealthResponse {
  status: 'ok' | 'degraded';
  reasons: string[];
  timestamp: string;
  tle_cache: {
    entries: number;
    cache_age_sec: number | null;
    cache_ttl_sec: number;
    stale: boolean;
    last_fetch_ok: boolean;
    last_fetch_error: string | null;
    last_fetch_age_sec: number | null;
  };
}

export interface APIChatResponse {
  message: string;
  actions: StarAIAction[];
  rejected_actions?: string[];
  source?: string;
}
