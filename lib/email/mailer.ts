import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT ?? 587);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export function canSendMail() {
  return Boolean(host && user && pass);
}

/** Returns whether the mail was actually sent, so callers without SMTP
 *  configured can fall back to logging (e.g. an OTP code) instead of
 *  silently leaving the recipient with no way to get it. */
export async function sendMail(message: { to: string; subject: string; text: string; html?: string }) {
  if (!canSendMail()) return false;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM ?? user,
    ...message,
  });
  return true;
}
