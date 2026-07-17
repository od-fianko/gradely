import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 2) return badRequest("Name must be at least 2 characters");

    const user = await prisma.user.update({
      where:  { id: session.user.id },
      data:   { name },
      select: { id: true, name: true, email: true },
    });
    return ok(user, "Profile updated");
  } catch (e) { return handleApiError(e); }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const { currentPassword, newPassword } = await req.json();
    if (typeof newPassword !== "string" || newPassword.length < 8)
      return badRequest("New password must be at least 8 characters");

    const user = await prisma.user.findUnique({
      where:  { id: session.user.id },
      select: { password: true },
    });
    if (!user?.password) return badRequest("Password change is not available for this account");

    const valid = await bcrypt.compare(String(currentPassword ?? ""), user.password);
    if (!valid) return badRequest("Current password is incorrect");

    await prisma.user.update({
      where: { id: session.user.id },
      data:  { password: await bcrypt.hash(newPassword, 10) },
    });
    return ok(null, "Password changed");
  } catch (e) { return handleApiError(e); }
}
