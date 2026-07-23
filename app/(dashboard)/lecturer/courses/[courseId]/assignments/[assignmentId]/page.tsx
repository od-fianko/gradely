import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { format } from "date-fns";
import { Clock, Users, CheckCircle2, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PublishToggle } from "@/features/assignments/components/publish-toggle";
import { SubmissionsTable } from "@/features/assignments/components/submissions-table";
import { SimilarityCheck } from "@/features/assignments/components/similarity-check";

export const metadata: Metadata = { title: "Assignment — Gradely" };

export default async function LecturerAssignmentDetailPage({
  params,
}: {
  params: Promise<{ courseId: string; assignmentId: string }>;
}) {
  const session = await requireRole("LECTURER");
  const { courseId, assignmentId } = await params;

  const assignment = await prisma.assignment.findUnique({
    where:   { id: assignmentId },
    include: {
      course:             { select: { id: true, code: true, title: true, lecturerId: true } },
      shortAnswerDetails: true,
      programmingDetails: { select: { similarityCheckEnabled: true, similarityThreshold: true } },
      submissions: {
        include: {
          student:               { select: { id: true, name: true, email: true } },
          grade:                 true,
          shortAnswerSubmission: true,
          fileSubmission:        true,
          codeSubmission: {
            include: {
              testResults: {
                include: { testCase: { select: { title: true, points: true, isHidden: true } } },
                orderBy:  { testCase: { order: "asc" } },
              },
            },
          },
          quizSubmission: {
            include: {
              answers: {
                include: {
                  question:       { select: { text: true, points: true, kind: true, sampleAnswer: true } },
                  selectedOption: { select: { id: true, text: true, isCorrect: true } },
                },
              },
            },
          },
        },
        orderBy: { submittedAt: "desc" },
      },
    },
  });

  if (!assignment || assignment.course.lecturerId !== session.user.id) notFound();

  const graded   = assignment.submissions.filter((s) => s.grade);
  const ungraded = assignment.submissions.filter((s) => !s.grade);

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl">

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/lecturer/courses">Courses</Link>
        <span>/</span>
        <Link href={`/lecturer/courses/${courseId}`} className="hover:text-blue-600 transition-colors">
          {assignment.course.code}
        </Link>
        <span>/</span>
        <span className="text-foreground/90 font-medium truncate">{assignment.title}</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50">
              {assignment.type.replace("_", " ")}
            </Badge>
            {assignment.isPublished
              ? <Badge className="bg-emerald-500 hover:bg-emerald-600">Published</Badge>
              : <Badge variant="secondary">Draft</Badge>}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{assignment.title}</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">{assignment.description}</p>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> Due {format(new Date(assignment.dueDate), "dd MMM yyyy, h:mm a")}
            · {assignment.totalMarks} marks
          </p>
        </div>
        <PublishToggle assignmentId={assignment.id} isPublished={assignment.isPublished} courseId={courseId} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Submissions", value: assignment.submissions.length, icon: Users,        color: "text-blue-500"    },
          { label: "Graded",      value: graded.length,                 icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Awaiting",    value: ungraded.length,               icon: AlertCircle,  color: "text-orange-500"  },
          { label: "Total marks", value: assignment.totalMarks,         icon: CheckCircle2, color: "text-purple-500"  },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="shadow-sm">
            <CardContent className="pt-4 pb-3 flex items-center gap-3">
              <div className={`rounded-lg p-2 bg-muted/60 ${color}`}><Icon className="h-4 w-4" /></div>
              <div>
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {assignment.programmingDetails?.similarityCheckEnabled && (
        <SimilarityCheck assignmentId={assignmentId} threshold={assignment.programmingDetails.similarityThreshold} />
      )}

      <SubmissionsTable
        submissions={assignment.submissions}
        assignmentId={assignmentId}
        assignmentTitle={assignment.title}
        assignmentDesc={assignment.description}
        totalMarks={assignment.totalMarks}
        type={assignment.type}
        rubric={(assignment.shortAnswerDetails as { rubric?: string } | null)?.rubric ?? null}
      />
    </div>
  );
}
