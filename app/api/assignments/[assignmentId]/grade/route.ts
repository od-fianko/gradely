import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

export async function POST(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN") return forbidden();

    const { assignmentId } = await params;
    const body = await req.json();
    const { submissionId, marksObtained, feedback, aiFeedback } = body;

    if (!submissionId || marksObtained === undefined)
      return badRequest("submissionId and marksObtained are required");

    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { assignment: { select: { totalMarks: true } } },
    });
    if (!submission || submission.assignmentId !== assignmentId) return notFound("Submission");

    if (marksObtained < 0 || marksObtained > submission.assignment.totalMarks)
      return badRequest(`Marks must be between 0 and ${submission.assignment.totalMarks}`);

    const score = marksObtained;
    const maxScore = submission.assignment.totalMarks;
    const percentage = maxScore ? (score / maxScore) * 100 : 0;

    const combinedFeedback = [feedback, aiFeedback].filter(Boolean).join("\n\n").trim() || undefined;

    const grade = await prisma.grade.upsert({
      where: { submissionId },
      update: {
        score,
        maxScore,
        percentage,
        feedback: combinedFeedback,
        gradedById: session.user.id,
      },
      create: {
        submissionId,
        score,
        maxScore,
        percentage,
        feedback: combinedFeedback,
        gradedById: session.user.id,
      },
    });
    return ok(grade, "Grade saved");
  } catch (e) { return handleApiError(e); }
}
