// Helpers for the collaborating-institutions feature (multicenter studies).
// DB access follows the repo convention of `prisma as any`, so these take a
// loosely-typed db handle.

export type InstitutionRole = "owner" | "admin" | "member";

// Short slug used to identify an institution when a project lead links it to a
// project. Globally unique (Institution.code is @unique).
export function slugifyInstitutionCode(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

// Returns the caller's membership row for an institution, or null if they are
// not a member. `db` is the `prisma as any` handle.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getMembership(db: any, institutionId: string, userId: string) {
  return db.institutionMember.findUnique({
    where: { institutionId_userId: { institutionId, userId } },
  });
}

// True when the role can manage members / edit the institution.
export function canManage(role: InstitutionRole | undefined | null): boolean {
  return role === "owner" || role === "admin";
}
