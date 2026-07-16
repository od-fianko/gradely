"use server";

import { requireRole } from "@/lib/auth/session";
import { submissionRepository } from "@/repositories/submission.repository";
import type { ActionResult } from "@/types/api.types";
import { revalidatePath } from "next/cache";

export async function gradeSubmissionAction(
  submissionId: string,
  data: { score: number; feedback?: string }
): Promise<ActionResult<void>> {
  const session = await requireRole("LECTURER");

  const submission = await submissionRepository.findById(submissionId);
  if (!submission) return { ok: false, error: "Submission not found" };

  const maxScore = submission.assignment?.totalMarks ?? 100;
  const percentage = (data.score / maxScore) * 100;

  if (submission.grade) {
    await submissionRepository.updateGrade(submissionId, {
      score: data.score,
      percentage,
      feedback: data.feedback,
    });
  } else {
    await submissionRepository.createGrade(submissionId, {
      score: data.score,
      maxScore,
      percentage,
      feedback: data.feedback,
      gradedById: session.user.id,
    });
  }

  await submissionRepository.updateStatus(submissionId, "GRADED");

  revalidatePath(`/lecturer`);
  return { ok: true, data: undefined };
}
