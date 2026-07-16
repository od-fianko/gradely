import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { extractJson } from "@/lib/ai/extract-json";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can use AI grading");

    const body = await req.json();
    const { submissionId, answer, rubric, totalMarks } = body;

    if (!submissionId || !answer || !totalMarks)
      return badRequest("submissionId, answer and totalMarks are required");

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role:    "user",
          content: `You are an academic grader. Grade this short-answer submission and return JSON only.

RUBRIC: ${rubric ?? "Grade based on accuracy, completeness, and clarity."}
TOTAL MARKS: ${totalMarks}
STUDENT ANSWER: ${answer}

Return exactly this JSON (no extra text):
{
  "suggestedScore": <number 0-${totalMarks}>,
  "feedback": "<2-3 sentence constructive feedback for the student>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "weaknesses": ["<weakness 1>"]
}`,
        },
      ],
    });

    const raw  = (message.content[0] as { type: string; text: string }).text;
    const json = extractJson<{ suggestedScore?: number; feedback?: string; strengths?: string[]; weaknesses?: string[] }>(raw);

    await prisma.shortAnswerSubmission.updateMany({
      where: { submissionId },
      data:  {
        aiSuggestedScore: Math.round(json.suggestedScore ?? 0),
        aiStrengths:      json.strengths   ?? [],
        aiWeaknesses:     json.weaknesses  ?? [],
        aiSuggestions:    [],
        aiProcessedAt:    new Date(),
      },
    });

    return ok(json);
  } catch (e) { return handleApiError(e); }
}
