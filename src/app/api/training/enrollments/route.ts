import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/training/enrollments — the caller's enrollments with course cards +
// completion state, for "My learning".
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const enrollments = await db.enrollment.findMany({
    where: { userId: session.userId },
    orderBy: { enrolledAt: "desc" },
    include: {
      course: { select: { id: true, slug: true, title: true, summary: true, coverImageUrl: true, level: true } },
      certificate: { select: { serial: true } },
    },
  });

  return NextResponse.json({ enrollments });
}
