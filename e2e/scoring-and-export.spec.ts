import { test, expect, type APIRequestContext } from "@playwright/test";
import { QA_USERS, QA_PROJECT_PREFIX, QA_EMAIL_DOMAIN } from "./helpers/db";
import { loginContext } from "./helpers/auth";
import { expectedMetrics, DPRIME_TOLERANCE } from "./helpers/dprime";

// Synthetic-session verification: POST hand-crafted trial data with known
// hit/miss/FA/CR counts and fixed RTs, then verify the app's d′/criterion/RT
// stats (results API, results UI, CSV export) against an independent
// implementation (helpers/dprime.ts).

type TrialIn = {
  trialIndex: number;
  stimulus: string;
  isPriming: boolean;
  expectedMatch: boolean | null;
  responded: boolean;
  responseYes: boolean | null;
  rtMs: number | null;
  correct: boolean | null;
  onsetTs: number;
};

// Engineered level-2 letters block: 2 priming + 20 scorable trials.
// Targets: 6 (5 hits with RTs 400..600, 1 miss). Non-targets: 14 (2 FAs, 12 CRs).
const HIT_RTS = [400, 450, 500, 550, 600];
function buildTrials(): TrialIn[] {
  const t: TrialIn[] = [];
  let i = 0;
  const push = (p: Partial<TrialIn> & { expectedMatch: boolean | null }) => {
    t.push({
      trialIndex: i,
      stimulus: "A",
      isPriming: false,
      responded: true,
      responseYes: null,
      rtMs: null,
      correct: null,
      onsetTs: i * 1000,
      ...p,
    });
    i++;
  };
  push({ isPriming: true, expectedMatch: null, responseYes: false });
  push({ isPriming: true, expectedMatch: null, responseYes: false });
  for (const rt of HIT_RTS) push({ expectedMatch: true, responseYes: true, rtMs: rt, correct: true }); // 5 hits
  push({ expectedMatch: true, responseYes: false, correct: false }); // 1 miss
  push({ expectedMatch: false, responseYes: true, rtMs: 300, correct: false }); // FA
  push({ expectedMatch: false, responseYes: true, rtMs: 320, correct: false }); // FA
  for (let k = 0; k < 12; k++) push({ expectedMatch: false, responseYes: false, correct: true }); // 12 CRs
  return t;
}

const EXPECTED = expectedMetrics({
  hits: 5,
  misses: 1,
  falseAlarms: 2,
  correctRejections: 12,
  hitRts: HIT_RTS,
});

async function createProject(api: APIRequestContext, suffix: string) {
  const res = await api.post("/api/projects", {
    data: {
      name: `${QA_PROJECT_PREFIX}scoring-${suffix}-${Date.now()}`,
      config: {
        studyName: "QA scoring study",
        stimulusTypes: ["letters"],
        levels: [2],
        timingMode: "auto",
        totalMs: 3000,
        displayMs: 500,
        trialsPerBlock: 20,
        targetRate: 0.3,
        zeroBackTarget: "X",
        customQuestions: [
          { id: "q1", type: "open", prompt: "Any comments?" },
        ],
        shapes: ["circle"],
        rotations: [0],
        collectDemographics: true,
      },
    },
  });
  expect(res.status()).toBe(201);
  return res.json();
}

async function postSession(
  api: APIRequestContext,
  shareToken: string,
  takerEmail: string,
  blocks: { stimulusType: string; level: number; trials: TrialIn[] }[],
  extra: Record<string, unknown> = {}
) {
  const res = await api.post(`/api/public/${shareToken}/sessions`, {
    data: {
      participantId: `P-QA-${Date.now()}`,
      takerEmail,
      takerAge: "28",
      takerHandedness: "right",
      takerEducation: "bachelors",
      startedAt: Date.now() - 60_000,
      finishedAt: Date.now(),
      consentGiven: true,
      globalTLX: {
        mentalDemand: 60, physicalDemand: 10, temporalDemand: 40,
        performance: 30, effort: 55, frustration: 20, paasMentalEffort: 6,
      },
      blocks,
      ...extra,
    },
  });
  return res;
}

test.describe("scoring accuracy and CSV export", () => {
  test("d′/criterion/RT stats match an independent implementation everywhere they surface", async ({ browser, page }) => {
    test.setTimeout(180_000);
    const { context, api } = await loginContext(browser, QA_USERS.owner);
    const project = await createProject(api, "main");
    const takerEmail = `qa+taker-synth-${Date.now()}@${QA_EMAIL_DOMAIN}`;

    // Submit synthetic session (unauthenticated, like a real participant)
    const anon = await browser.newContext();
    const res = await postSession(anon.request, project.shareToken, takerEmail, [
      { stimulusType: "letters", level: 2, trials: buildTrials() },
    ], {
      customAnswers: { q1: 'Tricky, "quoted" answer, with commas' },
      clientSubmissionId: `qa-synth-${Date.now()}`,
    });
    expect(res.status()).toBe(201);

    // ── Wide CSV export ──
    const expRes = await api.get(`/api/projects/${project.id}/export?format=wide`);
    expect(expRes.status()).toBe(200);
    const wide = await expRes.text();
    const wLines = wide.split("\n");
    // header may contain the quoted custom question; split carefully on the data row instead
    const headers = wLines[0].split(",");
    const row = wLines.find((l) => l.includes(takerEmail))!;
    expect(row).toBeTruthy();
    const cells = row.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/); // CSV-aware split
    const col = (name: string) => cells[headers.indexOf(name)];

    expect(Number(col("scorable"))).toBe(20);
    expect(Number(col("hits"))).toBe(5);
    expect(Number(col("misses"))).toBe(1);
    expect(Number(col("false_alarms"))).toBe(2);
    expect(Number(col("correct_rejections"))).toBe(12);
    expect(Number(col("accuracy"))).toBeCloseTo(EXPECTED.accuracy, 4);
    expect(Number(col("hit_rate"))).toBeCloseTo(EXPECTED.hitRate, 4);
    expect(Number(col("fa_rate"))).toBeCloseTo(EXPECTED.faRate, 4);
    expect(Math.abs(Number(col("d_prime")) - EXPECTED.dPrime)).toBeLessThan(DPRIME_TOLERANCE);
    expect(Math.abs(Number(col("criterion")) - EXPECTED.criterion)).toBeLessThan(DPRIME_TOLERANCE);
    expect(Number(col("rt_mean_ms"))).toBeCloseTo(EXPECTED.rtMean!, 1);
    expect(Number(col("rt_median_ms"))).toBeCloseTo(EXPECTED.rtMedian!, 1);
    expect(Number(col("rt_sd_ms"))).toBeCloseTo(EXPECTED.rtSD!, 1);
    // TLX and demographics preserved
    expect(Number(col("global_mental"))).toBe(60);
    expect(col("taker_education")).toBe("bachelors");
    // CSV escaping: quoted answer with commas survives as one field
    expect(row).toContain('"Tricky, ""quoted"" answer, with commas"');

    // ── Long CSV: trial rows byte-match what was POSTed ──
    const longRes = await api.get(`/api/projects/${project.id}/export?format=long`);
    expect(longRes.status()).toBe(200);
    const long = await longRes.text();
    const lLines = long.split("\n").filter((l) => l.includes(takerEmail));
    expect(lLines.length).toBe(22); // 2 priming + 20 scorable
    const lHeaders = long.split("\n")[0].split(",");
    const idx = (n: string) => lHeaders.indexOf(n);
    const sent = buildTrials();
    for (const line of lLines) {
      const c = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
      const ti = Number(c[idx("trial_index")]);
      expect(c[idx("stimulus")]).toBe(sent[ti].stimulus);
      expect(c[idx("is_priming")]).toBe(String(sent[ti].isPriming));
      expect(c[idx("response_yes")]).toBe(String(sent[ti].responseYes));
      if (sent[ti].rtMs != null) expect(Number(c[idx("rt_ms")])).toBe(sent[ti].rtMs);
    }

    // ── Participant results lookup: API + UI show the same numbers ──
    const lookup = await anon.request.get(`/api/results?email=${encodeURIComponent(takerEmail)}`);
    expect(lookup.status()).toBe(200);
    const found = await lookup.json();
    expect(found.length).toBe(1);
    expect(found[0].blocks[0].trials.length).toBe(22);

    // Reload-retry: the on-mount lookup needs hydration, which is slow under
    // parallel dev-server compile load
    await expect(async () => {
      await page.goto(`/results?email=${encodeURIComponent(takerEmail)}`);
      await expect(page.getByText(/found\s+1\s+session/i).first()).toBeVisible({ timeout: 10_000 });
    }).toPass({ timeout: 60_000 });

    await anon.close();
    await context.close();
  });

  test("edge cases: perfect performance yields finite d′; idempotent resubmission dedupes", async ({ browser }) => {
    const { context, api } = await loginContext(browser, QA_USERS.owner);
    const project = await createProject(api, "edge");
    const takerEmail = `qa+taker-edge-${Date.now()}@${QA_EMAIL_DOMAIN}`;

    // Perfect block: 6 hits, 14 CRs, no errors → rates clamp to 0.99/0.01
    const perfect: TrialIn[] = [];
    for (let i = 0; i < 20; i++) {
      const isTarget = i < 6;
      perfect.push({
        trialIndex: i, stimulus: "B", isPriming: false,
        expectedMatch: isTarget, responded: true, responseYes: isTarget,
        rtMs: isTarget ? 500 : null, correct: true, onsetTs: i * 1000,
      });
    }
    const anon = await browser.newContext();
    const submissionId = `qa-edge-${Date.now()}`;
    const res1 = await postSession(anon.request, project.shareToken, takerEmail, [
      { stimulusType: "letters", level: 2, trials: perfect },
    ], { clientSubmissionId: submissionId });
    expect(res1.status()).toBe(201);

    // Replay with the same clientSubmissionId → 200 with the existing session, no duplicate
    const res2 = await postSession(anon.request, project.shareToken, takerEmail, [
      { stimulusType: "letters", level: 2, trials: perfect },
    ], { clientSubmissionId: submissionId });
    expect(res2.status()).toBe(200);
    expect((await res2.json()).id).toBe((await res1.json()).id);

    const expRes = await api.get(`/api/projects/${project.id}/export?format=wide`);
    const wide = await expRes.text();
    const rows = wide.split("\n").filter((l) => l.includes(takerEmail));
    expect(rows.length).toBe(1); // deduped
    const headers = wide.split("\n")[0].split(",");
    const cells = rows[0].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/);
    const col = (name: string) => cells[headers.indexOf(name)];
    const expectedPerfect = expectedMetrics({
      hits: 6, misses: 0, falseAlarms: 0, correctRejections: 14, hitRts: [500, 500, 500, 500, 500, 500],
    });
    const d = Number(col("d_prime"));
    expect(Number.isFinite(d)).toBe(true); // clamping prevents Infinity
    expect(Math.abs(d - expectedPerfect.dPrime)).toBeLessThan(DPRIME_TOLERANCE);

    await anon.close();
    await context.close();
  });
});
