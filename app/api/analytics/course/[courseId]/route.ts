import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN") return forbidden();
    const { courseId } = await params;

    const [totalStudents, assignments, grades] = await Promise.all([
      prisma.enrollment.count({ where: { courseId } }),
      prisma.assignment.findMany({
        where: { courseId },
        select: {
          id: true,
          title: true,
          totalMarks: true,
          dueDate: true,
          type: true,
          _count: { select: { submissions: true } },
        },
      }),
      prisma.grade.findMany({
        where: { submission: { assignment: { courseId } } },
        select: {
          score: true,
          submission: {
            select: {
              assignment: { select: { id: true, totalMarks: true, title: true } },
            },
          },
        },
      }),
    ]);

    const assignmentStats = assignments.map((a) => {
      const ag = grades.filter((g) => g.submission.assignment.id === a.id);
      const scores = ag.map((g) => g.score);
      return {
        ...a,
        submissions: a._count.submissions,
        avgScore: scores.length ? scores.reduce((s, m) => s + m, 0) / scores.length : null,
        maxScore: scores.length ? Math.max(...scores) : null,
        minScore: scores.length ? Math.min(...scores) : null,
      };
    });

    const allMarks = grades.map((g) => (g.score / g.submission.assignment.totalMarks) * 100);

    return ok({
      totalStudents,
      totalAssignments: assignments.length,
      overallAvg: allMarks.length ? allMarks.reduce((s, m) => s + m, 0) / allMarks.length : null,
      assignmentStats,
    });
  } catch (e) {
    return handleApiError(e);
  }
}
