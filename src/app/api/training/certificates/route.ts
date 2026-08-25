import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/training/certificates — the caller's earned certificates.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const certificates = await db.certificate.findMany({
    where: { userId: session.userId },
    orderBy: { issuedAt: "desc" },
    select: { serial: true, issuedAt: true, course: { select: { title: true, slug: true, level: true } } },
  });

  return NextResponse.json({ certificates });
}
