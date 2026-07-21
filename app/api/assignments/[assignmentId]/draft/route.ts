import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

/**
 * Lightweight autosave for an in-progress code attempt. Unlike the real
 * submissions endpoint, this never marks the submission SUBMITTED, never
 * triggers grading, and never runs the integrity check — it only keeps the
 * student's latest keystrokes safe if they close the tab mid-attempt.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "STUDENT") return forbidden("Only students can save a draft");
    const { assignmentId } = await params;

    const { code, language } = await req.json();
    if (typeof code !== "string") return badRequest("code is required");

    const submission = await prisma.submission.findFirst({
      where: { assignmentId, studentId: session.user.id },
    });
    if (!submission) return notFound("Attempt not started");
    if (submission.status !== "DRAFT") return badRequest("This attempt has already been submitted");

    await prisma.codeSubmission.upsert({
      where:  { submissionId: submission.id },
      update: { code, language: language ?? "PYTHON" },
      create: { submissionId: submission.id, code, language: language ?? "PYTHON" },
    });

    return ok({ savedAt: new Date().toISOString() });
  } catch (e) { return handleApiError(e); }
}
