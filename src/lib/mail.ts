import nodemailer from "nodemailer";

let cachedTransport: nodemailer.Transporter | null = null;

function getTransport() {
  if (cachedTransport) return cachedTransport;

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS."
    );
  }

  cachedTransport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return cachedTransport;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}) {
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER!;
  const transport = getTransport();
  await transport.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });
}

export function passwordResetEmail(resetUrl: string, name: string) {
  const safeName = name || "there";
  const text = `Hi ${safeName},

We received a request to reset your Neurogauge password. Click the link below to choose a new one. This link expires in 1 hour.

${resetUrl}

If you did not request this, you can safely ignore this email.

— Neurogauge`;

  const html = `<!doctype html>
<html>
  <body style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; background:#f6f7fb; padding:24px; color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #e5e7eb;">
      <tr><td>
        <h2 style="margin:0 0 12px;font-size:20px;">Reset your password</h2>
        <p style="margin:0 0 16px;">Hi ${safeName}, we received a request to reset your Neurogauge password.</p>
        <p style="margin:0 0 24px;">Click the button below to choose a new one. This link expires in 1 hour.</p>
        <p style="margin:0 0 24px;">
          <a href="${resetUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;">Reset password</a>
        </p>
        <p style="margin:0 0 8px;font-size:13px;color:#64748b;">Or paste this link into your browser:</p>
        <p style="margin:0 0 24px;font-size:13px;word-break:break-all;"><a href="${resetUrl}" style="color:#4f46e5;">${resetUrl}</a></p>
        <p style="margin:0;font-size:13px;color:#64748b;">If you did not request this, you can safely ignore this email.</p>
      </td></tr>
    </table>
  </body>
</html>`;

  return { html, text };
}
