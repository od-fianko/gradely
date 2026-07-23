export interface WeightedGradeInput {
  percentage: number;
  weight:     number;
}

/** Resolves an assignment's weight: the lecturer's explicit override, or its
 *  total marks as a points-based fallback so every assignment always counts. */
export function resolveWeight(gradeWeightPercent: number | null, totalMarks: number): number {
  return gradeWeightPercent ?? totalMarks;
}

/** Σ(percentage × weight) / Σ(weight) — null when there's nothing to weight. */
export function computeWeightedAverage(grades: WeightedGradeInput[]): number | null {
  const totalWeight = grades.reduce((s, g) => s + g.weight, 0);
  if (totalWeight <= 0) return null;
  const weightedSum = grades.reduce((s, g) => s + g.percentage * g.weight, 0);
  return weightedSum / totalWeight;
}
