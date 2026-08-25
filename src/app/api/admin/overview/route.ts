import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

// GET /api/admin/overview — headline counts for the admin hub.
export async function GET() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [pendingConsultants, approvedConsultants, bookings, courses, publishedCourses, certificates, pendingPayouts] =
    await Promise.all([
      db.consultantProfile.count({ where: { status: "pending" } }),
      db.consultantProfile.count({ where: { status: "approved" } }),
      db.consultationBooking.count(),
      db.course.count(),
      db.course.count({ where: { status: "published" } }),
      db.certificate.count(),
      db.consultantPayout.count({ where: { status: "pending" } }),
    ]);

  return NextResponse.json({
    pendingConsultants,
    approvedConsultants,
    bookings,
    courses,
    publishedCourses,
    certificates,
    pendingPayouts,
  });
}
