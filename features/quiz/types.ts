export type QuizOption = {
  id?: string;
  text: string;
  isCorrect: boolean;
  order: number;
};

export type QuizQuestion = {
  id?: string;
  text: string;
  points: number;
  order: number;
  isMultiple: boolean;
  options: QuizOption[];
};

export type CreateQuizInput = {
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  timeLimit?: number;
  questions: QuizQuestion[];
};

export type QuizAnswerInput = {
  questionId: string;
  selectedOptionId: string | null;
};

export type QuizResult = {
  totalScore: number;
  maxScore: number;
  percentage: number;
  correctCount: number;
  totalQuestions: number;
  answers: {
    questionId: string;
    questionText: string;
    isCorrect: boolean;
    pointsAwarded: number;
    selectedOption: string | null;
    correctOption: string;
  }[];
};
