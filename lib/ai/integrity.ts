import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "@/lib/db/prisma";
import { extractJson } from "./extract-json";

const client = new Anthropic();

const FLAG_THRESHOLD = 70;

interface IntegrityResult {
  score:   number;
  verdict: string;
  reasons: string[];
}

/**
 * Analyzes a submission's answer/code for signs of AI-generation or
 * verbatim copying, stores the result on the Submission, and — when
 * flagged — notifies both the student and the course lecturer.
 * Safe to call fire-and-forget: throws are the caller's job to catch.
 */
export async function runIntegrityCheck(submissionId: string): Promise<IntegrityResult | null> {
  const submission = await prisma.submission.findUnique({
    where:   { id: submissionId },
    include: {
      assignment: {
        select: {
          id: true, title: true, description: true, type: true,
          course: { select: { id: true, code: true, lecturerId: true } },
        },
      },
      student:               { select: { id: true, name: true } },
      shortAnswerSubmission: { select: { answer: true } },
      codeSubmission:        { select: { code: true, language: true } },
      quizSubmission: {
        select: {
          answers: {
            select: { textAnswer: true, question: { select: { text: true, kind: true } } },
          },
        },
      },
    },
  });
  if (!submission) return null;

  // Written theory answers inside a mixed quiz are also screenable
  const quizTheoryText = (submission.quizSubmission?.answers ?? [])
    .filter((a) => a.question.kind === "SHORT_TEXT" && a.textAnswer?.trim())
    .map((a) => `Q: ${a.question.text}\nA: ${a.textAnswer}`)
    .join("\n\n");

  const isCode = !!submission.codeSubmission;
  const work   = submission.shortAnswerSubmission?.answer
    ?? submission.codeSubmission?.code
    ?? (quizTheoryText || null);
  if (!work || work.trim().length < 40) return null;

  const message = await client.messages.create({
    model:      "claude-haiku-4-5-20251001",
    max_tokens: 768,
    messages: [{
      role:    "user",
      content: `You are an academic integrity reviewer at a university. Assess whether this student submission was likely produced by an AI assistant or copied verbatim from a website, rather than being the student's own attempt.

Assignment: ${submission.assignment.title}
Task given to the student: ${submission.assignment.description}
Submission type: ${isCode ? `code (${submission.codeSubmission?.language})` : "written answer"}

Student's submission:
"""
${work.slice(0, 6000)}
"""

Signals of AI generation / copying include (non-exhaustive):
- Assistant artifacts: "Certainly!", "As an AI", "Here's a solution", markdown formatting in a plain-text answer, numbered tutorial structure
- Polish far beyond a student attempt: flawless prose, textbook-perfect phrasing, exhaustive edge-case handling nobody asked for
- Code: tutorial-style comments narrating every line, generic variable names from common AI output, boilerplate docstrings, solutions using idioms not implied by the task
- Content that answers a *generalized* version of the question rather than the specific task given
- Written answers that read like an encyclopedia/blog rather than a student voice

Signals of genuine student work: minor typos, informal phrasing, partial solutions, idiosyncratic approaches, comments in the student's own voice, imperfect but reasoned attempts.

Be fair: strong students write clean work. Only assign a high score when multiple independent signals point the same way. Uncertainty should lower the score.

Return ONLY valid JSON:
{
  "score": <0-100 integer, likelihood this is AI-generated or copied>,
  "verdict": "<one short phrase, e.g. 'Likely original work' / 'Possibly AI-assisted' / 'Likely AI-generated'>",
  "reasons": ["<specific observable signal 1>", "<signal 2>"]
}`,
    }],
  });

  const raw    = (message.content[0] as { type: string; text: string }).text;
  const result = extractJson<IntegrityResult>(raw);
  const score  = Math.max(0, Math.min(100, Math.round(result.score ?? 0)));
  const flagged = score >= FLAG_THRESHOLD;

  await prisma.submission.update({
    where: { id: submissionId },
    data: {
      integrityScore:     score,
      integrityVerdict:   result.verdict?.slice(0, 120) ?? null,
      integrityReason:    (result.reasons ?? []).join(" • ").slice(0, 2000) || null,
      integrityFlagged:   flagged,
      integrityCheckedAt: new Date(),
    },
  });

  if (flagged) {
    await prisma.notification.createMany({
      data: [
        {
          userId:  submission.student.id,
          type:    "INTEGRITY_FLAG",
          title:   `Academic integrity notice: ${submission.assignment.title}`,
          message: `Your submission was flagged as possibly AI-generated or copied (${score}% confidence). Your lecturer has been notified. If this is your own work, contact your lecturer.`,
          metadata: { assignmentId: submission.assignment.id, submissionId },
        },
        {
          userId:  submission.assignment.course.lecturerId,
          type:    "INTEGRITY_FLAG",
          title:   `Integrity flag: ${submission.student.name} — ${submission.assignment.title}`,
          message: `${result.verdict ?? "Flagged"} (${score}%). ${(result.reasons ?? [])[0] ?? ""}`.slice(0, 200),
          metadata: { assignmentId: submission.assignment.id, submissionId },
        },
      ],
    }).catch(() => null);
  }

  return { score, verdict: result.verdict, reasons: result.reasons ?? [] };
}
