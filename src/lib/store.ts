"use client";
import { StudyConfig } from "./types";

export const DEFAULT_CONFIG: StudyConfig = {
  studyName: "N-Back Study",
  stimulusTypes: ["letters", "shapes", "rotated-e"],
  levels: [0, 1, 2, 3],
  timingMode: "auto",
  totalMs: 3000,
  displayMs: 500,
  trialsPerBlock: 20,
  targetRate: 0.3,
  zeroBackTarget: "X",
  customQuestions: [],
  shapes: ["circle", "square", "triangle", "star", "diamond", "hexagon"],
  rotations: [0, 90, 180, 270],
  collectDemographics: true,
};

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
