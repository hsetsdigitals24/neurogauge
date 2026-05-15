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

  return NextResponse.json(sessions);
}
