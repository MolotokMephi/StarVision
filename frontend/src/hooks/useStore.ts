import { create } from 'zustand';
import type { AppState, SatelliteData, SatellitePosition, OrbitPoint, ChatMessage } from '../types';

const ALL_CONSTELLATIONS = ['Сфера', 'Гонец', 'Образовательные', 'ДЗЗ', 'Научные', 'МФТИ', 'МГТУ им. Баумана'];

export const useStore = create<AppState>((set) => ({
  // Data
  satellites: [],
  positions: [],
  orbitPaths: {},

  // Controls
  timeSpeed: 1,
  showOrbits: true,
  showLabels: true,
  showCoverage: false,
  selectedSatellite: null,
  focusedSatellite: null,
  highlightedConstellation: null,
  activeConstellations: [...ALL_CONSTELLATIONS],
  satelliteCount: 14,

  // Chat
  chatOpen: false,
  chatMessages: [],
  chatLoading: false,

  // Actions
  setTimeSpeed: (speed) => set({ timeSpeed: speed }),
  setShowOrbits: (show) => set({ showOrbits: show }),
  setShowLabels: (show) => set({ showLabels: show }),
  setShowCoverage: (show) => set({ showCoverage: show }),
  selectSatellite: (id) => set({ selectedSatellite: id }),
  focusSatellite: (id) => set({ focusedSatellite: id, selectedSatellite: id }),
  highlightConstellation: (name) => set({ highlightedConstellation: name }),
  toggleConstellation: (name) =>
    set((state) => ({
      activeConstellations: state.activeConstellations.includes(name)
        ? state.activeConstellations.filter((c) => c !== name)
        : [...state.activeConstellations, name],
    })),
  setSatelliteCount: (count) => set({ satelliteCount: count }),
  setChatOpen: (open) => set({ chatOpen: open }),
  addChatMessage: (msg) =>
    set((state) => ({ chatMessages: [...state.chatMessages, msg] })),
  setChatLoading: (loading) => set({ chatLoading: loading }),
  setSatellites: (sats) => set({ satellites: sats }),
  setPositions: (pos) => set({ positions: pos }),
  setOrbitPath: (id, path) =>
    set((state) => ({ orbitPaths: { ...state.orbitPaths, [id]: path } })),
  resetView: () =>
    set({
      selectedSatellite: null,
      focusedSatellite: null,
      highlightedConstellation: null,
      timeSpeed: 1,
      showOrbits: true,
      showLabels: true,
      activeConstellations: [...ALL_CONSTELLATIONS],
      satelliteCount: 14,
    }),
}));
