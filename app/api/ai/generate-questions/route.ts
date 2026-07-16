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
        content: `You are an academic assessment designer helping a university lecturer build an assessment. Questions can be two kinds:
- "MCQ": multiple choice with exactly 4 options, auto-graded
- "SHORT_TEXT": theory / written-answer question the student answers in prose, graded by the lecturer

The lecturer's request, in their own words:
"""
${brief}
"""

${description ? `Assignment context: ${description}` : ""}
${totalMarks ? `Total marks available: ${totalMarks}` : ""}

Follow the lecturer's request faithfully:
- If they specify a number of questions, generate exactly that many. Otherwise generate 4.
- If they specify a mix of MCQ and theory/written/essay questions, produce that mix. If they don't mention theory at all, make every question MCQ.
- If they specify difficulty (easy/medium/hard, or a mix), match it. Otherwise vary difficulty.
- Distribute points sensibly (integers; theory questions usually carry more points than MCQs; if total marks are given, points should sum close to it).

MCQ rules: exactly 4 options; exactly one correct (unless the lecturer asks for multi-select); distractors plausible but clearly wrong on reflection.
SHORT_TEXT rules: the question demands explanation or reasoning, not a one-word answer; include a concise model answer in "sampleAnswer".

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "questions": [
    {
      "kind": "MCQ",
      "text": "Question text here?",
      "points": 1,
      "isMultiple": false,
      "options": [
        { "text": "Option A", "isCorrect": false },
        { "text": "Option B", "isCorrect": true },
        { "text": "Option C", "isCorrect": false },
        { "text": "Option D", "isCorrect": false }
      ]
    },
    {
      "kind": "SHORT_TEXT",
      "text": "Explain why...",
      "points": 5,
      "isMultiple": false,
      "options": [],
      "sampleAnswer": "A full-marks answer would cover..."
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
