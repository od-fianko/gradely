export type GradeInput = {
  score: number;
  feedback?: string;
};

export type GradingHistoryEntry = {
  id: string;
  score: number;
  feedback: string | null;
  action: string;
  createdAt: Date;
  gradedBy: { name: string; email: string };
};

export type GradeSummary = {
  score: number;
  maxScore: number;
  percentage: number;
  feedback: string | null;
  isAiGraded: boolean;
  gradedAt: Date;
};
