import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// Platform-admin resolution. An admin is either flagged in the DB
// (`User.isAdmin`) or listed in the `ADMIN_EMAILS` env (comma-separated) — the
// env path lets the very first admin be bootstrapped without a DB write.

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isAdminUser(user: { email?: string | null; isAdmin?: boolean | null } | null | undefined): boolean {
  if (!user) return false;
  if (user.isAdmin) return true;
  const email = (user.email ?? "").toLowerCase();
  return email !== "" && adminEmails().has(email);
}

export interface AdminUser {
  userId: string;
  email: string;
}

/**
 * Resolve the current session user and confirm they are a platform admin.
 * Returns the admin identity, or null when unauthenticated / not an admin —
 * callers map null to 401/403.
 */
export async function requireAdmin(): Promise<AdminUser | null> {
  const session = await getSessionUser();
  if (!session) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const user = await (prisma as any).user.findUnique({
    where: { id: session.userId },
    select: { id: true, email: true, isAdmin: true },
  });
  if (!isAdminUser(user)) return null;
  return { userId: session.userId, email: session.email };
}
