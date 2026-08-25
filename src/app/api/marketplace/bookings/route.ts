import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { bookingNotificationEmail, sendMailSafe } from "@/lib/mail";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

function baseUrl(req: Request): string {
  return process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || new URL(req.url).origin;
}

// GET /api/marketplace/bookings — the caller's bookings, both as a client and
// (if they are a consultant) the requests made to them. ?role=client|consultant
export async function GET(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = new URL(req.url).searchParams.get("role");
  const profile = await db.consultantProfile.findUnique({ where: { userId: session.userId }, select: { id: true } });

  const asClient =
    role === "consultant"
      ? []
      : await db.consultationBooking.findMany({
          where: { clientId: session.userId },
          orderBy: { createdAt: "desc" },
          include: {
            consultant: { select: { id: true, headline: true, user: { select: { name: true } } } },
            review: true,
          },
        });

  const asConsultant =
    role === "client" || !profile
      ? []
      : await db.consultationBooking.findMany({
          where: { consultantId: profile.id },
          orderBy: { createdAt: "desc" },
          include: { client: { select: { name: true, email: true } }, review: true },
        });

  return NextResponse.json({ asClient, asConsultant, isConsultant: Boolean(profile) });
}

// POST /api/marketplace/bookings — a client requests a booking with a
// consultant. Priced from the consultant's hourly rate × duration.
export async function POST(req: Request) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const consultantId = String(body.consultantId ?? "");
  const topic = String(body.topic ?? "").trim();
  const message = body.message ? String(body.message).trim() : null;
  const datasetId = body.datasetId ? String(body.datasetId) : null;
  const durationMins = [30, 60, 90, 120].includes(Number(body.durationMins)) ? Number(body.durationMins) : 60;
  const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : null;

  if (!consultantId || !topic) {
    return NextResponse.json({ error: "Consultant and topic are required." }, { status: 400 });
  }

  const consultant = await db.consultantProfile.findUnique({
    where: { id: consultantId },
    select: { id: true, status: true, hourlyRateKobo: true, userId: true, user: { select: { email: true, name: true } } },
  });
  if (!consultant || consultant.status !== "approved") {
    return NextResponse.json({ error: "Consultant is not available." }, { status: 404 });
  }
  if (consultant.userId === session.userId) {
    return NextResponse.json({ error: "You can't book yourself." }, { status: 400 });
  }

  const amountKobo = Math.round((consultant.hourlyRateKobo * durationMins) / 60);

  const booking = await db.consultationBooking.create({
    data: {
      clientId: session.userId,
      consultantId,
      topic,
      message,
      datasetId,
      durationMins,
      scheduledAt: scheduledAt && !isNaN(scheduledAt.getTime()) ? scheduledAt : null,
      amountKobo,
      status: "requested",
    },
  });

  const tmpl = bookingNotificationEmail({
    heading: "New consultation request",
    body: `You have a new consultation request: "${topic}".`,
    url: `${baseUrl(req)}/dashboard/consulting/console`,
    cta: "Review request",
  });
  await sendMailSafe({ to: consultant.user.email, subject: "New consultation request", html: tmpl.html, text: tmpl.text });

  return NextResponse.json({ booking }, { status: 201 });
}
