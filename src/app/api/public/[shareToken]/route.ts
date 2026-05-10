import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ shareToken: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { shareToken } = await ctx.params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = await (prisma as any).project.findUnique({
    where: { shareToken },
    select: { id: true, name: true, config: true, shareToken: true },
  });
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(project);
}
