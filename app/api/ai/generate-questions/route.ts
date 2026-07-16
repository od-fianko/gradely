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

    const { topic, description, count = 4, totalMarks } = await req.json();
    if (!topic) return badRequest("topic is required");

    const marksPerQuestion = totalMarks ? Math.floor(totalMarks / count) || 1 : 1;

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{
        role:    "user",
        content: `You are an academic assessment designer. Generate ${count} multiple-choice questions for the following topic.

Topic: ${topic}
${description ? `Context: ${description}` : ""}
Points per question: ${marksPerQuestion}

Rules:
- Each question must have exactly 4 options (A, B, C, D)
- Exactly one option must be correct per question (unless it's a multi-select)
- Distractors should be plausible but clearly wrong on reflection
- Vary difficulty (some easy, some hard)

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "questions": [
    {
      "text": "Question text here?",
      "points": ${marksPerQuestion},
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
