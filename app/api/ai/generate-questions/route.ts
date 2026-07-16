import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { extractJson } from "@/lib/ai/extract-json";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can generate questions");

    const { instructions, topic, description, totalMarks } = await req.json();
    const brief = (instructions ?? topic ?? "").trim();
    if (!brief) return badRequest("Tell the AI what you want — topic, number of questions, difficulty…");

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages: [{
        role:    "user",
        content: `You are an academic assessment designer helping a university lecturer build a multiple-choice quiz.

The lecturer's request, in their own words:
"""
${brief}
"""

${description ? `Assignment context: ${description}` : ""}
${totalMarks ? `Total marks available for the quiz: ${totalMarks}` : ""}

Follow the lecturer's request faithfully:
- If they specify a number of questions, generate exactly that many. Otherwise generate 4.
- If they specify difficulty (easy/medium/hard, or a mix), match it. Otherwise vary difficulty.
- If they name subtopics or constraints, honor them.
- Distribute points sensibly across questions (integers; if total marks are given, points should sum close to it).

Rules:
- Each question must have exactly 4 options
- Exactly one option is correct per question (unless the lecturer asks for multi-select)
- Distractors should be plausible but clearly wrong on reflection

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "questions": [
    {
      "text": "Question text here?",
      "points": 1,
      "isMultiple": false,
      "options": [
        { "text": "Option A", "isCorrect": false },
        { "text": "Option B", "isCorrect": true },
        { "text": "Option C", "isCorrect": false },
        { "text": "Option D", "isCorrect": false }
      ]
    }
  ]
}`,
      }],
    });

    const raw  = (message.content[0] as { type: string; text: string }).text.trim();
    const json = extractJson(raw);
    return ok(json);
  } catch (e) { return handleApiError(e); }
}
