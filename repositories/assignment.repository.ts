import { prisma } from "@/lib/db/prisma";
import type { AssignmentType, GradingMethod } from "@prisma/client";

export const assignmentRepository = {
  findById(id: string) {
    return prisma.assignment.findUnique({
      where: { id },
      include: {
        programmingDetails: { include: { testCases: { orderBy: { order: "asc" } } } },
        quizDetails: { include: { questions: { include: { options: true }, orderBy: { order: "asc" } } } },
        shortAnswerDetails: true,
        fileUploadDetails: true,
        _count: { select: { submissions: true } },
      },
    });
  },

  findByCourse(courseId: string, publishedOnly = false) {
    return prisma.assignment.findMany({
      where: { courseId, ...(publishedOnly && { isPublished: true }) },
      include: { _count: { select: { submissions: true } } },
      orderBy: { dueDate: "asc" },
    });
  },

  create(data: {
    courseId: string;
    title: string;
    description: string;
    type: AssignmentType;
    gradingMethod: GradingMethod;
    totalMarks: number;
    passingMarks?: number;
    dueDate: Date;
    allowLateSubmit?: boolean;
  }) {
    return prisma.assignment.create({ data });
  },

  publish(id: string) {
    return prisma.assignment.update({
      where: { id },
      data: { isPublished: true, publishedAt: new Date() },
    });
  },

  update(id: string, data: Partial<{ title: string; description: string; dueDate: Date; totalMarks: number }>) {
    return prisma.assignment.update({ where: { id }, data });
  },

  delete(id: string) {
    return prisma.assignment.delete({ where: { id } });
  },
};
