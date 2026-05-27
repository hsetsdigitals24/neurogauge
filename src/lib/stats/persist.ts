import { WorkspaceState, SessionFileV1, SCHEMA_VERSION } from "./workspace";

const KEY = (projectId: string) => `workspace:${projectId}`;

export function saveLocal(state: WorkspaceState) {
  if (typeof window === "undefined") return;
  try {
    const payload: SessionFileV1 = {
      version: SCHEMA_VERSION as 1,
      projectId: state.projectId,
      variables: state.variables,
      filter: state.filter,
      outputs: state.outputs,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY(state.projectId), JSON.stringify(payload));
  } catch {
    // quota exceeded or unavailable — ignore silently
  }
}

export function loadLocal(projectId: string): SessionFileV1 | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version === 1) return parsed as SessionFileV1;
  } catch { /* ignore */ }
  return null;
}

export function clearLocal(projectId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY(projectId));
}

export function toFile(state: WorkspaceState): SessionFileV1 {
  return {
    version: SCHEMA_VERSION as 1,
    projectId: state.projectId,
    variables: state.variables,
    filter: state.filter,
    outputs: state.outputs,
    savedAt: Date.now(),
  };
}

export function downloadJson(filename: string, data: object) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
