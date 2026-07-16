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
      return forbidden("Only lecturers can generate rubrics");

    const { title, description, totalMarks } = await req.json();
    if (!title || !totalMarks) return badRequest("title and totalMarks required");

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 512,
      messages: [{
        role:    "user",
        content: `You are an academic assessment designer. Create a concise grading rubric for the following short-answer assignment.

Assignment title: ${title}
${description ? `Description: ${description}` : ""}
Total marks: ${totalMarks}

Write a rubric in 3-5 bullet points that a lecturer can use to grade student responses. Focus on:
- Content accuracy and completeness
- Depth of understanding
- Clarity and structure

Return ONLY the rubric text (bullet points), no preamble or extra commentary.`,
      }],
    });

    const rubric = (message.content[0] as { type: string; text: string }).text.trim();
    return ok({ rubric });
  } catch (e) { return handleApiError(e); }
}
