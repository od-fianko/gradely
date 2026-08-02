import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";

const PISTON_URL = process.env.PISTON_API_URL ?? "https://emkc.org/api/v2/piston";

const LANG_MAP: Record<string, { language: string; version: string }> = {
  PYTHON:     { language: "python",     version: "3.10.0" },
  JAVASCRIPT: { language: "javascript", version: "18.15.0" },
  JAVA:       { language: "java",       version: "15.0.2"  },
  C:          { language: "c",          version: "10.2.0"  },
  CPP:        { language: "c++",        version: "10.2.0"  },
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
    const pistonLang = LANG_MAP[language] ?? LANG_MAP.PYTHON;

    // Upsert the CodeSubmission record so both its code and TestResults stay
    // current on every run (a previous version only wrote code on first run).
    const codeSubmission = await prisma.codeSubmission.upsert({
      where:  { submissionId },
      update: { code, language },
      create: { submissionId, code, language },
    });

    const results = await Promise.all(
      testCases.map(async (tc) => {
        if (tc.kind === "FUNCTION" && !FUNCTION_TESTABLE_LANGUAGES.has(language)) {
          return {
            testCaseId: tc.id, title: tc.title, passed: false, actual: "", expected: tc.expectedOutput,
            points: 0, isHidden: tc.isHidden,
            error: `Function-based test cases only run for Python or JavaScript, not ${language}.`,
          };
        }

        const fileContent = tc.kind === "FUNCTION"
          ? code + buildFunctionHarness(language, programmingDetails!.functionName ?? "solve", tc.input)
          : code;

        const res = await fetch(`${PISTON_URL}/execute`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            language: pistonLang.language,
            version:  pistonLang.version,
            files:    [{ content: fileContent }],
            stdin:    tc.kind === "CONSOLE" ? tc.input : "",
          }),
        });
        const json = await res.json() as { run?: { stdout?: string; stderr?: string; time?: number } };
        const stdout = (json.run?.stdout ?? "").trim();
        // Function harness prints exactly one line, last, regardless of whatever
        // the student's own code printed before it.
        const actual = tc.kind === "FUNCTION" ? (stdout.split("\n").pop() ?? "").trim() : stdout;
        const expected = tc.expectedOutput.trim();
        const passed = tc.kind === "FUNCTION" ? jsonEquivalent(actual, expected) : actual === expected;
        const stderr = json.run?.stderr?.slice(0, 500) ?? null;

        await prisma.testResult.upsert({
          where:  { testCaseId_codeSubmissionId: { testCaseId: tc.id, codeSubmissionId: codeSubmission.id } },
          update: {
            passed, actualOutput: actual, expectedOutput: expected,
            executionTime: json.run?.time ?? null,
            error:         stderr,
            pointsAwarded: passed ? tc.points : 0,
          },
          create: {
            passed, actualOutput: actual, expectedOutput: expected,
            executionTime:    json.run?.time ?? null,
            error:            stderr,
            pointsAwarded:    passed ? tc.points : 0,
            testCaseId:       tc.id,
            codeSubmissionId: codeSubmission.id,
          },
        }).catch(() => null);

        return { testCaseId: tc.id, title: tc.title, passed, actual, expected, points: passed ? tc.points : 0, isHidden: tc.isHidden, error: stderr };
      })
    );

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
