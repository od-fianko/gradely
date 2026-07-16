"use client";

import Link from "next/link";
import { BookOpen, Users, ClipboardList, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CourseCardProps {
  course: {
    id:          string;
    code:        string;
    title:       string;
    description: string | null;
    semester:    string;
    isActive:    boolean;
    lecturer?:   { name: string; email: string };
    _count?:     { enrollments: number; assignments: number };
  };
  role: "LECTURER" | "STUDENT" | "ADMIN";
}

const PALETTE = [
  "bg-blue-700",
  "bg-emerald-700",
  "bg-indigo-700",
  "bg-amber-700",
  "bg-rose-700",
  "bg-cyan-700",
];

function colorFor(code: string) {
  let h = 0;
  for (const c of code) h = (h * 31 + c.charCodeAt(0)) & 0xffff;
  return PALETTE[h % PALETTE.length];
}

export function CourseCard({ course, role }: CourseCardProps) {
  const href = role === "LECTURER"
    ? `/lecturer/courses/${course.id}`
    : `/student/courses/${course.id}`;

  return (
    <Link href={href} className="block group">
      <Card className="overflow-hidden hover:shadow-md transition-shadow border">
        <div className={`h-1.5 ${colorFor(course.code)}`} />

        <CardHeader className="pb-3 pt-4 px-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`inline-flex items-center rounded ${colorFor(course.code)} px-2 py-0.5 text-xs font-semibold text-white`}>
                  {course.code}
                </span>
                {!course.isActive && <Badge variant="secondary">Inactive</Badge>}
              </div>
              <h3 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {course.title}
              </h3>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 pb-5 space-y-3">
          {course.description && (
            <p className="text-xs text-muted-foreground line-clamp-2">{course.description}</p>
          )}

          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            {role === "STUDENT" && course.lecturer && (
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-blue-400" />
                {course.lecturer.name}
              </span>
            )}
            {course._count !== undefined && (
              <>
                <span className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  {course._count.enrollments} student{course._count.enrollments !== 1 ? "s" : ""}
                </span>
                <span className="flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-orange-400" />
                  {course._count.assignments} assignment{course._count.assignments !== 1 ? "s" : ""}
                </span>
              </>
            )}
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-purple-400" />
              {course.semester}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
