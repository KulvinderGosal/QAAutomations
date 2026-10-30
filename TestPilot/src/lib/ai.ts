// Client-side helpers for the Claude-powered Manual Test prompt. All calls go
// to our same-origin /api/ai/* middleware (server/aiTest.ts) — the API key
// stays server-side. Types mirror the server shapes.
import type { ApiError } from "./runner";

export type AiStatus = { ready: boolean; model: string; source?: "key" | "token" | "env" | "profile" | "none" };

export type AiInterpret = {
  summary: string;
  loginUrl?: string;
  expectTitle?: string;
  expectText?: string;
};

export type AiSpec = { spec: string; filename: string };

async function json<T>(r: Response): Promise<T> {
  const body = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) {
    const err: ApiError = new Error(body.error || `Request failed (${r.status})`);
    err.status = r.status;
    throw err;
  }
  return body;
}

export function fetchAiStatus(): Promise<AiStatus> {
  return fetch("/api/ai/status").then((r) => json(r));
}

export function aiInterpret(body: { prompt: string; url: string }): Promise<AiInterpret> {
  return fetch("/api/ai/interpret", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}

export function aiGenerateSpec(body: { prompt: string; url: string }): Promise<AiSpec> {
  return fetch("/api/ai/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}

export function aiSaveSpec(body: { frameworkId: string; filename: string; spec: string }): Promise<{ path: string }> {
  return fetch("/api/ai/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => json(r));
}
