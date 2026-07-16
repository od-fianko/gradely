import { prisma } from "@/lib/db/prisma";
import type { SubmissionStatus } from "@prisma/client";

export const submissionRepository = {
  findById(id: string) {
    return prisma.submission.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, name: true, email: true } },
        assignment: { select: { totalMarks: true } },
        codeSubmission: { include: { testResults: { include: { testCase: true } } } },
        quizSubmission: { include: { answers: { include: { selectedOption: true, question: true } } } },
        shortAnswerSubmission: true,
        fileSubmission: true,
        grade: true,
      },
    });
  },

  findByStudentAndAssignment(studentId: string, assignmentId: string) {
    return prisma.submission.findUnique({
      where: { studentId_assignmentId: { studentId, assignmentId } },
      include: { grade: true },
    });
  },

  findByAssignment(assignmentId: string) {
    return prisma.submission.findMany({
      where: { assignmentId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        grade: true,
      },
      orderBy: { submittedAt: "desc" },
    });
  },

  create(data: { studentId: string; assignmentId: string }) {
    return prisma.submission.create({ data });
  },

  updateStatus(id: string, status: SubmissionStatus, submittedAt?: Date) {
    return prisma.submission.update({
      where: { id },
      data: { status, ...(submittedAt && { submittedAt }) },
    });
  },

  createGrade(submissionId: string, data: {
    score: number;
    maxScore: number;
    percentage: number;
    feedback?: string;
    isAiGraded?: boolean;
    gradedById?: string;
  }) {
    return prisma.grade.create({ data: { submissionId, ...data } });
  },

  updateGrade(submissionId: string, data: { score: number; percentage: number; feedback?: string }) {
    return prisma.grade.update({ where: { submissionId }, data });
  },
};
