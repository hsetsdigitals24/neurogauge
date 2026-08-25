import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { certificateSerial, gradeQuiz } from "@/lib/training";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

// POST /api/training/courses/[id]/quiz — submit quiz answers ({ answers:
// { [questionId]: optionIndex } }). Graded server-side; on pass the enrollment
// is completed and a Certificate is issued (idempotent on enrollmentId).
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const course = await db.course.findUnique({
    where: { id },
    select: { id: true, passThreshold: true, quiz: { select: { id: true, correctIndex: true } } },
  });
  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (course.quiz.length === 0) return NextResponse.json({ error: "This course has no quiz." }, { status: 400 });

  const enrollment = await db.enrollment.findUnique({
    where: { userId_courseId: { userId: session.userId, courseId: course.id } },
    include: { certificate: true },
  });
  if (!enrollment) return NextResponse.json({ error: "Not enrolled" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const answers: Record<string, number> = body.answers && typeof body.answers === "object" ? body.answers : {};

  const { score, passed } = gradeQuiz(course.quiz, answers, course.passThreshold);

  await db.quizAttempt.create({
    data: { enrollmentId: enrollment.id, score, passed, answers },
  });

  let certificate = enrollment.certificate ?? null;
  if (passed) {
    if (enrollment.status !== "completed") {
      await db.enrollment.update({ where: { id: enrollment.id }, data: { status: "completed", completedAt: new Date() } });
    }
    if (!certificate) {
      // Retry a couple of times on the (astronomically unlikely) serial clash.
      for (let i = 0; i < 3 && !certificate; i++) {
        try {
          certificate = await db.certificate.create({
            data: { enrollmentId: enrollment.id, userId: session.userId, courseId: course.id, serial: certificateSerial() },
          });
        } catch {
          // unique violation on serial or enrollmentId — refetch in case another
          // request already issued it.
          certificate = await db.certificate.findUnique({ where: { enrollmentId: enrollment.id } });
        }
      }
    }
  }

  return NextResponse.json({
    score,
    passed,
    passThreshold: course.passThreshold,
    total: course.quiz.length,
    certificate: certificate ? { serial: certificate.serial } : null,
  });
}
