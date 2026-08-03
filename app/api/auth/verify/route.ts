import { ok, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { isOtpValid } from "@/lib/auth/otp";
import { verifyCodeSchema } from "@/features/auth/schemas/auth.schema";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = verifyCodeSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);
    const { email, code } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return badRequest("Account not found");

    if (!user.isVerified) {
      if (!isOtpValid(code, user.verificationCodeHash, user.verificationCodeExpiresAt)) {
        return badRequest("Invalid or expired verification code");
      }
      await prisma.user.update({
        where: { email },
        data: { isVerified: true, verificationCodeHash: null, verificationCodeExpiresAt: null },
      });
    }

    // Accounts created via step 1 (email only) still need name/password/level
    // before they can sign in — the client uses this to decide where to go next.
    return ok({ needsProfile: !user.password }, "Email verified successfully");
  } catch (e) { return handleApiError(e); }
}
