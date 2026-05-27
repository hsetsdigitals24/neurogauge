"use client";
import { StudyConfig } from "./types";
import { DEFAULT_CONFIG } from "./config";

const KEY = "nback.studyConfig";
const SESS = "nback.lastSession";

export function loadConfig(): StudyConfig {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_CONFIG;
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(cfg: StudyConfig) {
  localStorage.setItem(KEY, JSON.stringify(cfg));
}

export function saveLastSession(s: unknown) {
  localStorage.setItem(SESS, JSON.stringify(s));
}

export function loadLastSession<T = unknown>(): T | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESS);
  return raw ? (JSON.parse(raw) as T) : null;
}

// Re-export DEFAULT_CONFIG from shared config (avoids "use client" in server files)
export { DEFAULT_CONFIG } from "./config";
