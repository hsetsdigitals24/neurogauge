import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { parseCsv } from "@/lib/analytics/csvParser";
import { sanitiseColumnKey } from "@/lib/analytics/csvIngest";
import { isQuestionnaireConfig, type QItem, type QuestionnaireConfig, type CustomQuestion } from "@/lib/types";

type Ctx = { params: Promise<{ id: string }> };

/** Normalise a header for tolerant matching: lower-cased, sanitised key form. */
function norm(s: string): string {
  return sanitiseColumnKey(String(s ?? "").toLowerCase(), "");
}

/** Build a lookup from every parsed header to its column name, keyed by norm(). */
function headerIndex(headers: string[]): Map<string, string> {
  const idx = new Map<string, string>();
  for (const h of headers) {
    const n = norm(h);
    if (n && !idx.has(n)) idx.set(n, h);
  }
  return idx;
}

/** First header (by norm) that matches any of the given candidate names. */
function findHeader(idx: Map<string, string>, candidates: string[]): string | null {
  for (const c of candidates) {
    const hit = idx.get(norm(c));
    if (hit) return hit;
  }
  return null;
}

const EMAIL_CANDIDATES = ["taker_email", "email", "e_mail", "respondent_id", "participant_id", "pid"];

/**
 * Bulk-import offline-collected responses as sessions.
 *
 * Accepts a CSV (paper questionnaires, spreadsheets, another tool) and creates
 * one TestSession per row so the data flows into Results, analytics and export
 * exactly like an online submission. Question columns are matched tolerantly by
 * `key`, prompt/label, or a sanitised form of either, so a round-trip of the
 * project's exported CSV re-imports cleanly.
 */
export async function POST(req: Request, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const project = await db.project.findUnique({
    where: { id },
    select: { id: true, config: true, ownerId: true, collaborators: { select: { userId: true } } },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner = project.ownerId === user.userId;
  const isCollab = project.collaborators.some((c: { userId: string }) => c.userId === user.userId);
  if (!isOwner && !isCollab) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const csvText: string = typeof body?.csvText === "string" ? body.csvText : "";
  if (!csvText.trim()) return NextResponse.json({ error: "No CSV data provided" }, { status: 400 });

  // Optional multicenter tagging: attribute every imported row to one of the
  // project owner's sites (centres). Ignored if it belongs to a different user.
  let siteId: string | null = null;
  if (body?.siteId) {
    const site = await db.site.findUnique({
      where: { id: String(body.siteId) },
      select: { id: true, userId: true },
    });
    if (site && site.userId === project.ownerId) siteId = site.id;
  }

  const { headers, rows } = parseCsv(csvText);
  if (headers.length === 0 || rows.length === 0) {
    return NextResponse.json({ error: "CSV has no data rows" }, { status: 400 });
  }

  const idx = headerIndex(headers);
  const emailHeader = findHeader(idx, EMAIL_CANDIDATES);
  const isQuestionnaire = isQuestionnaireConfig(project.config);

  // Map each question to the CSV column that supplies its answer, keyed by the
  // question `id` used in customAnswers.
  const questionCols: { id: string; header: string }[] = [];
  if (isQuestionnaire) {
    for (const q of ((project.config as QuestionnaireConfig).questions ?? []) as QItem[]) {
      const h = findHeader(idx, [q.key, q.prompt].filter(Boolean) as string[]);
      if (h) questionCols.push({ id: q.id, header: h });
    }
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const custom: CustomQuestion[] = ((project.config as any)?.customQuestions ?? []) as CustomQuestion[];
    for (const q of custom) {
      const h = findHeader(idx, [q.id, q.prompt].filter(Boolean) as string[]);
      if (h) questionCols.push({ id: q.id, header: h });
    }
  }

  // N-back demographic columns.
  const ageHeader = findHeader(idx, ["taker_age", "age"]);
  const handHeader = findHeader(idx, ["taker_handedness", "handedness"]);
  const eduHeader = findHeader(idx, ["taker_education", "education"]);

  if (questionCols.length === 0 && !emailHeader && !ageHeader) {
    return NextResponse.json(
      { error: "No matching columns found. Include an Email column and columns matching the questions." },
      { status: 400 },
    );
  }

  const cell = (row: Record<string, unknown>, header: string | null): string =>
    header && row[header] != null ? String(row[header]).trim() : "";

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const answers: Record<string, string> = {};
    for (const { id: qid, header } of questionCols) {
      const v = cell(row, header);
      if (v !== "") answers[qid] = v;
    }
    const email = cell(row, emailHeader);

    // Skip empty rows (no email and no answers).
    if (!email && Object.keys(answers).length === 0) { skipped++; continue; }

    const participantId = "P-" + Math.random().toString(36).slice(2, 8).toUpperCase();
    try {
      await db.testSession.create({
        data: {
          projectId: project.id,
          siteId: siteId ?? undefined,
          participantId,
          takerEmail: email.toLowerCase(),
          takerAge: isQuestionnaire ? "" : cell(row, ageHeader),
          takerHandedness: isQuestionnaire ? "" : cell(row, handHeader),
          takerEducation: isQuestionnaire ? "" : cell(row, eduHeader),
          startedAt: new Date(),
          finishedAt: new Date(),
          consentGiven: true,
          customAnswers: Object.keys(answers).length ? answers : undefined,
        },
        select: { id: true },
      });
      created++;
    } catch (e: unknown) {
      skipped++;
      errors.push(`Row ${i + 2}: ${(e as Error)?.message ?? "failed to import"}`);
    }
  }

  if (created > 0) {
    await db.analysisResult.deleteMany({ where: { projectId: project.id } }).catch(() => {});
  }

  return NextResponse.json({ created, skipped, total: rows.length, errors: errors.slice(0, 10) }, { status: 201 });
}
