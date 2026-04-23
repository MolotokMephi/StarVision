/**
 * api.ts — StarVision Backend API client.
 */

import type {
  APISatellitesResponse,
  APIPositionsResponse,
  APIOrbitResponse,
  APIChatResponse,
  APITleResponse,
  APIHealthResponse,
  ChatMessage,
} from '../types';

const BASE_URL = '/api';

export class ApiError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`API ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${url}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
  } catch (e) {
    // Network / CORS failure — surface as offline, not a parse error.
    throw new ApiError(0, (e as Error)?.message || 'network error');
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail);
    } catch {
      // non-JSON body, keep statusText
    }
    throw new ApiError(res.status, detail);
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

export async function fetchTLE(
  source: 'embedded' | 'celestrak' = 'embedded',
): Promise<APITleResponse> {
  return fetchJSON<APITleResponse>(`/tle?source=${source}`);
}

export async function refreshTLE(): Promise<APITleResponse & { refreshed: boolean }> {
  return fetchJSON<APITleResponse & { refreshed: boolean }>('/tle/refresh', {
    method: 'POST',
  });
}

export async function fetchHealth(): Promise<APIHealthResponse> {
  return fetchJSON<APIHealthResponse>('/health');
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

