/* Shared authorization for datasets.
 *
 * A dataset is accessible to its owner, and — when it is linked to a project —
 * to anyone who owns or collaborates on that project. DELETE remains owner-only
 * (enforced by callers checking `role === "owner"`).
 */

export type DatasetRole = "owner" | "collaborator";

export interface DatasetAccessOk<T> {
  ok: true;
  role: DatasetRole;
  dataset: T;
}
export type DatasetAccess<T> = DatasetAccessOk<T> | { ok: false; status: 404 | 403 };

/**
 * Resolve a user's access to a dataset. Pass the Prisma `select` you need via
 * `select` (it is always extended with the fields required for the auth check).
 */
export async function resolveDatasetAccess<T extends { ownerId: string; projectId: string | null }>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  datasetId: string,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  select: Record<string, any>
): Promise<DatasetAccess<T>> {
  const dataset = (await db.dataset.findUnique({
    where: { id: datasetId },
    select: { ownerId: true, projectId: true, ...select },
  })) as T | null;

  if (!dataset) return { ok: false, status: 404 };

  if (dataset.ownerId === userId) return { ok: true, role: "owner", dataset };

  if (dataset.projectId) {
    const project = await db.project.findUnique({
      where: { id: dataset.projectId },
      select: { ownerId: true, collaborators: { select: { userId: true } } },
    });
    if (
      project &&
      (project.ownerId === userId ||
        project.collaborators.some((c: { userId: string }) => c.userId === userId))
    ) {
      return { ok: true, role: "collaborator", dataset };
    }
  }

  return { ok: false, status: 403 };
}
