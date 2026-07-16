import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can request AI code review");

    const { code, language, assignmentTitle, assignmentDescription } = await req.json();
    if (!code || !language) return badRequest("code and language are required");

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{
        role:    "user",
        content: `You are an expert programming instructor reviewing a student's code submission.

Assignment: ${assignmentTitle ?? "Programming Assignment"}
${assignmentDescription ? `Description: ${assignmentDescription}` : ""}
Language: ${language}

Student's code:
\`\`\`${language.toLowerCase()}
${code}
\`\`\`

Provide a concise code review for the lecturer. Return ONLY valid JSON (no markdown):
{
  "quality": "excellent" | "good" | "fair" | "poor",
  "summary": "One sentence overall assessment",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["suggestion 1", "suggestion 2"],
  "codeStyle": "Brief comment on code style, naming, readability",
  "complexity": "Brief comment on algorithm/logic complexity"
}`,
      }],
    });

    const raw  = (message.content[0] as { type: string; text: string }).text.trim();
    const json = JSON.parse(raw);
    return ok(json);
  } catch (e) { return handleApiError(e); }
}
