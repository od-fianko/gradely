"use client";

import Link from "next/link";
import { format, isPast, isWithinInterval, addDays } from "date-fns";
import { Clock, Users, ChevronRight, FileText, Code2, CheckSquare, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const TYPE_META = {
  PROGRAMMING:     { label: "Programming",    icon: Code2,        color: "bg-violet-50 text-violet-600 border-violet-200"  },
  MULTIPLE_CHOICE: { label: "Quiz",           icon: CheckSquare,  color: "bg-blue-50 text-blue-600 border-blue-200"         },
  SHORT_ANSWER:    { label: "Short Answer",   icon: FileText,     color: "bg-amber-50 text-amber-600 border-amber-200"      },
  FILE_UPLOAD:     { label: "File Upload",    icon: Upload,       color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
};

interface Props {
  assignment: {
    id:          string;
    title:       string;
    type:        keyof typeof TYPE_META;
    totalMarks:  number;
    dueDate:     Date;
    isPublished: boolean;
    _count?:     { submissions: number };
    grade?:      { score: number; maxScore: number; percentage: number } | null;
  };
  courseId: string;
  role:     "LECTURER" | "STUDENT";
}

export function AssignmentRow({ assignment: a, courseId, role }: Props) {
  const meta    = TYPE_META[a.type] ?? TYPE_META.SHORT_ANSWER;
  const Icon    = meta.icon;
  const due     = new Date(a.dueDate);
  const overdue = isPast(due);
  const dueSoon = !overdue && isWithinInterval(new Date(), { start: new Date(), end: addDays(due, 0) }) &&
                  due.getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  const href = role === "LECTURER"
    ? `/lecturer/courses/${courseId}/assignments/${a.id}`
    : `/student/courses/${courseId}/assignments/${a.id}`;

  return (
    <Link href={href}
      className="flex items-center gap-4 rounded-xl border bg-white px-4 py-3.5 hover:shadow-md hover:border-blue-200 transition-all duration-200 group">

      <div className={`rounded-lg border p-2 flex-shrink-0 ${meta.color}`}>
        <Icon className="h-4 w-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium text-sm text-slate-800 truncate group-hover:text-blue-600 transition-colors">
            {a.title}
          </p>
          {!a.isPublished && role === "LECTURER" && (
            <Badge variant="secondary" className="text-xs">Draft</Badge>
          )}
          {a.grade && (
            <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-200 bg-emerald-50">
              {a.grade.percentage.toFixed(0)}%
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground flex-wrap">
          <span className={`flex items-center gap-1 ${overdue ? "text-red-500" : dueSoon ? "text-orange-500" : ""}`}>
            <Clock className="h-3 w-3" />
            {overdue ? "Overdue — " : "Due "}
            {format(due, "dd MMM yyyy, h:mm a")}
          </span>
          <span>{a.totalMarks} marks</span>
          {a._count !== undefined && role === "LECTURER" && (
            <span className="flex items-center gap-1">
              <Users className="h-3 w-3" /> {a._count.submissions} submitted
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-blue-500 transition-colors flex-shrink-0" />
    </Link>
  );
}
