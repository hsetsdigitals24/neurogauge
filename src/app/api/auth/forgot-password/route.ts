import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { sendMail, passwordResetEmail } from "@/lib/mail";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Missing email" }, { status: 400 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = await (prisma as any).user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    // Always respond success to avoid email enumeration
    if (user) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (prisma as any).passwordResetToken.create({
        data: {
          userId: user.id,
          token: tokenHash,
          expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
        },
      });

      const origin =
        process.env.APP_URL ??
        req.headers.get("origin") ??
        `https://${req.headers.get("host")}`;
      const resetUrl = `${origin}/auth/reset-password?token=${rawToken}`;

      const { html, text } = passwordResetEmail(resetUrl, user.name);
      try {
        await sendMail({
          to: user.email,
          subject: "Reset your Neurogauge password",
          html,
          text,
        });
      } catch (e) {
        console.error("Failed to send reset email", e);
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
