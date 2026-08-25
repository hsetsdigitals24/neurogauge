import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/marketplace/consultants/me — the caller's own consultant profile
// (any status), or { profile: null } if they haven't applied. Backs the
// "become a consultant" page and the consultant console.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await db.consultantProfile.findUnique({
    where: { userId: session.userId },
  });

  return NextResponse.json({ profile: profile ?? null });
}
