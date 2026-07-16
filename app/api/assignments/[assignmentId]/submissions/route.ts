import { auth } from "@/lib/auth/auth";
import { ok, unauthorized, forbidden, notFound, badRequest } from "@/lib/api/response";
import { handleApiError } from "@/lib/errors/http-error";
import { prisma } from "@/lib/db/prisma";
import { runIntegrityCheck } from "@/lib/ai/integrity";
import { AssignmentType, SubmissionStatus } from "@prisma/client";

function getSubmissionBaseData(isLate: boolean, now: Date) {
  return {
    status: isLate ? SubmissionStatus.LATE_SUBMITTED : SubmissionStatus.SUBMITTED,
    submittedAt: now,
    isLate,
  };
}

function buildSubmissionUpdateData(
  assignmentType: AssignmentType,
  body: Record<string, unknown>,
  isLate: boolean,
  now: Date
) {
  const baseData = getSubmissionBaseData(isLate, now);

  switch (assignmentType) {
    case AssignmentType.PROGRAMMING: {
      const code = typeof body.code === "string" ? body.code : "";
      const language = typeof body.language === "string" ? body.language : "PYTHON";

      return {
        ...baseData,
        codeSubmission: {
          upsert: {
            update: { code, language },
            create: { code, language },
          },
        },
      };
    }

    case AssignmentType.SHORT_ANSWER: {
      const answer = typeof body.answer === "string" ? body.answer : typeof body.content === "string" ? body.content : "";

      return {
        ...baseData,
        shortAnswerSubmission: {
          upsert: {
            update: { answer },
            create: { answer },
          },
        },
      };
    }

    case AssignmentType.FILE_UPLOAD: {
      const fileName = typeof body.fileName === "string" ? body.fileName : undefined;
      const originalName = typeof body.originalName === "string" ? body.originalName : fileName;
      const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : undefined;
      const fileType = typeof body.fileType === "string" ? body.fileType : "application/octet-stream";
      const fileSizeBytes =
        typeof body.fileSizeBytes === "number"
          ? body.fileSizeBytes
          : typeof body.fileSizeBytes === "string"
            ? Number(body.fileSizeBytes)
            : NaN;

      if (!fileName || !originalName || !fileUrl || Number.isNaN(fileSizeBytes)) {
        throw new Error("FILE_SUBMISSION_INVALID");
      }

      return {
        ...baseData,
        fileSubmission: {
          upsert: {
            update: { fileName, originalName, fileUrl, fileType, fileSizeBytes },
            create: { fileName, originalName, fileUrl, fileType, fileSizeBytes },
          },
        },
      };
    }

    case AssignmentType.MULTIPLE_CHOICE: {
      const answers = Array.isArray(body.answers) ? body.answers : [];

      return {
        ...baseData,
        quizSubmission: {
          upsert: {
            update: {
              answers: {
                deleteMany: {},
                create: answers
                  .filter(
                    (answer): answer is { questionId: string; selectedOptionId?: string | null } =>
                      typeof answer === "object" &&
                      answer !== null &&
                      typeof answer.questionId === "string" &&
                      (!("selectedOptionId" in answer) ||
                        typeof answer.selectedOptionId === "string" ||
                        answer.selectedOptionId === null)
                  )
                  .map((answer) => ({
                    questionId: answer.questionId,
                    selectedOptionId: answer.selectedOptionId ?? null,
                  })),
              },
            },
            create: {
              answers: {
                create: answers
                  .filter(
                    (answer): answer is { questionId: string; selectedOptionId?: string | null } =>
                      typeof answer === "object" &&
                      answer !== null &&
                      typeof answer.questionId === "string" &&
                      (!("selectedOptionId" in answer) ||
                        typeof answer.selectedOptionId === "string" ||
                        answer.selectedOptionId === null)
                  )
                  .map((answer) => ({
                    questionId: answer.questionId,
                    selectedOptionId: answer.selectedOptionId ?? null,
                  })),
              },
            },
          },
        },
      };
    }
  }
}

function buildSubmissionCreateData(
  assignmentType: AssignmentType,
  body: Record<string, unknown>,
  isLate: boolean,
  now: Date
) {
  const baseData = getSubmissionBaseData(isLate, now);

  switch (assignmentType) {
    case AssignmentType.PROGRAMMING: {
      const code = typeof body.code === "string" ? body.code : "";
      const language = typeof body.language === "string" ? body.language : "PYTHON";

      return {
        ...baseData,
        codeSubmission: {
          create: { code, language },
        },
      };
    }

    case AssignmentType.SHORT_ANSWER: {
      const answer = typeof body.answer === "string" ? body.answer : typeof body.content === "string" ? body.content : "";

      return {
        ...baseData,
        shortAnswerSubmission: {
          create: { answer },
        },
      };
    }

    case AssignmentType.FILE_UPLOAD: {
      const fileName = typeof body.fileName === "string" ? body.fileName : undefined;
      const originalName = typeof body.originalName === "string" ? body.originalName : fileName;
      const fileUrl = typeof body.fileUrl === "string" ? body.fileUrl : undefined;
      const fileType = typeof body.fileType === "string" ? body.fileType : "application/octet-stream";
      const fileSizeBytes =
        typeof body.fileSizeBytes === "number"
          ? body.fileSizeBytes
          : typeof body.fileSizeBytes === "string"
            ? Number(body.fileSizeBytes)
            : NaN;

      if (!fileName || !originalName || !fileUrl || Number.isNaN(fileSizeBytes)) {
        throw new Error("FILE_SUBMISSION_INVALID");
      }

      return {
        ...baseData,
        fileSubmission: {
          create: { fileName, originalName, fileUrl, fileType, fileSizeBytes },
        },
      };
    }

    case AssignmentType.MULTIPLE_CHOICE: {
      const answers = Array.isArray(body.answers) ? body.answers : [];

      return {
        ...baseData,
        quizSubmission: {
          create: {
            answers: {
              create: answers
                .filter(
                  (answer): answer is { questionId: string; selectedOptionId?: string | null } =>
                    typeof answer === "object" &&
                    answer !== null &&
                    typeof answer.questionId === "string" &&
                    (!("selectedOptionId" in answer) ||
                      typeof answer.selectedOptionId === "string" ||
                      answer.selectedOptionId === null)
                )
                .map((answer) => ({
                  questionId: answer.questionId,
                  selectedOptionId: answer.selectedOptionId ?? null,
                })),
            },
          },
        },
      };
    }
  }
}

export async function GET(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    const { assignmentId } = await params;
    const isLecturer = session.user.role === "LECTURER" || session.user.role === "ADMIN";

    if (isLecturer) {
      const submissions = await prisma.submission.findMany({
        where: { assignmentId },
        include: {
          student: { select: { id: true, name: true, email: true } },
          grade:   true,
        },
        orderBy: { submittedAt: "desc" },
      });
      return ok(submissions);
    }

    const submission = await prisma.submission.findFirst({
      where: { assignmentId, studentId: session.user.id },
      include: { grade: true },
    });
    return ok(submission ?? null);
  } catch (e) { return handleApiError(e); }
}

export async function POST(req: Request, { params }: { params: Promise<{ assignmentId: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized();
    if (session.user.role !== "STUDENT") return forbidden("Only students can submit");
    const { assignmentId } = await params;

    const assignment = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        quizDetails: {
          include: {
            questions: {
              include: { options: true },
            },
          },
        },
      },
    });
    if (!assignment || !assignment.isPublished) return notFound("Assignment");

    const now = new Date();
    if (now > assignment.dueDate && !assignment.allowLateSubmit)
      return badRequest("Submission deadline has passed");

    const existing = await prisma.submission.findFirst({
      where: { assignmentId, studentId: session.user.id },
    });

    const body = await req.json();
    const isLate = now > assignment.dueDate;
    const updateData = buildSubmissionUpdateData(assignment.type, body, isLate, now);
    const createData = buildSubmissionCreateData(assignment.type, body, isLate, now);

    const submission = existing
      ? await prisma.submission.update({
          where: { id: existing.id },
          data: updateData,
        })
      : await prisma.submission.create({
          data: {
            assignmentId,
            studentId: session.user.id,
            ...createData,
          },
        });

    // Auto-grade MULTIPLE_CHOICE based on correct answers
    if (assignment.type === AssignmentType.MULTIPLE_CHOICE && assignment.quizDetails) {
      const answers: { questionId: string; selectedOptionId?: string | null }[] =
        Array.isArray(body.answers) ? body.answers : [];

      let earned = 0;
      for (const q of assignment.quizDetails.questions) {
        const submitted = answers.filter((a) => a.questionId === q.id).map((a) => a.selectedOptionId);
        const correct   = q.options.filter((o) => o.isCorrect).map((o) => o.id);

        const isCorrect =
          submitted.length === correct.length &&
          correct.every((id) => submitted.includes(id));

        if (isCorrect) earned += q.points;
      }

      const totalPoints = assignment.quizDetails.questions.reduce((s, q) => s + q.points, 0);
      const maxScore    = assignment.totalMarks;
      const score       = totalPoints > 0 ? (earned / totalPoints) * maxScore : 0;
      const percentage  = maxScore > 0 ? (score / maxScore) * 100 : 0;

      await prisma.grade.upsert({
        where:  { submissionId: submission.id },
        update: { score, maxScore, percentage, isAiGraded: false },
        create: { submissionId: submission.id, score, maxScore, percentage, isAiGraded: false },
      });
    }

    // Academic integrity: screen written and code submissions for AI-generated
    // or copied work. Failure here must never block the submission itself.
    if (assignment.type === AssignmentType.SHORT_ANSWER || assignment.type === AssignmentType.PROGRAMMING) {
      await runIntegrityCheck(submission.id).catch(() => null);
    }

    return ok(submission, existing ? "Submission updated" : "Submitted", 201);
  } catch (e) {
    if (e instanceof Error && e.message === "FILE_SUBMISSION_INVALID") {
      return badRequest("File submissions require fileName, originalName, fileUrl, and fileSizeBytes");
    }
    return handleApiError(e);
  }
}
