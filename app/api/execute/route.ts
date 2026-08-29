import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

// The Piston public API (emkc.org) went whitelist-only in Feb 2026, so all
// code execution moved to paiza.io's runner API instead. It's free and needs
// no signup (the "guest" key), but is rate-limited — fine for a classroom,
// but get a real paiza.io API key and swap PAIZA_API_KEY if that becomes
// a bottleneck.
const PAIZA_API_KEY = process.env.PAIZA_API_KEY ?? "guest";

const LANG_MAP: Record<string, string> = {
  PYTHON:     "python3",
  JAVASCRIPT: "javascript",
  JAVA:       "java",
  C:          "c",
  CPP:        "cpp",
};

/** Function-based testing (args -> return value) is only wired up for
 *  languages where appending a one-line call-and-print harness is trivial. */
const FUNCTION_TESTABLE_LANGUAGES = new Set(["PYTHON", "JAVASCRIPT"]);

function buildFunctionHarness(language: string, functionName: string, argsJson: string): string {
  const argsB64 = Buffer.from(argsJson, "utf8").toString("base64");
  if (language === "PYTHON") {
    return `\n\nimport json as __json, base64 as __b64\n__args = __json.loads(__b64.b64decode("${argsB64}").decode())\nprint(__json.dumps(${functionName}(*__args)))\n`;
  }
  // JAVASCRIPT
  return `\n\nconst __args = JSON.parse(Buffer.from("${argsB64}", "base64").toString());\nconsole.log(JSON.stringify(${functionName}(...__args)));\n`;
}

/** Canonicalize JSON text so formatting differences don't cause false failures;
 *  falls back to trimmed string equality when either side isn't valid JSON. */
function jsonEquivalent(a: string, b: string): boolean {
  try { return JSON.stringify(JSON.parse(a)) === JSON.stringify(JSON.parse(b)); }
  catch { return a.trim() === b.trim(); }
}

interface RunOutcome { stdout: string; stderr: string; timedOut: boolean }

/** paiza.io's runner API is async: submit, then poll get_details until it
 *  reports "completed". Polled sequentially (not in parallel across test
 *  cases) to stay well under the guest key's rate limit. */
async function runOnPaiza(language: string, sourceCode: string, stdin: string): Promise<RunOutcome> {
  const createRes = await fetch("https://api.paiza.io/runners/create", {
    method:  "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body:    new URLSearchParams({ source_code: sourceCode, language, input: stdin, api_key: PAIZA_API_KEY }),
  });
  const created = await createRes.json() as { id?: string; error?: string };
  if (!created.id) return { stdout: "", stderr: created.error ?? "Failed to submit code for execution", timedOut: false };

  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 700));
    const detailsRes = await fetch(`https://api.paiza.io/runners/get_details?id=${created.id}&api_key=${PAIZA_API_KEY}`);
    const details = await detailsRes.json() as {
      status?: string; stdout?: string | null; stderr?: string | null;
      build_stderr?: string | null; result?: string;
    };
    if (details.status === "completed") {
      const stderr = [details.build_stderr, details.stderr].filter(Boolean).join("\n").trim();
      return { stdout: details.stdout ?? "", stderr, timedOut: details.result === "timeout" };
    }
  }
  return { stdout: "", stderr: "Execution timed out", timedOut: true };
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();

    const body = await req.json();
    const { submissionId, code, language } = body;
    if (!submissionId || !code || !language) return badRequest("submissionId, code and language required");

    const submission = await prisma.submission.findUnique({
      where:   { id: submissionId },
      include: {
        assignment: {
          include: { programmingDetails: { include: { testCases: { orderBy: { order: "asc" } } } } },
        },
        codeSubmission: true,
      },
    });
    if (!submission) return badRequest("Submission not found");
    if (submission.studentId !== session.user.id && session.user.role !== "LECTURER" && session.user.role !== "ADMIN")
      return forbidden();

    const programmingDetails = submission.assignment.programmingDetails;
    const testCases  = programmingDetails?.testCases ?? [];
    const paizaLang  = LANG_MAP[language] ?? LANG_MAP.PYTHON;

    // Upsert the CodeSubmission record so both its code and TestResults stay
    // current on every run (a previous version only wrote code on first run).
    const codeSubmission = await prisma.codeSubmission.upsert({
      where:  { submissionId },
      update: { code, language },
      create: { submissionId, code, language },
    });

    // No test cases (manual/rubric-graded exercise) — still run the code once
    // so the student can see stdout/stderr, just without a pass/fail verdict.
    if (testCases.length === 0) {
      const run = await runOnPaiza(paizaLang, code, "");
      return ok({
        results: [{
          testCaseId: "no-test-cases", title: "Program output", passed: !run.stderr,
          actual: run.stdout.trim(), expected: "", points: 0, isHidden: false,
          error: run.stderr || (run.timedOut ? "Execution timed out" : null) || null,
        }],
        totalPoints: 0, earnedPoints: 0,
      });
    }

    const results: {
      testCaseId: string; title: string | null; passed: boolean; actual: string;
      expected: string; points: number; isHidden: boolean; error: string | null;
    }[] = [];

    for (const tc of testCases) {
      if (tc.kind === "FUNCTION" && !FUNCTION_TESTABLE_LANGUAGES.has(language)) {
        results.push({
          testCaseId: tc.id, title: tc.title, passed: false, actual: "", expected: tc.expectedOutput,
          points: 0, isHidden: tc.isHidden,
          error: `Function-based test cases only run for Python or JavaScript, not ${language}.`,
        });
        continue;
      }

      const sourceCode = tc.kind === "FUNCTION"
        ? code + buildFunctionHarness(language, programmingDetails!.functionName ?? "solve", tc.input)
        : code;

      const run = await runOnPaiza(paizaLang, sourceCode, tc.kind === "CONSOLE" ? tc.input : "");
      const stdout = run.stdout.trim();
      // Function harness prints exactly one line, last, regardless of whatever
      // the student's own code printed before it.
      const actual = tc.kind === "FUNCTION" ? (stdout.split("\n").pop() ?? "").trim() : stdout;
      const expected = tc.expectedOutput.trim();
      const passed = !run.stderr && (tc.kind === "FUNCTION" ? jsonEquivalent(actual, expected) : actual === expected);
      const stderr = run.stderr.slice(0, 500) || null;

      await prisma.testResult.upsert({
        where:  { testCaseId_codeSubmissionId: { testCaseId: tc.id, codeSubmissionId: codeSubmission.id } },
        update: { passed, actualOutput: actual, expectedOutput: expected, executionTime: null, error: stderr, pointsAwarded: passed ? tc.points : 0 },
        create: {
          passed, actualOutput: actual, expectedOutput: expected, executionTime: null, error: stderr,
          pointsAwarded: passed ? tc.points : 0, testCaseId: tc.id, codeSubmissionId: codeSubmission.id,
        },
      }).catch(() => null);

      results.push({ testCaseId: tc.id, title: tc.title, passed, actual, expected, points: passed ? tc.points : 0, isHidden: tc.isHidden, error: stderr });
    }

    const totalPoints  = testCases.reduce((s, t) => s + t.points, 0);
    const earnedPoints = results.filter((r) => r.passed).reduce((s, r) => s + r.points, 0);

    // Auto-grade the submission based on test results — unless the lecturer
    // turned auto-grading off for this exercise (manual grading instead).
    if (totalPoints > 0 && programmingDetails?.autoGrade !== false) {
      const percentage = (earnedPoints / totalPoints) * 100;
      const isReleased = !programmingDetails?.requireManualReview;
      await prisma.grade.upsert({
        where:  { submissionId },
        update: { score: earnedPoints, maxScore: totalPoints, percentage, isAiGraded: false, isReleased },
        create: { submissionId, score: earnedPoints, maxScore: totalPoints, percentage, isAiGraded: false, isReleased },
      }).catch(() => null);
    }

    return ok({ results: results.filter((r) => !r.isHidden || session.user.role !== "STUDENT"), totalPoints, earnedPoints });
  } catch (e) { return handleApiError(e); }
}
