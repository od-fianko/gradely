import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import type { GradingMethod } from "@prisma/client";

const GRADING_METHOD: Record<string, GradingMethod> = {
  PROGRAMMING:     "AUTOMATIC", // may still be MANUAL in practice if autoGrade is off — set per-assignment below
  PROJECT:         "MANUAL",
  MULTIPLE_CHOICE: "AUTOMATIC",
  SHORT_ANSWER:    "AI_ASSISTED",
  FILE_UPLOAD:     "MANUAL",
};

export async function GET(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { courseId } = await params;
    const isLecturer = session.user.role === "LECTURER" || session.user.role === "ADMIN";

    const assignments = await prisma.assignment.findMany({
      where: { courseId, ...(!isLecturer && { isPublished: true }) },
      include: {
        _count: { select: { submissions: true } },
        programmingDetails: { select: { language: true, autoGrade: true } },
        projectDetails:     { select: { githubRequired: true } },
        quizDetails:        { select: { timeLimit: true } },
      },
      orderBy: { dueDate: "asc" },
    });
    return ok(assignments);
  } catch (e) { return handleApiError(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ courseId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "LECTURER" && session.user.role !== "ADMIN") return forbidden();
    const { courseId } = await params;

    const body = await req.json();
    const { type, totalMarks, dueDate, timeLimitMinutes, gradeWeightPercent, programmingDetails, projectDetails, quizDetails, shortAnswerDetails, fileUploadDetails, ...base } = body;

    if (!type || !totalMarks || !dueDate) return badRequest("type, totalMarks and dueDate are required");
    if (type === "PROGRAMMING" && programmingDetails?.autoGrade === false && (programmingDetails?.testCases ?? []).length > 0)
      return badRequest("Test cases were provided but automatic grading is disabled for this exercise");

    const assignment = await prisma.assignment.create({
      data: {
        ...base,
        type,
        totalMarks: Number(totalMarks),
        timeLimitMinutes:   timeLimitMinutes   ? Number(timeLimitMinutes)   : null,
        gradeWeightPercent: gradeWeightPercent ? Number(gradeWeightPercent) : null,
        dueDate: new Date(dueDate),
        gradingMethod: type === "PROGRAMMING" && programmingDetails?.autoGrade === false
          ? "MANUAL"
          : GRADING_METHOD[type] ?? "MANUAL",
        courseId,
        ...(programmingDetails && {
          programmingDetails: {
            create: {
              ...programmingDetails,
              // When auto-grading is off, test cases are irrelevant — don't persist any.
              testCases: {
                create: programmingDetails.autoGrade === false ? [] : (programmingDetails.testCases ?? []),
              },
            },
          },
        }),
        ...(projectDetails && { projectDetails: { create: projectDetails } }),
        ...(quizDetails && {
          quizDetails: {
            create: {
              ...quizDetails,
              questions: {
                create: (quizDetails.questions ?? []).map((q: any, qi: number) => ({
                  text: q.text,
                  points: q.points ?? 1,
                  isMultiple: q.isMultiple ?? false,
                  kind: q.kind === "SHORT_TEXT" ? "SHORT_TEXT" : "MCQ",
                  difficulty: ["EASY", "MEDIUM", "HARD"].includes(q.difficulty) ? q.difficulty : "MEDIUM",
                  sampleAnswer: typeof q.sampleAnswer === "string" && q.sampleAnswer.trim() ? q.sampleAnswer : null,
                  order: qi,
                  options: {
                    create: q.kind === "SHORT_TEXT" ? [] : (q.options ?? []).map((o: any, oi: number) => ({
                      text: o.text,
                      isCorrect: o.isCorrect ?? false,
                      order: oi,
                    })),
                  },
                })),
              },
            },
          },
        }),
        ...(shortAnswerDetails && { shortAnswerDetails: { create: shortAnswerDetails } }),
        ...(fileUploadDetails  && { fileUploadDetails:  { create: fileUploadDetails  } }),
      },
      include: { programmingDetails: true, projectDetails: true, quizDetails: true, shortAnswerDetails: true, fileUploadDetails: true },
    });
    return ok(assignment, "Assignment created", 201);
  } catch (e) { return handleApiError(e); }
}
