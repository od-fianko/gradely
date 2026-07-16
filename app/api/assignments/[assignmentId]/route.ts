import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        course:             { select: { id: true, title: true, code: true } },
        programmingDetails: { include: { testCases: { orderBy: { order: "asc" } } } },
        quizDetails:        { include: { questions: { include: { options: { orderBy: { order: "asc" } } }, orderBy: { order: "asc" } } } },
        shortAnswerDetails: true,
        fileUploadDetails:  true,
        _count:             { select: { submissions: true } },
      },
    });
    if (!assignment) return notFound("Assignment");

    const role = session.user.role;
    if (role === "STUDENT" && !assignment.isPublished)
      return notFound("Assignment");

    if (role === "STUDENT" && assignment.quizDetails?.questions) {
      assignment.quizDetails.questions.forEach((q: any) => {
        q.options?.forEach((o: any) => { delete o.isCorrect; });
      });
    }

    return ok(assignment);
  } catch (e) { return handleApiError(e); }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN") return forbidden();
    const { assignmentId } = await params;

    const body = await req.json();
    const { dueDate, ...rest } = body;

    const updated = await prisma.assignment.update({
      where: { id: assignmentId },
      data: { ...rest, ...(dueDate && { dueDate: new Date(dueDate) }) },
    });
    return ok(updated);
  } catch (e) { return handleApiError(e); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN") return forbidden();
    const { assignmentId } = await params;

    await prisma.assignment.delete({ where: { id: assignmentId } });
    return ok(null, "Assignment deleted");
  } catch (e) { return handleApiError(e); }
}
