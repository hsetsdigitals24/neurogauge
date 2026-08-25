import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

// Load a booking + resolve the caller's relationship to it.
async function loadBookingFor(userId: string, id: string) {
  const booking = await db.consultationBooking.findUnique({
    where: { id },
    include: { consultant: { select: { id: true, userId: true } } },
  });
  if (!booking) return { booking: null, isClient: false, isConsultant: false };
  return {
    booking,
    isClient: booking.clientId === userId,
    isConsultant: booking.consultant.userId === userId,
  };
}

export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const { booking, isClient, isConsultant } = await loadBookingFor(session.userId, id);
  if (!booking || (!isClient && !isConsultant)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ booking, role: isConsultant ? "consultant" : "client" });
}

// PATCH — status transitions + meeting link.
//   consultant: confirm | complete | cancel, set meetingUrl
//   client:     cancel
// Completing a paid booking posts the consultant's earnings to the payout ledger.
export async function PATCH(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const { booking, isClient, isConsultant } = await loadBookingFor(session.userId, id);
  if (!booking || (!isClient && !isConsultant)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "");
  const data: Record<string, unknown> = {};

  if (action === "confirm") {
    if (!isConsultant) return NextResponse.json({ error: "Only the consultant can confirm." }, { status: 403 });
    if (booking.status !== "requested") return NextResponse.json({ error: "Can't confirm this booking." }, { status: 400 });
    data.status = "confirmed";
    if (typeof body.meetingUrl === "string") data.meetingUrl = body.meetingUrl.trim() || null;
    if (typeof body.scheduledAt === "string") {
      const d = new Date(body.scheduledAt);
      if (!isNaN(d.getTime())) data.scheduledAt = d;
    }
  } else if (action === "complete") {
    if (!isConsultant) return NextResponse.json({ error: "Only the consultant can complete." }, { status: 403 });
    if (!["confirmed", "paid"].includes(booking.status)) {
      return NextResponse.json({ error: "Only a confirmed/paid booking can be completed." }, { status: 400 });
    }
    data.status = "completed";
  } else if (action === "cancel") {
    if (["completed", "cancelled"].includes(booking.status)) {
      return NextResponse.json({ error: "Can't cancel this booking." }, { status: 400 });
    }
    data.status = "cancelled";
  } else if (action === "setMeeting") {
    if (!isConsultant) return NextResponse.json({ error: "Only the consultant can set the link." }, { status: 403 });
    data.meetingUrl = typeof body.meetingUrl === "string" ? body.meetingUrl.trim() || null : null;
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }

  const updated = await db.consultationBooking.update({ where: { id }, data });

  // On completing a booking that was actually paid, record the consultant's
  // earnings to the payout ledger (idempotency: only if none exists yet).
  if (action === "complete" && booking.status === "paid" && (booking.consultantEarningsKobo ?? 0) > 0) {
    const existing = await db.consultantPayout.findFirst({ where: { consultantId: booking.consultant.id, note: `booking:${booking.id}` } });
    if (!existing) {
      await db.consultantPayout.create({
        data: {
          consultantId: booking.consultant.id,
          amountKobo: booking.consultantEarningsKobo,
          status: "pending",
          note: `booking:${booking.id}`,
        },
      });
    }
  }

  return NextResponse.json({ booking: updated });
}
