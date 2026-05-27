import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { DEFAULT_CONFIG } from "@/lib/config";

export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = prisma as any;

  const [owned, collaborating] = await Promise.all([
    db.project.findMany({
      where: { ownerId: session.userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { sessions: true, collaborators: true } },
      },
    }),
    db.project.findMany({
      where: {
        collaborators: { some: { userId: session.userId } },
      },
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        _count: { select: { sessions: true, collaborators: true } },
      },
    }),
  ]);

  return NextResponse.json({ owned, collaborating });
}

export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, config } = await req.json();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const project = await (prisma as any).project.create({
    data: {
      name,
      config: config ?? DEFAULT_CONFIG,
      ownerId: session.userId,
    },
    select: { id: true, name: true, shareToken: true, createdAt: true },
  });

  return NextResponse.json(project, { status: 201 });
}
