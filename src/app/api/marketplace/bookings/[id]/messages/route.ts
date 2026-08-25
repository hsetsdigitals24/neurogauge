import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = prisma as any;

type Ctx = { params: Promise<{ id: string }> };

// Confirm the caller is a party to the booking (client or consultant).
async function party(userId: string, id: string) {
  const booking = await db.consultationBooking.findUnique({
    where: { id },
    include: { consultant: { select: { userId: true } } },
  });
  if (!booking) return null;
  const isParty = booking.clientId === userId || booking.consultant.userId === userId;
  return isParty ? booking : null;
}

// GET — the message thread for a booking (both parties).
export async function GET(_req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const booking = await party(session.userId, id);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const messages = await db.consultationMessage.findMany({
    where: { bookingId: id },
    orderBy: { createdAt: "asc" },
    include: { sender: { select: { name: true } } },
  });
  return NextResponse.json({ messages, meId: session.userId });
}

// POST — send a message in the thread.
export async function POST(req: Request, ctx: Ctx) {
  const session = await getSessionUser();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const booking = await party(session.userId, id);
  if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.body ?? "").trim();
  if (!text) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });

  const message = await db.consultationMessage.create({
    data: { bookingId: id, senderId: session.userId, body: text },
    include: { sender: { select: { name: true } } },
  });
  return NextResponse.json({ message }, { status: 201 });
}
