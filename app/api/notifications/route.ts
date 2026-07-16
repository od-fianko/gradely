import { auth } from "@/lib/auth/auth";
import { ok, unauthorized } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const notifications = await prisma.notification.findMany({
      where:   { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take:    30,
    });
    return ok(notifications);
  } catch (e) { return handleApiError(e); }
}
