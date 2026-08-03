import { ok, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { generateOtpCode, hashOtpCode } from "@/lib/auth/otp";
import { sendMail } from "@/lib/email/mailer";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) return badRequest("Email is required");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return badRequest("Account not found");
    if (user.isVerified) return ok(null, "Account already verified");

    const otp = generateOtpCode();
    await prisma.user.update({
      where: { email },
      data: { verificationCodeHash: hashOtpCode(otp), verificationCodeExpiresAt: new Date(Date.now() + 15 * 60 * 1000) },
    });

    const sent = await sendMail({
      to: email,
      subject: "Your new Gradely verification code",
      text: `Your verification code is ${otp}. It expires in 15 minutes.`,
    });
    if (!sent) console.warn(`[resend] SMTP not configured — verification code for ${email}: ${otp}`);

    return ok(null, "Verification code resent");
  } catch (e) { return handleApiError(e); }
}
