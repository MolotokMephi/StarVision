/**
 * api.ts — Сервис взаимодействия с StarGrid Backend.
 */

import type {
  APISatellitesResponse,
  APIPositionsResponse,
  APIOrbitResponse,
  APIChatResponse,
  ChatMessage,
} from '../types';

const BASE_URL = '/api';

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

// ── Спутники ────────────────────────────────────────────────────────

export async function fetchSatellites(): Promise<APISatellitesResponse> {
  return fetchJSON('/satellites');
}

export async function fetchPositions(timestamp?: string): Promise<APIPositionsResponse> {
  const query = timestamp ? `?timestamp=${encodeURIComponent(timestamp)}` : '';
  return fetchJSON(`/positions${query}`);
}

export async function fetchOrbitPath(
  noradId: number,
  steps = 120,
  stepSec = 60
): Promise<APIOrbitResponse> {
  return fetchJSON(`/orbit/${noradId}?steps=${steps}&step_sec=${stepSec}`);
}

export async function fetchTLE() {
  return fetchJSON<{ tle_data: any[] }>('/tle');
}

// ── StarAI ──────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  history: ChatMessage[]
): Promise<APIChatResponse> {
  return fetchJSON('/starai/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
    }),
  });
}

// ── Конфигурация ────────────────────────────────────────────────────

export async function fetchConfig() {
  return fetchJSON<{
    earth_texture_url: string;
    earth_radius_km: number;
    scale_factor: number;
    constellations: string[];
    default_time_speed: number;
    update_interval_ms: number;
  }>('/config');
}
