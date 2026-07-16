import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest, serverError } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { extractJson } from "@/lib/ai/extract-json";
import Anthropic from "@anthropic-ai/sdk";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

const client = new Anthropic();

const MAX_MB = 4;
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

type AssignmentKind = "MULTIPLE_CHOICE" | "SHORT_ANSWER" | "PROGRAMMING";

function collectText(node: unknown, out: string[]) {
  if (node == null) return;
  if (typeof node === "string") { out.push(node); return; }
  if (Array.isArray(node)) { node.forEach((n) => collectText(n, out)); return; }
  if (typeof node === "object") {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "a:t") collectText(value, out);
      else collectText(value, out);
    }
  }
}

async function extractPptxText(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: true });

  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const na = Number(a.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      const nb = Number(b.match(/slide(\d+)\.xml$/)?.[1] ?? 0);
      return na - nb;
    });

  if (slideFiles.length === 0) throw new Error("No slides found in .pptx file");

  const slideTexts: string[] = [];
  for (const [i, name] of slideFiles.entries()) {
    const xml = await zip.files[name].async("string");
    const json = parser.parse(xml);
    const texts: string[] = [];
    collectText(json, texts);
    slideTexts.push(`--- Slide ${i + 1} ---\n${texts.join(" ").trim()}`);
  }
  return slideTexts.join("\n\n");
}

function buildPrompt(kind: AssignmentKind, count: number, totalMarks: number, title: string, description: string, instructions: string) {
  const marksPerQuestion = totalMarks ? Math.floor(totalMarks / count) || 1 : 1;
  const lecturerBrief = instructions.trim()
    ? `\nThe lecturer's specific instructions, in their own words — follow these faithfully (question count, difficulty, focus areas):\n"""\n${instructions.trim()}\n"""\n`
    : "";

  if (kind === "MULTIPLE_CHOICE") {
    return `Based on the attached lecture slides, generate assessment questions that test understanding of the material. Questions can be "MCQ" (4 options, auto-graded) or "SHORT_TEXT" (theory/written answer, lecturer-graded).
${lecturerBrief}
${title ? `Assignment title: ${title}` : ""}
Default if the lecturer didn't specify: ${count} questions, all MCQ, ${marksPerQuestion} points each, varied difficulty. If the lecturer asks for theory/written/essay questions or a mix, produce that mix.

Rules:
- Base every question on content actually present in the slides
- MCQ: exactly 4 options; exactly one correct (unless clearly multi-select); plausible distractors
- SHORT_TEXT: demands explanation, not one-word answers; include a concise model answer in "sampleAnswer"; options must be []

Return ONLY valid JSON (no markdown, no extra text):
{
  "questions": [
    { "kind": "MCQ", "text": "...", "points": ${marksPerQuestion}, "isMultiple": false,
      "options": [ { "text": "...", "isCorrect": false }, { "text": "...", "isCorrect": true }, { "text": "...", "isCorrect": false }, { "text": "...", "isCorrect": false } ] },
    { "kind": "SHORT_TEXT", "text": "Explain why...", "points": 5, "isMultiple": false, "options": [], "sampleAnswer": "..." }
  ]
}`;
  }

  if (kind === "SHORT_ANSWER") {
    return `Based on the attached lecture slides, design ONE short-answer / essay assignment question that tests deep understanding of the material, plus a grading rubric.
${lecturerBrief}
Total marks: ${totalMarks}

Return ONLY valid JSON (no markdown, no extra text):
{
  "suggestedTitle": "short assignment title",
  "suggestedDescription": "the question/instructions students will answer, written for students",
  "rubric": "3-5 bullet point rubric for grading, referencing what a full-marks answer must cover"
}`;
  }

  // PROGRAMMING
  return `Based on the attached lecture slides, design ONE programming exercise that applies a concept taught in the slides, plus starter code and test cases.
${lecturerBrief}
Total marks: ${totalMarks}
Default number of test cases if the lecturer didn't specify: ${count}

Return ONLY valid JSON (no markdown, no extra text):
{
  "suggestedTitle": "short assignment title",
  "suggestedDescription": "the problem statement, written for students",
  "starterCode": "a short Python starter function/template (or empty string)",
  "testCases": [
    { "title": "short test name", "input": "stdin input (may be empty)", "expectedOutput": "expected stdout", "points": ${marksPerQuestion}, "isHidden": false }
  ]
}`;
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can generate assignments from slides");

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kind = form.get("type") as AssignmentKind | null;
    const title = String(form.get("title") ?? "");
    const description = String(form.get("description") ?? "");
    const instructions = String(form.get("instructions") ?? "");
    const totalMarks = Number(form.get("totalMarks") ?? 100);
    const count = Math.max(1, Number(form.get("count") ?? 4));

    if (!file) return badRequest("No file provided");
    if (!kind || !["MULTIPLE_CHOICE", "SHORT_ANSWER", "PROGRAMMING"].includes(kind))
      return badRequest("A valid assignment type is required");

    if (file.size > MAX_MB * 1024 * 1024) return badRequest(`File must be under ${MAX_MB} MB`);

    const buffer = Buffer.from(await file.arrayBuffer());
    const prompt = buildPrompt(kind, count, totalMarks, title, description, instructions);

    let contentBlocks: Anthropic.MessageParam["content"];

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      contentBlocks = [
        { type: "document", source: { type: "base64", media_type: "application/pdf", data: buffer.toString("base64") } },
        { type: "text", text: prompt },
      ];
    } else if (IMAGE_MIMES.has(file.type)) {
      contentBlocks = [
        { type: "image", source: { type: "base64", media_type: file.type as "image/jpeg" | "image/png" | "image/webp", data: buffer.toString("base64") } },
        { type: "text", text: prompt },
      ];
    } else if (file.type === PPTX_MIME || file.name.toLowerCase().endsWith(".pptx")) {
      const slideText = await extractPptxText(buffer);
      contentBlocks = [
        { type: "text", text: `Extracted slide content:\n\n${slideText}\n\n${prompt}` },
      ];
    } else {
      return badRequest("Unsupported file type. Upload a PDF, PPTX, JPG, PNG, or WEBP.");
    }

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 3072,
      messages:   [{ role: "user", content: contentBlocks }],
    });

    const raw  = (message.content[0] as { type: string; text: string }).text.trim();
    const json = extractJson(raw);
    return ok(json);
  } catch (e) {
    if (e instanceof Error && e.message === "No slides found in .pptx file") {
      return badRequest("Could not find any slides in that .pptx file");
    }
    return handleApiError(e);
  }
}
