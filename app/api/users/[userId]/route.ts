import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { Prisma } from "@prisma/client";

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
    const isAdminEdit = session.user.role === "ADMIN";

    // Demoting an admin or deactivating their account can lock everyone out
    // of admin functionality with no way back in — guard both the target's
    // own attempt on themselves and an admin doing it to the last other admin.
    const revokesAdminAccess = (typeof role === "string" && role !== "ADMIN")
      || (typeof body.isActive === "boolean" && body.isActive === false);
    if (isAdminEdit && revokesAdminAccess) {
      const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
      if (target?.role === "ADMIN") {
        if (userId === session.user.id) return badRequest("You can't remove your own admin access");
        const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
        if (adminCount <= 1) return badRequest("Can't remove the last admin account's access");
      }
    }

    const updated = await prisma.user.update({
      where:  { id: userId },
      data:   isAdminEdit ? body : safe,
      select: { id: true, name: true, email: true, role: true, isActive: true },
    });
    return ok(updated);
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "ADMIN") return forbidden("Only admins can delete users");
    const { userId } = await params;

    if (userId === session.user.id) return badRequest("You can't delete your own account");

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
    if (!target) return notFound("User");

    if (target.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
      if (adminCount <= 1) return badRequest("Can't delete the last admin account");
    }

    try {
      await prisma.user.delete({ where: { id: userId } });
    } catch (e) {
      // FK constraint: this user has courses, submissions, grades, etc. still
      // pointing at them. Deleting through those would destroy academic
      // records for potentially many other people — refuse rather than
      // cascade silently, and point the admin at deactivation instead.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
        return badRequest("This user has courses, submissions, or grades on record — deactivate the account instead of deleting it.");
      }
      throw e;
    }

    return ok(null, "User deleted");
  } catch (e) { return handleApiError(e); }
}
