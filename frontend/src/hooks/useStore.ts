import { create } from 'zustand';
import type { AppState, SatelliteData, SatellitePosition, OrbitPoint, ChatMessage, TLEData } from '../types';

const ALL_CONSTELLATIONS = ['УниверСат', 'МГТУ Баумана', 'SPUTNIX', 'Геоскан', 'НИИЯФ МГУ', 'Space-Pi'];

export const useStore = create<AppState>((set) => ({
  // Language
  lang: (typeof navigator !== 'undefined' && navigator.language?.startsWith('en') ? 'en' : 'ru') as 'ru' | 'en',

  // Data
  satellites: [],
  positions: [],
  orbitPaths: {},
  tleData: [],

  // Controls
  timeSpeed: 1,
  showOrbits: true,
  showLabels: true,
  showCoverage: false,
  showLinks: true,
  selectedSatellite: null,
  focusedSatellite: null,
  cameraFollowing: false,
  highlightedConstellation: null,
  activeConstellations: [...ALL_CONSTELLATIONS],
  satelliteCount: 15,
  orbitAltitudeKm: 0,
  tleSource: 'embedded',
  commRangeKm: 3000,
  activeLinksCount: 0,
  orbitalPlanes: 3,

  // Chat
  chatOpen: false,
  chatMessages: [],
  chatLoading: false,

  // Actions
  setLang: (lang) => set({ lang }),
  setTimeSpeed: (speed) => set({ timeSpeed: speed }),
  setShowOrbits: (show) => set({ showOrbits: show }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowCoverage: (show) => set({ showCoverage: show }),
  setShowLinks: (show) => set({ showLinks: show }),
  selectSatellite: (id) => set(id === null
    ? { selectedSatellite: null, focusedSatellite: null, cameraFollowing: false }
    : { selectedSatellite: id }
  ),
  focusSatellite: (id) => set({ focusedSatellite: id, selectedSatellite: id, cameraFollowing: true }),
  setCameraFollowing: (following) => set({ cameraFollowing: following }),
  highlightConstellation: (name) => set({ highlightedConstellation: name }),
  toggleConstellation: (name) =>
    set((state) => ({
      activeConstellations: state.activeConstellations.includes(name)
        ? state.activeConstellations.filter((c) => c !== name)
        : [...state.activeConstellations, name],
    })),
  setSatelliteCount: (count) => set({ satelliteCount: count }),
  setTleSource: (source) => set({ tleSource: source }),
  setOrbitAltitudeKm: (km) => set({ orbitAltitudeKm: km }),
  setCommRangeKm: (km) => set({ commRangeKm: km }),
  setActiveLinksCount: (count) => set({ activeLinksCount: count }),
  setOrbitalPlanes: (planes) => set({ orbitalPlanes: planes }),
  setChatOpen: (open) => set({ chatOpen: open }),
  addChatMessage: (msg) =>
    set((state) => {
      const messages = [...state.chatMessages, msg];
      // Ограничиваем историю чата до 50 сообщений
      return { chatMessages: messages.length > 50 ? messages.slice(-50) : messages };
    }),
  setChatLoading: (loading) => set({ chatLoading: loading }),
  setSatellites: (sats) => set({ satellites: sats }),
  setPositions: (pos) => set({ positions: pos }),
  setOrbitPath: (id, path) =>
    set((state) => ({ orbitPaths: { ...state.orbitPaths, [id]: path } })),
  setTleData: (data) => set({ tleData: data }),
  resetView: () =>
    set({
      selectedSatellite: null,
      focusedSatellite: null,
      cameraFollowing: false,
      highlightedConstellation: null,
      timeSpeed: 1,
      showOrbits: true,
      showLabels: true,
      showCoverage: false,
      showLinks: true,
      activeConstellations: [...ALL_CONSTELLATIONS],
      satelliteCount: 15,
      tleSource: 'embedded',
      orbitAltitudeKm: 0,
      commRangeKm: 3000,
      orbitalPlanes: 3,
    }),
}));
