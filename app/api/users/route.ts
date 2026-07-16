import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "ADMIN") return forbidden();

    const { searchParams } = new URL(req.url);
    const role   = searchParams.get("role") ?? undefined;
    const search = searchParams.get("search") ?? undefined;

    const users = await prisma.user.findMany({
      where: {
        ...(role   && { role: role as any }),
        ...(search && {
          OR: [
            { name:  { contains: search, mode: "insensitive" } },
            { email: { contains: search, mode: "insensitive" } },
          ],
        }),
      },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    return ok(users);
  } catch (e) { return handleApiError(e); }
}
