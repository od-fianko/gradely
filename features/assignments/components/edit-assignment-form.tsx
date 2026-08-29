"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2, Save, ArrowLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

interface Assignment {
  id: string; title: string; description: string; type: string;
  totalMarks: number; passingMarks: number | null; dueDate: Date | string;
  timeLimitMinutes: number | null; allowLateSubmit: boolean; gradeWeightPercent: number | null;
  programmingDetails: {
    starterCode: string | null; difficulty: string; tags: string[]; autoGrade: boolean;
    functionName: string | null; referenceSolution: string | null;
    similarityCheckEnabled: boolean; similarityThreshold: number; requireManualReview: boolean;
  } | null;
  projectDetails: {
    brief: string; functionalRequirements: string; deliverables: string; rubric: string;
    githubRequired: boolean; allowedFileTypes: string[]; maxFileSizeMB: number;
  } | null;
  shortAnswerDetails: { rubric: string; sampleAnswer: string | null; wordLimit: number | null } | null;
  fileUploadDetails:  { allowedFileTypes: string[]; maxFileSizeMB: number; rubric: string | null } | null;
  quizDetails: { shuffleQuestions: boolean; shuffleOptions: boolean; timeLimit: number | null; _count: { questions: number } } | null;
  _count: { submissions: number };
}

interface Props {
  assignment: Assignment;
  courseId: string;
}

const toLocalInput = (d: Date | string) => {
  const date = new Date(d);
  const off = date.getTimezoneOffset();
  return new Date(date.getTime() - off * 60_000).toISOString().slice(0, 16);
};

export function EditAssignmentForm({ assignment: a, courseId }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [title, setTitle] = useState(a.title);
  const [description, setDescription] = useState(a.description);
  const [totalMarks, setTotalMarks] = useState(String(a.totalMarks));
  const [passingMarks, setPassingMarks] = useState(a.passingMarks != null ? String(a.passingMarks) : "");
  const [dueDate, setDueDate] = useState(toLocalInput(a.dueDate));
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(a.timeLimitMinutes != null ? String(a.timeLimitMinutes) : "");
  const [allowLateSubmit, setAllowLateSubmit] = useState(a.allowLateSubmit);
  const [gradeWeightPercent, setGradeWeightPercent] = useState(a.gradeWeightPercent != null ? String(a.gradeWeightPercent) : "");

  const [pd, setPd] = useState(a.programmingDetails ? { ...a.programmingDetails, tags: a.programmingDetails.tags.join(", ") } : null);
  const [prj, setPrj] = useState(a.projectDetails ? { ...a.projectDetails, allowedFileTypes: a.projectDetails.allowedFileTypes.join(", ") } : null);
  const [sa, setSa] = useState(a.shortAnswerDetails);
  const [fu, setFu] = useState(a.fileUploadDetails ? { ...a.fileUploadDetails, allowedFileTypes: a.fileUploadDetails.allowedFileTypes.join(", ") } : null);
  const [quiz, setQuiz] = useState(a.quizDetails);

  const save = async () => {
    setSaving(true); setError(null); setSaved(false);

    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim(),
      totalMarks: Number(totalMarks),
      passingMarks: passingMarks ? Number(passingMarks) : null,
      dueDate: new Date(dueDate).toISOString(),
      timeLimitMinutes: timeLimitMinutes ? Number(timeLimitMinutes) : null,
      allowLateSubmit,
      gradeWeightPercent: gradeWeightPercent ? Number(gradeWeightPercent) : null,
      ...(pd && {
        programmingDetails: {
          starterCode: pd.starterCode?.trim() || null,
          difficulty: pd.difficulty,
          tags: pd.tags.split(",").map((t) => t.trim()).filter(Boolean),
          autoGrade: pd.autoGrade,
          functionName: pd.functionName?.trim() || null,
          referenceSolution: pd.referenceSolution?.trim() || null,
          similarityCheckEnabled: pd.similarityCheckEnabled,
          similarityThreshold: Number(pd.similarityThreshold),
          requireManualReview: pd.requireManualReview,
        },
      }),
      ...(prj && {
        projectDetails: {
          brief: prj.brief.trim(),
          functionalRequirements: prj.functionalRequirements.trim(),
          deliverables: prj.deliverables.trim(),
          rubric: prj.rubric.trim(),
          githubRequired: prj.githubRequired,
          allowedFileTypes: prj.allowedFileTypes.split(",").map((t) => t.trim()).filter(Boolean),
          maxFileSizeMB: Number(prj.maxFileSizeMB),
        },
      }),
      ...(sa && { shortAnswerDetails: { rubric: sa.rubric.trim(), sampleAnswer: sa.sampleAnswer?.trim() || null, wordLimit: sa.wordLimit } }),
      ...(fu && {
        fileUploadDetails: {
          allowedFileTypes: fu.allowedFileTypes.split(",").map((t) => t.trim()).filter(Boolean),
          maxFileSizeMB: Number(fu.maxFileSizeMB),
          rubric: fu.rubric?.trim() || null,
        },
      }),
      ...(quiz && { quizDetails: { shuffleQuestions: quiz.shuffleQuestions, shuffleOptions: quiz.shuffleOptions, timeLimit: quiz.timeLimit } }),
    };

    const res = await fetch(`/api/assignments/${a.id}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) { setError(json.error ?? "Failed to save changes"); return; }
    setSaved(true);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      <Link href={`/lecturer/courses/${courseId}/assignments/${a.id}`}
        className="text-sm text-muted-foreground hover:text-blue-600 transition-colors inline-flex items-center gap-1.5">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to assignment
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-foreground">Edit assignment</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {a._count.submissions > 0
            ? `Changes apply immediately — ${a._count.submissions} student${a._count.submissions !== 1 ? "s have" : " has"} already submitted.`
            : "Changes are saved immediately, whether this assignment is published or still a draft."}
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Details</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5" disabled={saving} />
          </div>
          <div>
            <label className="text-sm font-medium">Description / Instructions</label>
            <Textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} className="mt-1.5" disabled={saving} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Total marks</label>
              <Input type="number" min={1} value={totalMarks} onChange={(e) => setTotalMarks(e.target.value)} className="mt-1.5" disabled={saving} />
            </div>
            <div>
              <label className="text-sm font-medium">Passing marks <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input type="number" min={0} value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} className="mt-1.5" disabled={saving} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Due date & time</label>
              <Input type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="mt-1.5" disabled={saving} />
            </div>
            <div>
              <label className="text-sm font-medium">Time limit, min <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input type="number" min={1} max={600} value={timeLimitMinutes} onChange={(e) => setTimeLimitMinutes(e.target.value)} className="mt-1.5" disabled={saving} />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Weight in final course grade <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input type="number" min={1} placeholder={`Default: ${totalMarks} (its total marks)`}
              value={gradeWeightPercent} onChange={(e) => setGradeWeightPercent(e.target.value)} className="mt-1.5" disabled={saving} />
          </div>
          <label className="flex items-center gap-2.5 text-sm">
            <input type="checkbox" checked={allowLateSubmit} onChange={(e) => setAllowLateSubmit(e.target.checked)}
              className="h-4 w-4 accent-primary" disabled={saving} />
            Allow late submissions
          </label>
        </CardContent>
      </Card>

      {pd && (
        <Card>
          <CardHeader><CardTitle className="text-base">Coding exercise settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Starter code</label>
              <Textarea rows={6} value={pd.starterCode ?? ""} onChange={(e) => setPd({ ...pd, starterCode: e.target.value })}
                className="mt-1.5 font-mono text-sm" disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Difficulty</label>
                <Select value={pd.difficulty} onValueChange={(v) => setPd({ ...pd, difficulty: v })}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="EASY">Beginner</SelectItem>
                    <SelectItem value="MEDIUM">Intermediate</SelectItem>
                    <SelectItem value="HARD">Advanced</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">Tags <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                <Input value={pd.tags} onChange={(e) => setPd({ ...pd, tags: e.target.value })} className="mt-1.5" disabled={saving} />
              </div>
            </div>
            {pd.functionName != null && (
              <div>
                <label className="text-sm font-medium">Function name</label>
                <Input value={pd.functionName ?? ""} onChange={(e) => setPd({ ...pd, functionName: e.target.value })} className="mt-1.5 font-mono" disabled={saving} />
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Reference solution <span className="text-muted-foreground font-normal">(hidden from students)</span></label>
              <Textarea rows={6} value={pd.referenceSolution ?? ""} onChange={(e) => setPd({ ...pd, referenceSolution: e.target.value })}
                className="mt-1.5 font-mono text-sm" disabled={saving} />
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={pd.autoGrade} onChange={(e) => setPd({ ...pd, autoGrade: e.target.checked })}
                className="h-4 w-4 accent-primary" disabled={saving} />
              Automatic grading enabled
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={pd.requireManualReview} onChange={(e) => setPd({ ...pd, requireManualReview: e.target.checked })}
                className="h-4 w-4 accent-primary" disabled={saving} />
              Hold auto-scores for my review before releasing
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={pd.similarityCheckEnabled} onChange={(e) => setPd({ ...pd, similarityCheckEnabled: e.target.checked })}
                className="h-4 w-4 accent-primary" disabled={saving} />
              Cross-student similarity screening enabled
            </label>
            <p className="text-xs text-muted-foreground">
              Test cases aren&apos;t editable from this page yet — open the assignment and use the submissions view for now.
            </p>
          </CardContent>
        </Card>
      )}

      {prj && (
        <Card>
          <CardHeader><CardTitle className="text-base">Project settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Project brief</label>
              <Textarea rows={6} value={prj.brief} onChange={(e) => setPrj({ ...prj, brief: e.target.value })} className="mt-1.5" disabled={saving} />
            </div>
            <div>
              <label className="text-sm font-medium">Functional requirements <span className="text-muted-foreground font-normal">(one per line)</span></label>
              <Textarea rows={4} value={prj.functionalRequirements} onChange={(e) => setPrj({ ...prj, functionalRequirements: e.target.value })} className="mt-1.5" disabled={saving} />
            </div>
            <div>
              <label className="text-sm font-medium">Deliverables <span className="text-muted-foreground font-normal">(one per line)</span></label>
              <Textarea rows={3} value={prj.deliverables} onChange={(e) => setPrj({ ...prj, deliverables: e.target.value })} className="mt-1.5" disabled={saving} />
            </div>
            <div>
              <label className="text-sm font-medium">Rubric</label>
              <Textarea rows={5} value={prj.rubric} onChange={(e) => setPrj({ ...prj, rubric: e.target.value })} className="mt-1.5" disabled={saving} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Allowed file types <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                <Input value={prj.allowedFileTypes} onChange={(e) => setPrj({ ...prj, allowedFileTypes: e.target.value })} className="mt-1.5" disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Max file size, MB</label>
                <Input type="number" min={1} value={prj.maxFileSizeMB} onChange={(e) => setPrj({ ...prj, maxFileSizeMB: Number(e.target.value) })} className="mt-1.5" disabled={saving} />
              </div>
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={prj.githubRequired} onChange={(e) => setPrj({ ...prj, githubRequired: e.target.checked })}
                className="h-4 w-4 accent-primary" disabled={saving} />
              GitHub repository link required
            </label>
          </CardContent>
        </Card>
      )}

      {sa && (
        <Card>
          <CardHeader><CardTitle className="text-base">Essay settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Grading rubric</label>
              <Textarea rows={5} value={sa.rubric} onChange={(e) => setSa({ ...sa, rubric: e.target.value })} className="mt-1.5" disabled={saving} />
            </div>
            <div>
              <label className="text-sm font-medium">Model answer <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea rows={4} value={sa.sampleAnswer ?? ""} onChange={(e) => setSa({ ...sa, sampleAnswer: e.target.value })} className="mt-1.5" disabled={saving} />
            </div>
            <div>
              <label className="text-sm font-medium">Word limit <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input type="number" min={1} value={sa.wordLimit ?? ""} onChange={(e) => setSa({ ...sa, wordLimit: e.target.value ? Number(e.target.value) : null })} className="mt-1.5" disabled={saving} />
            </div>
          </CardContent>
        </Card>
      )}

      {fu && (
        <Card>
          <CardHeader><CardTitle className="text-base">File upload settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Allowed file types <span className="text-muted-foreground font-normal">(comma-separated)</span></label>
                <Input value={fu.allowedFileTypes} onChange={(e) => setFu({ ...fu, allowedFileTypes: e.target.value })} className="mt-1.5" disabled={saving} />
              </div>
              <div>
                <label className="text-sm font-medium">Max file size, MB</label>
                <Input type="number" min={1} value={fu.maxFileSizeMB} onChange={(e) => setFu({ ...fu, maxFileSizeMB: Number(e.target.value) })} className="mt-1.5" disabled={saving} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Grading rubric <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea rows={4} value={fu.rubric ?? ""} onChange={(e) => setFu({ ...fu, rubric: e.target.value })} className="mt-1.5" disabled={saving} />
            </div>
          </CardContent>
        </Card>
      )}

      {quiz && (
        <Card>
          <CardHeader><CardTitle className="text-base">Quiz settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Time limit, min <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input type="number" min={1} value={quiz.timeLimit ?? ""} onChange={(e) => setQuiz({ ...quiz, timeLimit: e.target.value ? Number(e.target.value) : null })} className="mt-1.5 max-w-xs" disabled={saving} />
            </div>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={quiz.shuffleQuestions} onChange={(e) => setQuiz({ ...quiz, shuffleQuestions: e.target.checked })}
                className="h-4 w-4 accent-primary" disabled={saving} />
              Shuffle question order per student
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input type="checkbox" checked={quiz.shuffleOptions} onChange={(e) => setQuiz({ ...quiz, shuffleOptions: e.target.checked })}
                className="h-4 w-4 accent-primary" disabled={saving} />
              Shuffle option order per student
            </label>
            <p className="text-xs text-muted-foreground">
              This assignment has {quiz._count.questions} question{quiz._count.questions !== 1 ? "s" : ""} — question editing isn&apos;t supported from this page yet.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-end gap-3 pb-8">
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
