import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

// Power / sample-size analysis is dataset-free: it forwards design parameters
// straight to the analytics service, so it bypasses the [...path] proxy (which
// loads + projects a dataset). This static `power` segment shadows the catch-all
// for /api/analytics/power. No caching — the solve is instant and parameter-only.
export const maxDuration = 30;

interface Body {
  test?: string;
  solveFor?: "n" | "power" | "effect_size";
  effectSize?: number | null;
  alpha?: number;
  power?: number | null;
  n?: number | null;
  kGroups?: number | null;
  df?: number | null;
  ratio?: number;
  alternative?: string;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const upstream = process.env.ANALYTICS_URL;
  const secret = process.env.ANALYTICS_SHARED_SECRET;
  if (!upstream || !secret) {
    return NextResponse.json(
      { error: "Analytics service not configured (ANALYTICS_URL / ANALYTICS_SHARED_SECRET)" },
      { status: 503 },
    );
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Map the camelCase client payload onto the service's snake_case contract.
  const payload = {
    test: body.test,
    solve_for: body.solveFor ?? "n",
    effect_size: body.effectSize ?? null,
    alpha: body.alpha ?? 0.05,
    power: body.power ?? null,
    n: body.n ?? null,
    k_groups: body.kGroups ?? null,
    df: body.df ?? null,
    ratio: body.ratio ?? 1,
    alternative: body.alternative ?? "two-sided",
  };

  let res: Response;
  try {
    res = await fetch(`${upstream}/v1/power`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Analytics-Key": secret },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    // Transport-level failure (service down / connection dropped / DNS / TLS).
    const cause = err instanceof Error ? (err.cause ?? err).toString() : String(err);
    return NextResponse.json(
      { error: "Could not reach the analytics service", detail: cause, upstream: `${upstream}/v1/power` },
      { status: 502 },
    );
  }

  const text = await res.text();
  if (!res.ok) {
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
    });
  }
  return NextResponse.json(JSON.parse(text));
}
