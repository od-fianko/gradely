import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { runIntegrityCheck } from "@/lib/ai/integrity";

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can run integrity checks");

    const { submissionId } = await req.json();
    if (!submissionId) return badRequest("submissionId is required");

    const result = await runIntegrityCheck(submissionId);
    if (!result) return badRequest("Submission has no analyzable content");
    return ok(result);
  } catch (e) { return handleApiError(e); }
}
