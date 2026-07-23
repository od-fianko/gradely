import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest, notFound } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { extractJson } from "@/lib/ai/extract-json";
import { prisma } from "@/lib/db/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * Cross-student code-similarity screening for a programming assignment —
 * distinct from the per-submission AI/copy-from-web integrity check: this
 * compares students' submissions against EACH OTHER to catch shared/copied
 * solutions. Results are computed live, not persisted (same pattern as the
 * AI code review feature).
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can run similarity checks");

    const { assignmentId } = await req.json();
    if (!assignmentId) return badRequest("assignmentId is required");

    const assignment = await prisma.assignment.findUnique({
      where:  { id: assignmentId },
      select: {
        title: true,
        course: { select: { lecturerId: true } },
        programmingDetails: { select: { similarityThreshold: true } },
      },
    });
    if (!assignment) return notFound("Assignment");
    if (assignment.course.lecturerId !== session.user.id && session.user.role !== "ADMIN") return forbidden();

    const submissions = await prisma.submission.findMany({
      where:   { assignmentId, codeSubmission: { isNot: null } },
      include: { student: { select: { name: true } }, codeSubmission: { select: { code: true, language: true } } },
    });
    if (submissions.length < 2) return badRequest("Need at least 2 code submissions to compare");

    const threshold = assignment.programmingDetails?.similarityThreshold ?? 70;

    const labeled = submissions.map((s, i) => ({
      label: `Student ${i + 1}`,
      name:  s.student.name,
      code:  s.codeSubmission!.code,
    }));

    const listing = labeled.map((l) => `--- ${l.label} ---\n${l.code}`).join("\n\n");

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{
        role:    "user",
        content: `You are screening student code submissions for a programming exercise ("${assignment.title}") for suspicious cross-student similarity — not "did they both write a for-loop" but structural sameness (same unusual variable names, same non-obvious algorithm choice, same comments, same ordering of otherwise-arbitrary steps) that suggests copying or shared authorship rather than independent solutions arriving at similar code because the problem constrains the solution space.

${listing}

Compare every pair. Only report pairs that are genuinely suspicious — most pairs of correct solutions to the same problem will legitimately look somewhat alike; do not flag that alone.

Return ONLY valid JSON (no markdown):
{ "pairs": [ { "a": "Student N", "b": "Student M", "score": <0-100>, "reason": "<specific shared signal>" } ] }`,
      }],
    });

    const raw    = (message.content[0] as { type: string; text: string }).text.trim();
    const parsed = extractJson<{ pairs?: { a: string; b: string; score: number; reason: string }[] }>(raw);

    const nameByLabel = Object.fromEntries(labeled.map((l) => [l.label, l.name]));
    const flagged = (parsed.pairs ?? [])
      .filter((p) => p.score >= threshold)
      .map((p) => ({ studentA: nameByLabel[p.a] ?? p.a, studentB: nameByLabel[p.b] ?? p.b, score: p.score, reason: p.reason }))
      .sort((a, b) => b.score - a.score);

    return ok({ threshold, comparedCount: submissions.length, pairs: flagged });
  } catch (e) { return handleApiError(e); }
}
