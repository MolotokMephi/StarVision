/**
 * api.ts — StarVision Backend API client.
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

// ── Satellites ──────────────────────────────────────────────────────

export async function fetchSatellites(): Promise<APISatellitesResponse> {
  return fetchJSON('/satellites');
}

export async function fetchPositions(
  timestamp?: string,
  source: 'embedded' | 'celestrak' = 'embedded',
): Promise<APIPositionsResponse> {
  const params = new URLSearchParams();
  if (timestamp) params.set('timestamp', timestamp);
  if (source !== 'embedded') params.set('source', source);
  const query = params.toString() ? `?${params}` : '';
  return fetchJSON(`/positions${query}`);
}

export async function fetchOrbitPath(
  noradId: number,
  steps = 120,
  stepSec = 60,
  source: 'embedded' | 'celestrak' = 'embedded',
): Promise<APIOrbitResponse> {
  const params = new URLSearchParams({
    steps: String(steps),
    step_sec: String(stepSec),
  });
  if (source !== 'embedded') params.set('source', source);
  return fetchJSON(`/orbit/${noradId}?${params}`);
}

export async function fetchTLE(source: 'embedded' | 'celestrak' = 'embedded') {
  return fetchJSON<{ tle_data: any[]; source: string }>(`/tle?source=${source}`);
}

export async function refreshTLE() {
  return fetchJSON<{ tle_data: any[]; source: string; refreshed: boolean }>('/tle/refresh', {
    method: 'POST',
  });
}

// ── StarAI ──────────────────────────────────────────────────────────

export async function sendChatMessage(
  message: string,
  history: ChatMessage[],
  lang: string = 'ru'
): Promise<APIChatResponse> {
  return fetchJSON('/starai/chat', {
    method: 'POST',
    body: JSON.stringify({
      message,
      history: history.map((m) => ({ role: m.role, content: m.content })),
      lang,
    }),
  });
}

