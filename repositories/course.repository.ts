import { prisma } from "@/lib/db/prisma";

export const courseRepository = {
  findById(id: string) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        lecturer: { select: { id: true, name: true, email: true } },
        _count: { select: { enrollments: true, assignments: true } },
      },
    });
  },

  findByCode(code: string) {
    return prisma.course.findUnique({ where: { code } });
  },

  findByLecturer(lecturerId: string) {
    return prisma.course.findMany({
      where: { lecturerId },
      include: { _count: { select: { enrollments: true, assignments: true } } },
      orderBy: { createdAt: "desc" },
    });
  },

  findByStudent(studentId: string) {
    return prisma.course.findMany({
      where: { enrollments: { some: { studentId } } },
      include: {
        lecturer: { select: { name: true } },
        _count: { select: { assignments: true } },
      },
    });
  },

  create(data: {
    code: string;
    title: string;
    description?: string;
    semester: string;
    lecturerId: string;
  }) {
    return prisma.course.create({ data });
  },

  update(id: string, data: Partial<{ title: string; description: string; semester: string; isActive: boolean }>) {
    return prisma.course.update({ where: { id }, data });
  },

  isEnrolled(studentId: string, courseId: string) {
    return prisma.enrollment.findUnique({
      where: { studentId_courseId: { studentId, courseId } },
    });
  },

  enroll(studentId: string, courseId: string) {
    return prisma.enrollment.create({ data: { studentId, courseId } });
  },

  unenroll(studentId: string, courseId: string) {
    return prisma.enrollment.delete({
      where: { studentId_courseId: { studentId, courseId } },
    });
  },
};
