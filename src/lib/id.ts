export function generateId(): string {
  return typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : "q_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
