export type TestCase = {
  id?: string;
  title?: string;
  input: string;
  expectedOutput: string;
  isHidden: boolean;
  points: number;
  order: number;
};

export type ExecutionResult = {
  passed: boolean;
  actualOutput: string;
  expectedOutput: string;
  executionTime: number;
  memoryUsed: number;
  error?: string;
  pointsAwarded: number;
};

export type CodeSubmissionResult = {
  totalScore: number;
  maxScore: number;
  passedCount: number;
  totalCount: number;
  results: ExecutionResult[];
};

export type CreateProgrammingAssignmentInput = {
  language: "PYTHON";
  starterCode?: string;
  timeLimit: number;
  memoryLimit: number;
  testCases: TestCase[];
};
