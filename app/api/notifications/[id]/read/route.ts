import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function PATCH(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { id } = await params;

    const notification = await prisma.notification.findUnique({ where: { id } });
    if (!notification || notification.userId !== session.user.id) return forbidden();

    await prisma.notification.update({ where: { id }, data: { isRead: true } });
    return ok(null, "Marked as read");
  } catch (e) { return handleApiError(e); }
}
