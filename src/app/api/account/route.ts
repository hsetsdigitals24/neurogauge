import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, hashPassword, verifyPassword } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/account — the caller's editable profile fields.
export async function GET() {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, name: true, accountType: true, isAdmin: true, aiCredits: true, projectCredits: true, createdAt: true },
  });
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ user });
}

// PATCH /api/account — update the caller's display name and/or password.
// Password change requires the current password. Works for every account type.
export async function PATCH(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};

  if (typeof body.name === "string") {
    const name = body.name.trim();
    if (name.length < 1) return NextResponse.json({ error: "Name can't be empty" }, { status: 400 });
    if (name.length > 120) return NextResponse.json({ error: "Name is too long" }, { status: 400 });
    data.name = name;
  }

  // Password change (optional) — both fields required, current must verify.
  const wantsPasswordChange = body.newPassword !== undefined || body.currentPassword !== undefined;
  if (wantsPasswordChange) {
    const { currentPassword, newPassword } = body;
    if (typeof newPassword !== "string" || newPassword.length < 8) {
      return NextResponse.json({ error: "New password must be at least 8 characters" }, { status: 400 });
    }
    const user = await db.user.findUnique({ where: { id: session.userId }, select: { passwordHash: true } });
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const ok = typeof currentPassword === "string" && (await verifyPassword(currentPassword, user.passwordHash));
    if (!ok) return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    data.passwordHash = await hashPassword(newPassword);
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: session.userId },
    data,
    select: { id: true, email: true, name: true, accountType: true, createdAt: true },
  });
  return NextResponse.json({ user: updated });
}
