import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, signToken, setAuthCookie } from "@/lib/auth";
import { ACCOUNT_TYPES, freePlanFor, type AccountType } from "@/lib/billing/plans";

export async function POST(req: Request) {
  try {
    const { name, email, password, accountType } = await req.json();
    if (!name || !email || !password || password.length < 8) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }

    // Account type is chosen at signup; default to student for older clients.
    const type: AccountType = ACCOUNT_TYPES.includes(accountType) ? accountType : "student";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const existing = await (prisma as any).user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email already in use" }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma as any).user.create({
      data: { name, email, passwordHash, accountType: type },
      select: { id: true, email: true, name: true, accountType: true },
    });

    // Seed an (inactive) subscription on the account type's free plan.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (prisma as any).subscription.create({
      data: { userId: user.id, planCode: freePlanFor(type).code, status: "inactive" },
    });

    const token = await signToken({ userId: user.id, email: user.email });
    await setAuthCookie(token);

    return NextResponse.json({ user }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
