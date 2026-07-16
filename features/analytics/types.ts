export type LecturerCourseAnalytics = {
  courseId: string;
  totalStudents: number;
  submissionRate: number;         // percentage
  averageScore: number;
  atRiskStudents: AtRiskStudent[];
  scoreDistribution: ScoreBucket[];
  assignmentStats: AssignmentStat[];
};

export type AtRiskStudent = {
  studentId: string;
  name: string;
  email: string;
  averageScore: number;
  missedAssignments: number;
  lastSubmission: Date | null;
};

export type ScoreBucket = {
  range: string;   // e.g. "0-49", "50-59", "60-69", "70-79", "80-89", "90-100"
  count: number;
};

export type AssignmentStat = {
  assignmentId: string;
  title: string;
  submissionRate: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
};

export type StudentAnalytics = {
  overallAverage: number;
  totalSubmissions: number;
  missedAssignments: number;
  gradesByAssignment: {
    assignmentId: string;
    title: string;
    score: number;
    maxScore: number;
    percentage: number;
    submittedAt: Date;
  }[];
};
