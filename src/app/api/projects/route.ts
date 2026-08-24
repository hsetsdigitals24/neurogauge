import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { DEFAULT_CONFIG } from "@/lib/config";
import { resolveEntitlements, withinLimit } from "@/lib/billing/subscription";

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
  const db = prisma as any;

  // Enforce the plan's project cap. Over the cap, a user must either be on an
  // unlimited (paid) plan or spend a purchased project pass (pay-per-project).
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      accountType: true,
      projectCredits: true,
      subscription: { select: { planCode: true, status: true, currentPeriodEnd: true } },
    },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const ent = resolveEntitlements(user);
  const ownedCount = await db.project.count({ where: { ownerId: session.userId } });

  if (!withinLimit(ent, "projects", ownedCount)) {
    // Try to consume one project pass atomically (guards against concurrency).
    const consumed = await db.user.updateMany({
      where: { id: session.userId, projectCredits: { gt: 0 } },
      data: { projectCredits: { decrement: 1 } },
    });
    if (consumed.count !== 1) {
      return NextResponse.json(
        {
          error: "project_limit",
          message:
            "You've reached your plan's project limit. Upgrade your plan or buy a project pass to create another.",
          limit: ent.limits.projects,
        },
        { status: 402 }
      );
    }
  }

  // Projects belong directly to their owner.
  const project = await db.project.create({
    data: {
      name,
      config: config ?? DEFAULT_CONFIG,
      ownerId: session.userId,
    },
    select: { id: true, name: true, shareToken: true, createdAt: true },
  });

  return NextResponse.json(project, { status: 201 });
}
