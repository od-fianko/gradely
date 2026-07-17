import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

/** Marks the start of a timed attempt. Idempotent — the clock starts once. */
export async function POST(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "STUDENT") return forbidden("Only students can start attempts");
    const { assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where:  { id: assignmentId },
      select: { id: true, isPublished: true, timeLimitMinutes: true },
    });
    if (!assignment || !assignment.isPublished) return notFound("Assignment");

    const submission = await prisma.submission.upsert({
      where:  { studentId_assignmentId: { studentId: session.user.id, assignmentId } },
      update: {}, // existing attempt: never reset the clock
      create: { studentId: session.user.id, assignmentId, status: "DRAFT", startedAt: new Date() },
    });

    // Older submission rows may exist without startedAt — set it once
    const started = submission.startedAt
      ?? (await prisma.submission.update({
            where: { id: submission.id },
            data:  { startedAt: new Date() },
          })).startedAt;

    const deadline = assignment.timeLimitMinutes && started
      ? new Date(started.getTime() + assignment.timeLimitMinutes * 60_000).toISOString()
      : null;

    return ok({ startedAt: started, deadline });
  } catch (e) { return handleApiError(e); }
}
