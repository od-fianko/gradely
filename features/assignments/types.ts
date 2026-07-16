import type { AssignmentType, GradingMethod, SubmissionStatus } from "@prisma/client";

export type AssignmentSummary = {
  id: string;
  title: string;
  type: AssignmentType;
  gradingMethod: GradingMethod;
  totalMarks: number;
  dueDate: Date;
  isPublished: boolean;
  courseId: string;
  _count: { submissions: number };
};

export type CreateAssignmentInput = {
  title: string;
  description: string;
  type: AssignmentType;
  totalMarks: number;
  passingMarks?: number;
  dueDate: string;
  allowLateSubmit?: boolean;
};

export type SubmissionSummary = {
  id: string;
  status: SubmissionStatus;
  submittedAt: Date | null;
  isLate: boolean;
  student: { id: string; name: string; email: string };
  grade: { score: number; maxScore: number; percentage: number } | null;
};
