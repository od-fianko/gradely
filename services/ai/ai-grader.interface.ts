// Abstraction for AI-assisted grading of short answers.
// Swap Claude for another model by implementing this interface.

export type GradingInput = {
  question: string;
  rubric: string;
  sampleAnswer?: string;
  studentAnswer: string;
  maxScore: number;
};

export type GradingOutput = {
  suggestedScore: number;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  reasoning: string;
};

export interface IAIGrader {
  grade(input: GradingInput): Promise<GradingOutput>;
}
