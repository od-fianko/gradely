import { Award } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface Props {
  grade: { score: number; maxScore: number; percentage: number; feedback: string | null };
  totalMarks: number;
}

function scoreColor(pct: number) {
  if (pct >= 70) return "text-emerald-600";
  if (pct >= 50) return "text-amber-600";
  return "text-red-600";
}

function barColor(pct: number) {
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 50) return "bg-amber-500";
  return "bg-red-500";
}

export function GradeCard({ grade }: Props) {
  return (
    <Card className="border-emerald-200 bg-emerald-50/50">
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start gap-4">
          <div className="rounded-xl bg-emerald-100 p-3">
            <Award className="h-6 w-6 text-emerald-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700 mb-0.5">Your grade</p>
            <p className={`text-3xl font-bold ${scoreColor(grade.percentage)}`}>
              {grade.percentage.toFixed(0)}%
              <span className="text-base font-normal text-muted-foreground ml-2">
                ({grade.score}/{grade.maxScore})
              </span>
            </p>
            <div className="mt-2 h-2 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${barColor(grade.percentage)}`}
                style={{ width: `${grade.percentage}%` }}
              />
            </div>
            {grade.feedback && (
              <p className="mt-3 text-sm text-slate-600 border-t border-emerald-200 pt-3">
                <span className="font-medium">Feedback: </span>{grade.feedback}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
