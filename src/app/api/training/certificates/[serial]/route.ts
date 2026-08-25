import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ serial: string }> };

// GET /api/training/certificates/[serial] — PUBLIC certificate verification.
// No auth: returns holder name, course title and issue date, or 404.
export async function GET(_req: Request, ctx: Ctx) {
  const { serial } = await ctx.params;
  const cert = await db.certificate.findUnique({
    where: { serial },
    select: {
      serial: true,
      issuedAt: true,
      user: { select: { name: true } },
      course: { select: { title: true, level: true } },
    },
  });
  if (!cert) return NextResponse.json({ error: "Not found", valid: false }, { status: 404 });

  return NextResponse.json({
    valid: true,
    serial: cert.serial,
    issuedAt: cert.issuedAt,
    holderName: cert.user?.name ?? "—",
    courseTitle: cert.course?.title ?? "—",
    level: cert.course?.level ?? null,
  });
}
