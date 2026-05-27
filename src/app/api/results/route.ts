import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sessions = await (prisma as any).testSession.findMany({
    where: { takerEmail: email },
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { name: true, config: true } },
      blocks: {
        orderBy: { blockIndex: "asc" },
        include: { trials: true },
      },
    },
  });

  // Dedupe: collapse sessions that share (projectId, finishedAt rounded to minute),
  // keeping the most recently created (already sorted desc).
  const seen = new Set<string>();
  type S = { id: string; projectId: string; finishedAt: Date | null; startedAt: Date };
  const deduped = (sessions as S[]).filter((s) => {
    const stamp = s.finishedAt ?? s.startedAt;
    const bucket = stamp ? Math.floor(new Date(stamp).getTime() / 60000) : `id-${s.id}`;
    const key = `${s.projectId}:${bucket}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return NextResponse.json(deduped);
}
