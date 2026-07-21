import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { extractJson } from "@/lib/ai/extract-json";
import { fileToRawBlocks } from "@/lib/ai/file-content";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
const MAX_FILES = 3;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can generate questions");

    const form         = await req.formData();
    const instructions = String(form.get("instructions") ?? "").trim();
    const description  = String(form.get("description") ?? "");
    const totalMarks   = Number(form.get("totalMarks") ?? 0) || undefined;
    const files        = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

    if (!instructions) return badRequest("Tell the AI what you want — topic, number of questions, difficulty…");
    if (files.length > MAX_FILES) return badRequest(`Attach at most ${MAX_FILES} source files`);

    const prompt = `You are an academic assessment designer helping a university lecturer build an assessment. Questions can be two kinds:
- "MCQ": multiple choice with exactly 4 options, auto-graded
- "SHORT_TEXT": theory / written-answer question the student answers in prose, graded by the lecturer

${files.length > 0 ? "Base every question on content actually present in the attached source material." : ""}

The lecturer's request, in their own words:
"""
${instructions}
"""

${description ? `Assignment context: ${description}` : ""}
${totalMarks ? `Total marks available: ${totalMarks}` : ""}

Follow the lecturer's request faithfully:
- If they specify a number of questions, generate exactly that many. Otherwise generate 4.
- If they specify a mix of MCQ and theory/written/essay questions, produce that mix. If they don't mention theory at all, make every question MCQ.
- If they specify difficulty (easy/medium/hard, or a mix), match it and set each question's "difficulty" field accordingly. Otherwise vary difficulty across EASY/MEDIUM/HARD.
- Distribute points sensibly (integers; theory questions usually carry more points than MCQs; if total marks are given, points should sum close to it).

MCQ rules: exactly 4 options; exactly one correct (unless the lecturer asks for multi-select); distractors plausible but clearly wrong on reflection.
SHORT_TEXT rules: the question demands explanation or reasoning, not a one-word answer; include a concise model answer in "sampleAnswer".

Also propose ONE natural follow-up the lecturer might want next — a short, ready-to-use instruction string (e.g. "Add 2 harder theory questions on X, the concept these questions gloss over") — as the "suggestion" field. Base it on a gap or a commonly-confused point in the material/topic, not a generic remark.

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "questions": [
    {
      "kind": "MCQ",
      "text": "Question text here?",
      "points": 1,
      "difficulty": "EASY",
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
      "difficulty": "HARD",
      "isMultiple": false,
      "options": [],
      "sampleAnswer": "A full-marks answer would cover..."
    }
  ],
  "suggestion": "One short follow-up instruction the lecturer could use next"
}`;

    let content: Anthropic.ContentBlockParam[] = [{ type: "text", text: prompt }];

    if (files.length > 0) {
      const blocks: Anthropic.ContentBlockParam[] = [];
      for (const file of files) {
        try {
          const fileBlocks = await fileToRawBlocks(file);
          blocks.push({ type: "text", text: `--- Source: ${file.name} ---` }, ...fileBlocks);
        } catch (e) {
          if (e instanceof Error && e.message === "FILE_TOO_LARGE")   return badRequest(`${file.name} is over the 4 MB limit`);
          if (e instanceof Error && e.message === "UNSUPPORTED_FILE") return badRequest(`${file.name}: attach a PDF, PPTX, JPG, PNG, or WEBP`);
          if (e instanceof Error && e.message === "NO_SLIDES")        return badRequest(`${file.name}: no slides found`);
          throw e;
        }
      }
      content = [...blocks, { type: "text", text: prompt }];
    }

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages:   [{ role: "user", content }],
    });

    const raw  = (message.content[0] as { type: string; text: string }).text.trim();
    const json = extractJson(raw);
    return ok(json);
  } catch (e) { return handleApiError(e); }
}
