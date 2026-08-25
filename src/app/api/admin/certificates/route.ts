import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/admin/certificates — issued-certificate log.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const certificates = await db.certificate.findMany({
    orderBy: { issuedAt: "desc" },
    take: 300,
    include: {
      user: { select: { name: true, email: true } },
      course: { select: { title: true } },
    },
  });
  return NextResponse.json({ certificates });
}
