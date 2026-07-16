"use server";

import { requireRole } from "@/lib/auth/session";
import { assignmentRepository } from "@/repositories/assignment.repository";
import { createAssignmentSchema } from "@/features/assignments/schemas/assignment.schema";
import type { ActionResult } from "@/types/api.types";
import type { GradingMethod } from "@prisma/client";
import { revalidatePath } from "next/cache";

const GRADING_METHOD_MAP: Record<string, GradingMethod> = {
  PROGRAMMING: "AUTOMATIC",
  MULTIPLE_CHOICE: "AUTOMATIC",
  SHORT_ANSWER: "AI_ASSISTED",
  FILE_UPLOAD: "MANUAL",
};

export async function createAssignmentAction(
  courseId: string,
  formData: FormData
): Promise<ActionResult<{ id: string }>> {
  await requireRole("LECTURER");

  const raw = {
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    totalMarks: Number(formData.get("totalMarks")),
    passingMarks: formData.get("passingMarks") ? Number(formData.get("passingMarks")) : undefined,
    dueDate: formData.get("dueDate"),
    allowLateSubmit: formData.get("allowLateSubmit") === "true",
  };

  const parsed = createAssignmentSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  const assignment = await assignmentRepository.create({
    courseId,
    ...parsed.data,
    gradingMethod: GRADING_METHOD_MAP[parsed.data.type],
    dueDate: new Date(parsed.data.dueDate),
  });

  revalidatePath(`/lecturer/courses/${courseId}/assignments`);
  return { ok: true, data: { id: assignment.id } };
}

export async function publishAssignmentAction(
  assignmentId: string,
  courseId: string
): Promise<ActionResult<void>> {
  await requireRole("LECTURER");

  await assignmentRepository.publish(assignmentId);

  revalidatePath(`/lecturer/courses/${courseId}/assignments`);
  return { ok: true, data: undefined };
}
