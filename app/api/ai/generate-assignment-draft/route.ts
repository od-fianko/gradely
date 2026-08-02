import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const LANGUAGE_NAME: Record<string, string> = {
  PYTHON: "Python 3", JAVASCRIPT: "JavaScript (Node)", JAVA: "Java", C: "C", CPP: "C++",
};

/**
 * One-shot "Generate Assignment" for the Coding Exercise / Programming
 * Project wizards. Unlike the per-step draft assistant, this populates the
 * entire form from a single lecturer prompt. Hard constraints (auto-grading
 * on/off, test-case kind) are enforced by only giving the model a JSON
 * schema slot for what's actually allowed — not by asking nicely — so a
 * disabled setting can't accidentally produce content anyway.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can generate assignments");

    const body = await req.json();
    const subtype      = body.subtype === "PROJECT" ? "PROJECT" : "EXERCISE";
    const instructions  = String(body.instructions ?? "").trim();
    const totalMarks    = Number(body.totalMarks) || 100;
    if (!instructions) return badRequest("Describe the assignment you want the AI to generate");

    if (subtype === "PROJECT") {
      const message = await client.messages.create({
        model:      "claude-haiku-4-5-20251001",
        max_tokens: 3072,
        messages: [{
          role:    "user",
          content: `You are an expert software engineering instructor designing a Programming Project assignment (a larger software project, manually/rubric graded — not an auto-graded coding exercise).

The lecturer's instructions, follow them exactly — including any explicit exclusions (e.g. "no GitHub requirement", "keep it beginner-friendly"):
"""
${instructions}
"""

Total marks available: ${totalMarks}

Generate:
- title: short project title
- brief: 2-4 paragraph project overview/brief for students, written in markdown (may use ## headings, **bold**, bullet lists)
- functionalRequirements: one requirement per line, plain text (no bullets/numbering — the UI adds those)
- deliverables: one deliverable per line, plain text (e.g. "Source code as a ZIP file", "A README explaining setup")
- rubric: a markdown grading rubric with clear point allocations that sum close to ${totalMarks}`,
        }],
        tools: [{
          name: "submit_project_draft",
          description: "Submit the completed project assignment draft.",
          input_schema: {
            type: "object",
            additionalProperties: false,
            required: ["title", "brief", "functionalRequirements", "deliverables", "rubric"],
            properties: {
              title:                  { type: "string" },
              brief:                  { type: "string" },
              functionalRequirements: { type: "string" },
              deliverables:           { type: "string" },
              rubric:                 { type: "string" },
            },
          },
        }],
        tool_choice: { type: "tool", name: "submit_project_draft", disable_parallel_tool_use: true },
      });

      const toolUse = message.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_project_draft",
      );
      if (!toolUse) throw new Error("AI did not return a project draft");
      return ok(toolUse.input);
    }

    // ── EXERCISE (Coding Exercise) ──────────────────────────────────────────────
    const language          = typeof body.language === "string" ? body.language : "PYTHON";
    const autoGradingEnabled = body.autoGradingEnabled !== false;
    const testKind          = body.testKind === "FUNCTION" ? "FUNCTION" : "CONSOLE";
    const testCount         = Math.max(1, Number(body.testCount) || 5);

    const testCaseItemSchema = testKind === "FUNCTION"
      ? {
          type: "object", additionalProperties: false,
          required: ["name", "args", "expectedReturn", "points", "hidden", "group"],
          properties: {
            name:           { type: "string" },
            args:           { type: "string", description: "JSON array of arguments to pass, e.g. [5, 8]" },
            expectedReturn: { type: "string", description: "JSON-encoded expected return value, e.g. 13 or \"hello\" or [1,2,3]" },
            points:         { type: "number" },
            hidden:         { type: "boolean" },
            group:          { type: "string", enum: ["Sample", "Edge Case", "Performance"] },
          },
        }
      : {
          type: "object", additionalProperties: false,
          required: ["name", "input", "output", "points", "hidden", "group"],
          properties: {
            name:   { type: "string" },
            input:  { type: "string", description: "stdin text the program reads" },
            output: { type: "string", description: "expected stdout" },
            points: { type: "number" },
            hidden: { type: "boolean" },
            group:  { type: "string", enum: ["Sample", "Edge Case", "Performance"] },
          },
        };

    const properties: Record<string, unknown> = {
      title:             { type: "string" },
      statement:         { type: "string", description: "Full problem statement in markdown: task, constraints, input format, output format, and worked examples. May use ## headings and bullet lists." },
      tags:              { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
      difficulty:        { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
      starterCode:       { type: "string", description: "Starter template, or an empty string if none should be given" },
      referenceSolution: { type: "string", description: "A complete, correct hidden solution — never shown to students" },
    };
    const required = ["title", "statement", "tags", "difficulty", "starterCode", "referenceSolution"];

    if (autoGradingEnabled) {
      if (testKind === "FUNCTION") {
        properties.functionName = { type: "string", description: "Exact name of the function students must implement" };
        required.push("functionName");
      }
      properties.testCases = { type: "array", items: testCaseItemSchema, minItems: 2 };
      required.push("testCases");
    }

    const prompt = `You are an expert programming instructor designing a Coding Exercise (an algorithmic/function-based auto-gradable-or-manual exercise) for ${LANGUAGE_NAME[language] ?? language}.

The lecturer's instructions — follow them exactly, including explicit exclusions (e.g. "no starter code", "beginner level", "don't include an easy test"):
"""
${instructions}
"""

Total marks available: ${totalMarks}
${autoGradingEnabled
  ? `Automatic grading is ENABLED using ${testKind === "FUNCTION" ? "function-based tests (call one function with arguments, compare its return value)" : "console/stdin-stdout tests"}. Generate ${testCount} test cases unless the lecturer specified a different count — a spread of Sample, Edge Case, and (if relevant) Performance cases, with points summing close to ${totalMarks}.`
  : `Automatic grading is DISABLED for this exercise — the lecturer will grade submissions manually or by rubric. Do NOT generate any test cases.`}

If the lecturer's instructions say not to include starter code, set "starterCode" to an empty string. The "referenceSolution" is always required regardless — it is never shown to students, only used by the lecturer as a model answer.

The problem statement must be self-contained: include constraints, the exact input format, the exact output format, and at least one worked example — as markdown sections within "statement".`;

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 4096,
      messages:   [{ role: "user", content: prompt }],
      tools: [{
        name: "submit_exercise_draft",
        description: "Submit the completed coding exercise draft.",
        input_schema: { type: "object", additionalProperties: false, required, properties },
      }],
      tool_choice: { type: "tool", name: "submit_exercise_draft", disable_parallel_tool_use: true },
    });

    const toolUse = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "submit_exercise_draft",
    );
    if (!toolUse) throw new Error("AI did not return an exercise draft");
    return ok(toolUse.input);
  } catch (e) { return handleApiError(e); }
}
