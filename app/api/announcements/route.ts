import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const courseId = new URL(req.url).searchParams.get("courseId");

    const announcements = await prisma.announcement.findMany({
      where: courseId ? { courseId } : undefined,
      include: { author: { select: { name: true, role: true } } },
      orderBy: { createdAt: "desc" },
      take: 30,
    });
    return ok(announcements);
  } catch (e) { return handleApiError(e); }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN") return forbidden();

    const body = await req.json();
    const { courseId, title, content } = body;
    if (!courseId || !title || !content) return badRequest("courseId, title and content required");

    const announcement = await prisma.announcement.create({
      data: { courseId, title, content, authorId: session.user.id },
    });

    const enrollments = await prisma.enrollment.findMany({ where: { courseId }, select: { studentId: true } });
    if (enrollments.length > 0) {
      await prisma.notification.createMany({
        data: enrollments.map((e) => ({
          userId:      e.studentId,
          type:        "ANNOUNCEMENT" as const,
          title:       `New announcement: ${title}`,
          message:     content.slice(0, 120),
          metadata:    { courseId },
        })),
      });
    }

    return ok(announcement, "Announcement posted", 201);
  } catch (e) { return handleApiError(e); }
}
