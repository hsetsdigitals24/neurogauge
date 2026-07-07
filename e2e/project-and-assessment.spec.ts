import { test, expect } from "@playwright/test";
import { QA_USERS, QA_PROJECT_PREFIX, QA_EMAIL_DOMAIN } from "./helpers/db";
import { loginContext } from "./helpers/auth";
import { expectedMetrics, DPRIME_TOLERANCE } from "./helpers/dprime";

// Real end-to-end assessment: a researcher creates a study, an anonymous
// participant takes it through the actual UI, and the recorded results match
// what the test itself observed while answering.
test.describe("project creation and N-back assessment", () => {
  test("participant completes a self-paced letters study end-to-end", async ({ browser }) => {
    test.setTimeout(240_000);

    // ── Researcher: create a minimal self-paced project ──
    const { context: ownerCtx, api } = await loginContext(browser, QA_USERS.owner);
    const projRes = await api.post("/api/projects", {
      data: {
        name: `${QA_PROJECT_PREFIX}assessment-${Date.now()}`,
        config: {
          studyName: "QA letters study",
          stimulusTypes: ["letters"],
          levels: [1],
          timingMode: "self",
          totalMs: 3000,
          displayMs: 500,
          trialsPerBlock: 8,
          targetRate: 0.3,
          zeroBackTarget: "X",
          customQuestions: [],
          shapes: ["circle", "square", "triangle", "star", "diamond", "hexagon"],
          rotations: [0, 90, 180, 270],
          collectDemographics: true,
        },
      },
    });
    expect(projRes.status()).toBe(201);
    const project = await projRes.json();
    expect(project.shareToken).toBeTruthy();

    // ── Participant: anonymous context walks the real UI ──
    const participant = await browser.newContext();
    const page = await participant.newPage();
    const takerEmail = `qa+taker-ui-${Date.now()}@${QA_EMAIL_DOMAIN}`;

    // Reload-retry: the config fetch can be slow right after server start
    await expect(async () => {
      await page.goto(`/p/${project.shareToken}`);
      await expect(page.getByRole("heading", { name: /informed/i })).toBeVisible({ timeout: 15_000 });
    }).toPass({ timeout: 60_000 });
    await page.locator('input[type="checkbox"]').check();
    await page.getByRole("button", { name: /i agree/i }).click();

    // Taker info
    await expect(page.getByRole("heading", { name: /about/i })).toBeVisible();
    await page.locator('input[type="email"]').fill(takerEmail);
    await page.locator('input[type="number"]').fill("30");
    await page.locator("select").selectOption("masters");
    await page.getByRole("button", { name: /continue/i }).click();

    // Instructions → start block
    await page.getByRole("button", { name: /start block/i }).click();

    // ── Trials: read each stimulus, apply the 1-back rule ourselves ──
    const yesBtn = page.getByRole("button", { name: /^yes/i });
    const noBtn = page.getByRole("button", { name: /^no/i });
    const stimulusText = page.locator("div.text-\\[10rem\\]"); // letters render
    const seen: string[] = [];
    const myLog: { stimulus: string; answeredYes: boolean; isPriming: boolean }[] = [];

    for (let i = 0; i < 9; i++) {
      await expect(page.getByText(`Trial ${i + 1} / 9`)).toBeVisible({ timeout: 15_000 });
      const letter = (await stimulusText.textContent())?.trim() ?? "";
      expect(letter).not.toBe("");
      const isPriming = i < 1; // 1-back: first trial is priming
      const match = i >= 1 && letter === seen[i - 1];
      seen.push(letter);
      myLog.push({ stimulus: letter, answeredYes: match, isPriming });
      if (match) await yesBtn.click();
      else await noBtn.click();
    }

    // Per-level TLX then global TLX (defaults are fine)
    await expect(page.getByRole("heading", { name: /level questionnaire/i })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /submit/i }).click();
    await expect(page.getByRole("heading", { name: /final questionnaire/i })).toBeVisible();
    await page.getByRole("button", { name: /submit/i }).click();

    // Done screen; wait for the save POST to actually complete
    await expect(page.getByText("Results saved")).toBeVisible({ timeout: 30_000 });

    // ── Researcher: verify the stored session matches what we did ──
    const sessRes = await api.get(`/api/projects/${project.id}/sessions`);
    expect(sessRes.status()).toBe(200);
    const sessions = await sessRes.json();
    const mine = (Array.isArray(sessions) ? sessions : sessions.sessions ?? []).find(
      (s: { takerEmail: string }) => s.takerEmail === takerEmail
    );
    expect(mine, "submitted session visible to the researcher").toBeTruthy();
    expect(mine.blocks.length).toBe(1);
    const trials = mine.blocks[0].trials;
    expect(trials.length).toBe(9);

    // Stored stimuli/responses byte-match the UI observations
    for (let i = 0; i < 9; i++) {
      expect(trials[i].stimulus).toBe(myLog[i].stimulus);
      expect(trials[i].responseYes).toBe(myLog[i].answeredYes);
      expect(trials[i].responded).toBe(true);
      expect(trials[i].rtMs).toBeGreaterThan(0);
    }

    // Since we answered every non-priming trial correctly per the 1-back rule:
    // hits = number of true matches, no misses/false alarms.
    const scorable = trials.filter((t: { isPriming: boolean }) => !t.isPriming);
    const hits = scorable.filter((t: { expectedMatch: boolean }) => t.expectedMatch).length;
    const nonTargets = scorable.length - hits;
    for (const t of scorable) {
      expect(t.correct, `trial ${t.trialIndex} scored correct`).toBe(true);
    }

    // Cross-check d′ shown by the export against our independent implementation
    const exp = await api.get(`/api/projects/${project.id}/export?format=wide`);
    expect(exp.status()).toBe(200);
    const csv = await exp.text();
    const lines = csv.split("\n");
    const headers = lines[0].split(",");
    const row = lines.find((l) => l.includes(takerEmail));
    expect(row, "wide CSV row for this session").toBeTruthy();
    const cells = row!.split(",");
    const col = (name: string) => cells[headers.indexOf(name)];
    expect(Number(col("hits"))).toBe(hits);
    expect(Number(col("misses"))).toBe(0);
    expect(Number(col("false_alarms"))).toBe(0);
    expect(Number(col("correct_rejections"))).toBe(nonTargets);
    expect(Number(col("accuracy"))).toBeCloseTo(1, 4);
    const expected = expectedMetrics({
      hits,
      misses: 0,
      falseAlarms: 0,
      correctRejections: nonTargets,
      hitRts: [],
    });
    expect(Math.abs(Number(col("d_prime")) - expected.dPrime)).toBeLessThan(DPRIME_TOLERANCE);

    await participant.close();
    await ownerCtx.close();
  });
});
