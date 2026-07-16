"use server";

import { requireRole } from "@/lib/auth/session";
import { courseRepository } from "@/repositories/course.repository";
import { createCourseSchema } from "@/features/courses/schemas/course.schema";
import type { ActionResult } from "@/types/api.types";
import { revalidatePath } from "next/cache";

export async function createCourseAction(
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  const session = await requireRole("LECTURER");

  const raw = {
    code: formData.get("code"),
    title: formData.get("title"),
    description: formData.get("description") || undefined,
    semester: formData.get("semester"),
  };

  const parsed = createCourseSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const existing = await courseRepository.findByCode(parsed.data.code);
  if (existing) {
    return { ok: false, error: `Course code ${parsed.data.code} already exists` };
  }

  const course = await courseRepository.create({
    ...parsed.data,
    lecturerId: session.user.id,
  });

  revalidatePath("/lecturer/courses");
  return { ok: true, data: { id: course.id } };
}

export async function enrollInCourseAction(
  courseId: string
): Promise<ActionResult<void>> {
  const session = await requireRole("STUDENT");

  const already = await courseRepository.isEnrolled(session.user.id, courseId);
  if (already) return { ok: false, error: "Already enrolled in this course" };

  await courseRepository.enroll(session.user.id, courseId);
  revalidatePath("/student/courses");
  return { ok: true, data: undefined };
}
