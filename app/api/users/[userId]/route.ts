import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { userId } = await params;

    if (session.user.id !== userId && session.user.role !== "ADMIN") return forbidden();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id:        true,
        name:      true,
        email:     true,
        role:      true,
        createdAt: true,
        taughtCourses: { select: { id: true, title: true, code: true } },
        enrollments: {
          select: {
            enrolledAt: true,
            course: { select: { id: true, title: true, code: true } },
          },
        },
      },
    });
    if (!user) return notFound("User");
    return ok(user);
  } catch (e) { return handleApiError(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { userId } = await params;
    if (session.user.id !== userId && session.user.role !== "ADMIN") return forbidden();

    const body = await req.json();
    const { role, ...safe } = body;

    const updated = await prisma.user.update({
      where:  { id: userId },
      data:   session.user.role === "ADMIN" ? body : safe,
      select: { id: true, name: true, email: true, role: true },
    });
    return ok(updated);
  } catch (e) { return handleApiError(e); }
}
