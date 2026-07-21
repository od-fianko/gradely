import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest, notFound } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT = `You are the AI Tutor embedded in a university coding assessment. A student is actively attempting a graded problem and asking you for help while their code editor is open.

Your one hard rule: NEVER provide a complete or near-complete solution, a corrected full function, or code the student can paste in to pass the tests. This is a live assessment, not a study session — giving away the answer would be an academic integrity violation you must not commit.

What you SHOULD do:
- Ask Socratic questions that guide their own thinking ("What happens when the list is empty?")
- Point at the *category* of bug ("look at your loop's boundary condition") without writing the fix
- Explain concepts, algorithms, or language features in the abstract, using different examples than their actual problem
- Comment on complexity/efficiency in general terms
- Encourage them when their approach is sound

If a student directly asks for the answer, gently decline and redirect to a guiding question instead. Keep responses short — 2-4 sentences, occasionally with one small illustrative snippet unrelated to their exact task.`;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "STUDENT") return forbidden("The tutor is available to students during their own attempt");

    const { assignmentId, code, message, history } = await req.json();
    if (!assignmentId || typeof message !== "string" || !message.trim())
      return badRequest("assignmentId and message are required");

    const assignment = await prisma.assignment.findUnique({
      where:   { id: assignmentId },
      select: {
        title: true, description: true,
        programmingDetails: { select: { language: true, testCases: { where: { isHidden: false }, select: { title: true, input: true, expectedOutput: true } } } },
      },
    });
    if (!assignment) return notFound("Assignment");

    const priorTurns: { role: "user" | "assistant"; content: string }[] = Array.isArray(history)
      ? history.slice(-8).filter((m: unknown): m is { role: "user" | "assistant"; content: string } =>
          typeof m === "object" && m !== null &&
          ((m as { role?: unknown }).role === "user" || (m as { role?: unknown }).role === "assistant") &&
          typeof (m as { content?: unknown }).content === "string")
      : [];

    const context = `Problem: ${assignment.title}
${assignment.description}

Visible examples:
${(assignment.programmingDetails?.testCases ?? []).map((tc, i) => `${tc.title ?? `Example ${i + 1}`} — input: ${tc.input} → expected: ${tc.expectedOutput}`).join("\n") || "(none)"}

Student's current code (${assignment.programmingDetails?.language ?? "code"}):
\`\`\`
${String(code ?? "").slice(0, 4000)}
\`\`\``;

    const response = await client.messages.create({
      model:      "claude-haiku-4-5-20251001",
      max_tokens: 400,
      system:     SYSTEM_PROMPT,
      messages: [
        { role: "user", content: context },
        { role: "assistant", content: "Understood — I have the problem and their current code in view. I'll only give hints, never the solution." },
        ...priorTurns,
        { role: "user", content: message.trim() },
      ],
    });

    const reply = (response.content[0] as { type: string; text: string }).text;
    return ok({ reply });
  } catch (e) { return handleApiError(e); }
}
