/**
 * Turn a raw analysis failure (HTTP status text, a FastAPI `{detail}` payload,
 * a scipy/statsmodels/pingouin exception message, or a network error) into a
 * short, plain-language message a researcher can act on.
 *
 * The goal is never to show a stack trace or a bare status code in the UI —
 * always a human sentence, optionally hinting at the fix.
 */

/** Extract the most meaningful string out of whatever was thrown/returned. */
function rawMessage(input: unknown): string {
  let msg = input instanceof Error ? input.message : String(input ?? "");
  msg = msg.trim();
  // Server bodies are often JSON: {"detail": "..."} (FastAPI) or {"error": "..."}.
  if (msg.startsWith("{") || msg.startsWith("[")) {
    try {
      const parsed = JSON.parse(msg);
      const inner = parsed?.detail ?? parsed?.error ?? parsed?.message;
      if (typeof inner === "string" && inner.trim()) msg = inner.trim();
      else if (Array.isArray(inner) && inner[0]?.msg) msg = String(inner[0].msg);
    } catch {
      /* not JSON — keep raw */
    }
  }
  return msg;
}

/** Ordered pattern → friendly-message table. First match wins. */
const PATTERNS: { test: RegExp; message: string }[] = [
  // ── Connectivity / server availability ──────────────────────────────────
  { test: /failed to fetch|networkerror|network request failed|load failed/i,
    message: "Couldn't reach the analysis service. Check your connection and try again." },
  { test: /not configured|analytics_url|shared_secret/i,
    message: "The analysis service isn't set up yet. Please contact support if this persists." },
  { test: /\b(502|503|504)\b|bad gateway|gateway tim|service unavailable|timed? ?out|timeout/i,
    message: "The analysis service is temporarily unavailable. Please wait a moment and try again." },

  // ── Auth / access ───────────────────────────────────────────────────────
  { test: /unauthorized|\b401\b/i,
    message: "Your session has expired. Please sign in again." },
  { test: /forbidden|\b403\b/i,
    message: "You don't have access to this data." },
  { test: /not found|\b404\b/i,
    message: "This project or dataset could no longer be found." },

  // ── Data-shape problems the researcher can fix ──────────────────────────
  { test: /could not convert string to float|must be numeric|invalid literal for|non-numeric|numeric data/i,
    message: "One of the selected variables contains text where numbers are expected. Pick a numeric variable, or clean the column." },
  { test: /zero variance|constant|is constant|no vari(ance|ation)|standard deviation.*zero/i,
    message: "A selected variable has no variation (every value is the same), so this test can't run. Choose a different variable." },
  { test: /singular matrix|not positive definite|svd did not converge|linalg|collinear|multicollinear/i,
    message: "The variables are too closely related (or one is a combination of others) for the model to solve. Try removing a redundant predictor." },
  { test: /perfect(ly)? separat|complete quasi-separation/i,
    message: "The outcome can be predicted perfectly from a variable, which breaks the model. Try removing that variable." },
  { test: /(sample size|at least|too few|not enough|minimum of|n\s*[<=]\s*\d|need(s)? .* observations|insufficient)/i,
    message: "There aren't enough observations for this analysis. Collect more data or choose a simpler test." },
  { test: /nan|missing|null|empty|no (valid )?(data|rows|observations)|contains no/i,
    message: "There aren't enough complete rows after removing missing values. Check for blank cells in the selected variables." },
  { test: /same length|unequal length|shape mismatch|mismatch|dimensions/i,
    message: "The selected variables don't line up (different numbers of values). Make sure they come from the same rows." },
  { test: /number of groups|only one group|at least two (groups|levels)|requires .* groups|single (group|level)/i,
    message: "This test needs at least two groups. Pick a grouping variable with two or more categories." },
  { test: /too many (groups|levels|categories)/i,
    message: "The grouping variable has too many categories for this test. Use a variable with fewer groups." },

  // ── Validation (422) fallbacks ──────────────────────────────────────────
  { test: /\b422\b|validation error|field required|value_error|type_error/i,
    message: "Some options for this analysis are missing or invalid. Review your variable selections and try again." },
  { test: /\b400\b|bad request/i,
    message: "This analysis couldn't run with the current settings. Review your variable selections and try again." },
  { test: /\b500\b|internal server error/i,
    message: "The analysis service hit an unexpected error. Try again, or adjust your variable selections." },
];

/**
 * @param input the caught error / raw server body
 * @param fallback message used when nothing matches (default is analysis-generic)
 */
export function friendlyAnalysisError(
  input: unknown,
  fallback = "This analysis couldn't be completed. Please review your variable selections and try again.",
): string {
  const raw = rawMessage(input);
  if (!raw) return fallback;

  for (const { test, message } of PATTERNS) {
    if (test.test(raw)) return message;
  }

  // No pattern matched. If the raw message is short and readable (no code/JSON
  // noise), surface it; otherwise use the generic fallback.
  const looksTechnical = /[{}<>\\]|traceback|at line|0x[0-9a-f]|https?:\/\//i.test(raw) || raw.length > 160;
  return looksTechnical ? fallback : raw;
}
