import { ok, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/features/auth/schemas/auth.schema";
import bcrypt from "bcryptjs";
import { generateOtpCode, hashOtpCode } from "@/lib/auth/otp";
import { getEmailDomain, getUniversityNameFromDomain, isLikelyUniversityEmail, normalizeUniversityDomain } from "@/lib/university";
import { sendMail } from "@/lib/email/mailer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);

    const { name, email, password, level } = parsed.data;
    if (!isLikelyUniversityEmail(email)) return badRequest("Please use a valid university email address");

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return badRequest("An account with this email already exists");

    const domain = normalizeUniversityDomain(getEmailDomain(email));
    const university = await prisma.university.upsert({
      where: { domain },
      update: {},
      create: { domain, name: getUniversityNameFromDomain(domain) },
    });

    const hashed = await bcrypt.hash(password, 12);
    const otp = generateOtpCode();
    const otpHash = hashOtpCode(otp);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    await prisma.user.create({
      data: {
        name,
        email,
        password: hashed,
        level,
        universityId: university.id,
        isVerified: false,
        verificationCodeHash: otpHash,
        verificationCodeExpiresAt: expiresAt,
      },
    });

    const sent = await sendMail({
      to: email,
      subject: "Your Gradely verification code",
      text: `Your verification code is ${otp}. It expires in 15 minutes.`,
      html: `<p>Your verification code is <strong>${otp}</strong>.</p><p>This code expires in 15 minutes.</p>`,
    });
    // No SMTP configured (e.g. local dev) — surface the code in server logs so
    // the verification flow is still usable instead of silently unreachable.
    if (!sent) console.warn(`[register] SMTP not configured — verification code for ${email}: ${otp}`);

    return ok({ email }, "Account created. Check your mail for the verification code.", 201);
  } catch (e) { return handleApiError(e); }
}
