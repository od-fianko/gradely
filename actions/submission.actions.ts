"use server";

import { requireRole } from "@/lib/auth/session";
import { submissionRepository } from "@/repositories/submission.repository";
import { assignmentRepository } from "@/repositories/assignment.repository";
import { isOverdue } from "@/lib/utils/date";
import type { ActionResult } from "@/types/api.types";

export async function startSubmissionAction(
  assignmentId: string
): Promise<ActionResult<{ submissionId: string }>> {
  const session = await requireRole("STUDENT");

  const assignment = await assignmentRepository.findById(assignmentId);
  if (!assignment) return { ok: false, error: "Assignment not found" };
  if (!assignment.isPublished) return { ok: false, error: "Assignment is not available" };

  const existing = await submissionRepository.findByStudentAndAssignment(
    session.user.id,
    assignmentId
  );
  if (existing) return { ok: true, data: { submissionId: existing.id } };

  const submission = await submissionRepository.create({
    studentId: session.user.id,
    assignmentId,
  });

  return { ok: true, data: { submissionId: submission.id } };
}
