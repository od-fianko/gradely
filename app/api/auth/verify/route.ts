import { ok, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { isOtpValid } from "@/lib/auth/otp";

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) return badRequest("Email and verification code are required");

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return badRequest("Account not found");
    if (user.isVerified) return ok(null, "Account already verified");
    if (!isOtpValid(code, user.verificationCodeHash, user.verificationCodeExpiresAt)) {
      return badRequest("Invalid or expired verification code");
    }

    await prisma.user.update({
      where: { email },
      data: { isVerified: true, verificationCodeHash: null, verificationCodeExpiresAt: null },
    });

    return ok(null, "Email verified successfully");
  } catch (e) { return handleApiError(e); }
}
