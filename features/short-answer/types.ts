export type ShortAnswerSubmissionInput = {
  answer: string;
};

export type AIGradingResult = {
  suggestedScore: number;
  maxScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
};

export type ShortAnswerGradeInput = {
  score: number;
  feedback?: string;
  overrideAI?: boolean;
};
