import { ok, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { registerSchema } from "@/features/auth/schemas/auth.schema";
import { generateOtpCode, hashOtpCode } from "@/lib/auth/otp";
import { getEmailDomain, getUniversityNameFromDomain, isLikelyUniversityEmail, normalizeUniversityDomain } from "@/lib/university";
import { sendMail } from "@/lib/email/mailer";
import bcrypt from "bcryptjs";

/**
 * Registration: name, role, level/program, and password are all collected
 * up front and the account is created immediately (unverified) — an OTP
 * just confirms the email before sign-in works, rather than gating profile
 * collection behind it. Re-submitting on an existing-but-unverified email
 * (lost the first code, or changed a field) just refreshes it.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);

    const { email, role, name, level, program, password } = parsed.data;
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
    const hashedPassword = await bcrypt.hash(password, 12);

    const data = {
      name, role, password: hashedPassword,
      level: role === "STUDENT" ? level : null,
      program: program?.trim() || null,
      universityId: university.id,
      isVerified: false,
      verificationCodeHash: otpHash,
      verificationCodeExpiresAt: expiresAt,
    };

    await prisma.user.upsert({
      where: { email },
      update: data,
      create: { email, ...data },
    });

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
