import { ok, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { startRegisterSchema } from "@/features/auth/schemas/auth.schema";
import { generateOtpCode, hashOtpCode } from "@/lib/auth/otp";
import { getEmailDomain, getUniversityNameFromDomain, isLikelyUniversityEmail, normalizeUniversityDomain } from "@/lib/university";
import { sendMail } from "@/lib/email/mailer";

/**
 * Step 1 of registration: only an email address. Confirms ownership via a
 * mailed OTP before anything else (name, password, level) is collected —
 * matching how most professional signup flows verify email first.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = startRegisterSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);

    const { email } = parsed.data;
    if (!isLikelyUniversityEmail(email)) return badRequest("Please use a valid university email address");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing?.isVerified) return badRequest("An account with this email already exists. Try signing in instead.");

    const domain = normalizeUniversityDomain(getEmailDomain(email));
    const university = await prisma.university.upsert({
      where: { domain },
      update: {},
      create: { domain, name: getUniversityNameFromDomain(domain) },
    });

    const otp = generateOtpCode();
    const otpHash = hashOtpCode(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Re-request on an existing-but-unverified email just refreshes the code
    // rather than erroring — the person may have lost the first one.
    if (existing) {
      await prisma.user.update({
        where: { email },
        data: { verificationCodeHash: otpHash, verificationCodeExpiresAt: expiresAt, universityId: university.id },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          name: "", // filled in at step 3, once the email is verified
          universityId: university.id,
          isVerified: false,
          verificationCodeHash: otpHash,
          verificationCodeExpiresAt: expiresAt,
        },
      });
    }

    const sent = await sendMail({
      to: email,
      subject: "Your Gradely verification code",
      text: `Your verification code is ${otp}. It expires in 15 minutes.`,
      html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>This code expires in 15 minutes.</p>`,
    });
    if (!sent) console.warn(`[register/start] SMTP not configured — verification code for ${email}: ${otp}`);

    return ok({ email }, "Verification code sent", 201);
  } catch (e) { return handleApiError(e); }
}
