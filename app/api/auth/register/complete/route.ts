import { ok, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { completeRegisterSchema } from "@/features/auth/schemas/auth.schema";
import bcrypt from "bcryptjs";

/**
 * Step 3 of registration — name, level, program, and password — only
 * accepted once the email has already been OTP-verified (step 2).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = completeRegisterSchema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.errors[0].message);

    const { email, name, level, program, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return badRequest("Account not found — start the sign-up process again");
    if (!user.isVerified) return badRequest("Please verify your email before completing sign-up");
    if (user.password) return badRequest("This account is already fully set up — try signing in");

    const hashed = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { email },
      data: { name, level, program: program?.trim() || null, password: hashed },
    });

    return ok(null, "Account created successfully", 201);
  } catch (e) { return handleApiError(e); }
}
