import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const sess = await prisma.session.findUnique({
    where: { id },
    include: { blocks: { include: { trials: true }, orderBy: { blockIndex: "asc" } } },
  });
  if (!sess) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(sess);
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  await prisma.session.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
