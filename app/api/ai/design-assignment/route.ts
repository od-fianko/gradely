import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { extractJson } from "@/lib/ai/extract-json";
import { fileToContentBlocks } from "@/lib/ai/file-content";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

/**
 * The "Custom — describe it to the AI" flow. The lecturer writes what they
 * want in plain language (optionally attaching slides); Claude decides the
 * best assignment structure and returns a complete draft the lecturer can
 * review and edit before creating.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can design assignments");

    const form         = await req.formData();
    const instructions = String(form.get("instructions") ?? "").trim();
    const totalMarks   = Number(form.get("totalMarks") ?? 100);
    const file         = form.get("file") as File | null;

    if (!instructions) return badRequest("Describe the assignment you want the AI to design");

    const prompt = `You are an expert academic assessment designer. A university lecturer will describe, in their own words, the assignment they want. Design it fully. If slides are attached, base all content on the slide material.

The lecturer's request:
"""
${instructions}
"""

Total marks available: ${totalMarks}

First decide the best structure for what they asked:
- "MULTIPLE_CHOICE" — a question set. Supports a MIX of "MCQ" questions (4 options, one correct, auto-graded) and "SHORT_TEXT" theory questions (written answer, lecturer-graded). Use this for quizzes, mixed MCQ+theory assessments, or pure theory question sets.
- "PROGRAMMING" — one coding exercise with starter code and stdin/stdout test cases (auto-graded). Use when they want students to write code.
- "SHORT_ANSWER" — ONE essay-style question with a grading rubric. Use for a single extended-response task.

Honor everything the lecturer specified: counts, difficulty levels, topics, mark distribution. Fill sensible defaults for anything unspecified. Points must be integers and should sum close to the total marks.

Return ONLY valid JSON (no markdown). Include exactly the fields for the chosen type:

For MULTIPLE_CHOICE:
{
  "type": "MULTIPLE_CHOICE",
  "title": "short assignment title",
  "description": "instructions shown to students",
  "questions": [
    { "kind": "MCQ", "text": "...", "points": 2, "difficulty": "EASY", "isMultiple": false,
      "options": [ {"text":"...","isCorrect":false}, {"text":"...","isCorrect":true}, {"text":"...","isCorrect":false}, {"text":"...","isCorrect":false} ] },
    { "kind": "SHORT_TEXT", "text": "Explain...", "points": 10, "difficulty": "HARD", "isMultiple": false, "options": [], "sampleAnswer": "A full-marks answer covers..." }
  ]
}

For PROGRAMMING:
{
  "type": "PROGRAMMING",
  "title": "...",
  "description": "problem statement for students",
  "difficulty": "EASY" | "MEDIUM" | "HARD",
  "starterCode": "python starter template or empty string",
  "testCases": [ { "title": "...", "input": "stdin", "expectedOutput": "stdout", "points": 5, "isHidden": false } ]
}

For SHORT_ANSWER:
{
  "type": "SHORT_ANSWER",
  "title": "...",
  "description": "the essay question, written for students",
  "rubric": "3-5 bullet grading rubric"
}`;

    let content: Anthropic.ContentBlockParam[] = [{ type: "text", text: prompt }];
    if (file) {
      try {
        content = await fileToContentBlocks(file, prompt);
      } catch (e) {
        if (e instanceof Error && e.message === "FILE_TOO_LARGE")   return badRequest("File must be under 4 MB");
        if (e instanceof Error && e.message === "UNSUPPORTED_FILE") return badRequest("Attach a PDF, PPTX, JPG, PNG, or WEBP");
        if (e instanceof Error && e.message === "NO_SLIDES")        return badRequest("No slides found in that .pptx");
        throw e;
      }
    }

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages:   [{ role: "user", content }],
    });

    const raw  = (message.content[0] as { type: string; text: string }).text.trim();
    const json = extractJson<{ type?: string }>(raw);
    if (!json.type || !["MULTIPLE_CHOICE", "PROGRAMMING", "SHORT_ANSWER"].includes(json.type))
      return badRequest("The AI could not settle on an assignment structure — try rephrasing your request");
    return ok(json);
  } catch (e) { return handleApiError(e); }
}
