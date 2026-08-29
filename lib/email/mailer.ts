import sgMail from "@sendgrid/mail";

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.SENDGRID_FROM_EMAIL;

if (apiKey) sgMail.setApiKey(apiKey);

export function canSendMail() {
  return Boolean(apiKey && fromEmail);
}

/** Returns whether the mail was actually sent, so callers without SendGrid
 *  configured (or where the send itself fails — bad key, unverified sender,
 *  rate limit) can fall back to logging (e.g. an OTP code) instead of
 *  silently leaving the recipient with no way to get it, or 500ing a request
 *  that otherwise succeeded. Uses SendGrid's HTTPS API (not SMTP) — more
 *  reliable from serverless functions, which sometimes have flaky outbound
 *  SMTP connections. */
export async function sendMail(message: { to: string; subject: string; text: string; html?: string }) {
  if (!canSendMail()) return false;

  try {
    await sgMail.send({
      to:      message.to,
      from:    fromEmail!,
      subject: message.subject,
      text:    message.text,
      html:    message.html ?? message.text,
    });
    return true;
  } catch (e) {
    const err = e as { response?: { body?: unknown } };
    console.error("[mailer] SendGrid send failed:", err.response?.body ?? e);
    return false;
  }
}
