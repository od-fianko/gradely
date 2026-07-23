import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const STEP_PROMPTS: Record<string, (ctx: Record<string, unknown>) => string> = {
  problem: (ctx) => `You are an academic exercise designer helping a lecturer draft a programming exercise.

The lecturer's request: "${ctx.prompt}"
${ctx.language ? `Target language: ${ctx.language}` : ""}

Draft a title, a full problem statement (task, constraints, expected function signature — written for students), 2-4 short topic tags, and a difficulty level.

Return ONLY valid JSON (no markdown):
{ "title": "...", "statement": "...", "tags": ["...", "..."], "difficulty": "EASY" | "MEDIUM" | "HARD" }`,

  code: (ctx) => `You are drafting starter code for a programming exercise.

Exercise title: ${ctx.title ?? "(untitled)"}
Problem statement: ${ctx.description ?? "(none written yet)"}
Language: ${ctx.language}
Lecturer's guidance: "${ctx.prompt || "(none — use your judgement)"}"

Write starter code that stubs out the function signature and any helper classes/types implied by the problem, with a TODO comment where the student must implement the logic. Do not solve the problem — leave the core logic for the student.

Return ONLY valid JSON (no markdown): { "code": "..." }`,

  tests: (ctx) => `You are drafting test cases for a programming exercise.

Exercise title: ${ctx.title ?? "(untitled)"}
Problem statement: ${ctx.description ?? "(none written yet)"}
Language: ${ctx.language}
Lecturer's request: "${ctx.prompt || `${ctx.testCount ?? 5} well-rounded test cases`}"

Follow the lecturer's request faithfully (count, what to cover). If unspecified, generate a sensible spread: 2-3 sample cases, 1-2 edge cases, and (if performance matters for this problem) one larger/performance case marked hidden.

Return ONLY valid JSON (no markdown):
{ "tests": [ { "name": "...", "input": "stdin text", "output": "expected stdout", "points": 1, "hidden": false, "group": "Sample" | "Edge Case" | "Performance" } ] }`,
};

const RESPONSE_SCHEMAS: Record<"problem" | "code" | "tests", Anthropic.Tool.InputSchema> = {
  problem: {
    type: "object",
    additionalProperties: false,
    required: ["title", "statement", "tags", "difficulty"],
    properties: {
      title: { type: "string" },
      statement: { type: "string" },
      tags: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 },
      difficulty: { type: "string", enum: ["EASY", "MEDIUM", "HARD"] },
    },
  },
  code: {
    type: "object",
    additionalProperties: false,
    required: ["code"],
    properties: { code: { type: "string" } },
  },
  tests: {
    type: "object",
    additionalProperties: false,
    required: ["tests"],
    properties: {
      tests: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "input", "output", "points", "hidden", "group"],
          properties: {
            name: { type: "string" },
            input: { type: "string" },
            output: { type: "string" },
            points: { type: "number" },
            hidden: { type: "boolean" },
            group: { type: "string", enum: ["Sample", "Edge Case", "Performance"] },
          },
        },
      },
    },
  },
};

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden("Only lecturers can generate exercise drafts");

    const body = await req.json();
    const step = String(body.step ?? "");
    if (!STEP_PROMPTS[step]) return badRequest("step must be one of: problem, code, tests");

    const prompt = STEP_PROMPTS[step]({
      prompt:       String(body.prompt ?? "").trim(),
      title:        body.title,
      description:  body.description,
      language:     body.language,
      testCount:    body.testCount,
    });

    const message = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages:   [{ role: "user", content: prompt }],
      tools: [{
        name: "submit_exercise_draft",
        description: "Submit the completed exercise draft in the required format.",
        input_schema: RESPONSE_SCHEMAS[step as keyof typeof RESPONSE_SCHEMAS],
      }],
      tool_choice: { type: "tool", name: "submit_exercise_draft", disable_parallel_tool_use: true },
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === "submit_exercise_draft",
    );
    if (!toolUse) throw new Error("AI did not return an exercise draft");

    return ok(toolUse.input);
  } catch (e) { return handleApiError(e); }
}
