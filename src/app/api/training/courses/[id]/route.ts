import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin";
import { sanitizeLessonHtml } from "@/lib/sanitizeHtml";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

// Look up a course by id OR slug (public pages use the slug).
async function findCourse(idOrSlug: string) {
  return (
    (await db.course.findUnique({ where: { id: idOrSlug }, include: courseInclude })) ??
    (await db.course.findUnique({ where: { slug: idOrSlug }, include: courseInclude }))
  );
}
const courseInclude = {
  modules: { orderBy: { order: "asc" }, include: { lessons: { orderBy: { order: "asc" } } } },
  quiz: { orderBy: { order: "asc" } },
};

// GET /api/training/courses/[id] — full course (modules → lessons + quiz). For
// non-admins the quiz answer key (correctIndex) is stripped, and drafts 404.
// If the caller is enrolled, their lesson progress + latest attempt are included.
export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const course = await findCourse(id);
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const session = await getSessionUser();
  const admin = await requireAdmin();
  const isAdmin = Boolean(admin);

  if (course.status !== "published" && !isAdmin) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let enrollment = null;
  if (session) {
    enrollment = await db.enrollment.findUnique({
      where: { userId_courseId: { userId: session.userId, courseId: course.id } },
      include: {
        progress: { select: { lessonId: true } },
        attempts: { orderBy: { createdAt: "desc" }, take: 1 },
        certificate: true,
      },
    });
  }

  // Hide the answer key from non-admins.
  const quiz = course.quiz.map((q: { id: string; prompt: string; options: unknown; order: number; correctIndex: number }) =>
    isAdmin ? q : { id: q.id, prompt: q.prompt, options: q.options, order: q.order },
  );

  return NextResponse.json({
    course: { ...course, quiz },
    enrollment: enrollment
      ? {
          id: enrollment.id,
          status: enrollment.status,
          completedLessonIds: enrollment.progress.map((p: { lessonId: string }) => p.lessonId),
          lastAttempt: enrollment.attempts[0] ?? null,
          certificate: enrollment.certificate ?? null,
        }
      : null,
    isAdmin,
  });
}

// PATCH /api/training/courses/[id] — admin edit. Accepts course fields and,
// optionally, a full modules+lessons and quiz structure that REPLACES the
// existing one (editing structure resets learner progress — intended for
// pre-publish authoring).
export async function PATCH(req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await ctx.params;
  const course = await db.course.findUnique({ where: { id } });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  for (const f of ["title", "summary", "description", "level", "coverImageUrl"] as const) {
    if (typeof body[f] === "string") data[f] = body[f];
  }
  if (body.priceNaira !== undefined) data.priceKobo = Math.max(0, Math.round(Number(body.priceNaira) * 100) || 0);
  if (body.estimatedMinutes !== undefined) data.estimatedMinutes = Number(body.estimatedMinutes) || null;
  if (body.passThreshold !== undefined) data.passThreshold = Math.min(100, Math.max(0, Number(body.passThreshold) || 70));
  if (body.status === "draft" || body.status === "published") data.status = body.status;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await db.$transaction(async (tx: any) => {
    await tx.course.update({ where: { id }, data });

    if (Array.isArray(body.modules)) {
      await tx.courseModule.deleteMany({ where: { courseId: id } });
      for (const [mi, m] of body.modules.entries()) {
        const mod = await tx.courseModule.create({
          data: { courseId: id, title: String(m.title ?? `Module ${mi + 1}`), order: mi },
        });
        const lessons = Array.isArray(m.lessons) ? m.lessons : [];
        for (const [li, l] of lessons.entries()) {
          const format = l.contentFormat === "html" ? "html" : "markdown";
          const raw = String(l.contentMarkdown ?? "");
          await tx.lesson.create({
            data: {
              moduleId: mod.id,
              title: String(l.title ?? `Lesson ${li + 1}`),
              order: li,
              contentMarkdown: format === "html" ? sanitizeLessonHtml(raw) : raw,
              contentFormat: format,
              videoUrl: l.videoUrl ? String(l.videoUrl) : null,
              durationMins: Number(l.durationMins) || null,
            },
          });
        }
      }
    }

    if (Array.isArray(body.quiz)) {
      await tx.quizQuestion.deleteMany({ where: { courseId: id } });
      for (const [qi, q] of body.quiz.entries()) {
        const options = Array.isArray(q.options) ? q.options.map((o: unknown) => String(o)) : [];
        await tx.quizQuestion.create({
          data: {
            courseId: id,
            prompt: String(q.prompt ?? ""),
            options,
            correctIndex: Math.max(0, Math.min(options.length - 1, Number(q.correctIndex) || 0)),
            order: qi,
          },
        });
      }
    }
  });

  const updated = await findCourse(id);
  return NextResponse.json({ course: updated });
}

// DELETE /api/training/courses/[id] — admin only.
export async function DELETE(_req: Request, ctx: Ctx) {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  await db.course.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
