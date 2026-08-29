"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, RefreshCw, Upload, X, FileText, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface QuizQuestion {
  id: string; text: string; points: number; isMultiple: boolean;
  kind?: "MCQ" | "SHORT_TEXT";
  options: { id: string; text: string }[];
}

interface Props {
  assignment: {
    id:          string;
    type:        string;
    totalMarks:  number;
    quizDetails: { questions: QuizQuestion[] } | null;
    projectDetails?: { githubRequired: boolean; allowedFileTypes: string[]; maxFileSizeMB: number } | null;
  };
  existing: {
    id:     string;
    status: string;
    grade:  unknown | null;
    shortAnswerSubmission: { answer: string } | null;
    quizSubmission:        { answers: { questionId: string; selectedOption: { id: string } | null; textAnswer?: string | null }[] } | null;
    fileSubmission:        { originalName: string; fileUrl: string; githubUrl?: string | null } | null;
  } | null;
  courseId: string;
  deadline?: string | null; // ISO — timed attempts auto-submit at this moment
}

export function SubmissionForm({ assignment, existing, courseId, deadline }: Props) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [uploading,setUploading] = useState(false);

  // Short answer
  const [answer, setAnswer] = useState(existing?.shortAnswerSubmission?.answer ?? "");

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; fileName: string; originalName: string; fileType: string; fileSizeBytes: number } | null>(
    existing?.fileSubmission
      ? { url: existing.fileSubmission.fileUrl, fileName: existing.fileSubmission.originalName, originalName: existing.fileSubmission.originalName, fileType: "", fileSizeBytes: 0 }
      : null
  );

  // Programming Project — GitHub repo link (optional unless required)
  const [githubUrl, setGithubUrl] = useState(existing?.fileSubmission?.githubUrl ?? "");

  // Quiz
  const initAnswers = () => {
    const m: Record<string, string[]> = {};
    existing?.quizSubmission?.answers.forEach((a) => {
      if (a.selectedOption) m[a.questionId] = [a.selectedOption.id];
    });
    return m;
  };
  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>(initAnswers);

  const initTextAnswers = () => {
    const m: Record<string, string> = {};
    existing?.quizSubmission?.answers.forEach((a) => {
      if (a.textAnswer) m[a.questionId] = a.textAnswer;
    });
    return m;
  };
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>(initTextAnswers);

  const toggleOption = (questionId: string, optionId: string, isMultiple: boolean) => {
    setQuizAnswers((prev) => {
      const current = prev[questionId] ?? [];
      if (isMultiple) {
        return { ...prev, [questionId]: current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId] };
      }
      return { ...prev, [questionId]: [optionId] };
    });
  };

  const uploadFile = async (file: File) => {
    setUploading(true); setError(null);
    const form = new FormData();
    form.append("file", file);
    const res  = await fetch("/api/upload", { method: "POST", body: form });
    const json = await res.json();
    setUploading(false);
    if (!res.ok) { setError(json.error ?? "Upload failed"); return null; }
    return json.data as { url: string; fileName: string; originalName: string; fileType: string; fileSizeBytes: number };
  };

  const submit = async () => {
    setLoading(true); setError(null);
    let body: Record<string, unknown> = {};

    if (assignment.type === "SHORT_ANSWER") {
      if (!answer.trim()) { setError("Answer cannot be empty"); setLoading(false); return; }
      body = { answer };
    } else if (assignment.type === "MULTIPLE_CHOICE") {
      body = {
        answers: [
          ...Object.entries(quizAnswers).flatMap(([questionId, optIds]) =>
            optIds.map((selectedOptionId) => ({ questionId, selectedOptionId }))
          ),
          ...Object.entries(textAnswers)
            .filter(([, text]) => text.trim())
            .map(([questionId, textAnswer]) => ({ questionId, textAnswer })),
        ],
      };
    } else if (assignment.type === "FILE_UPLOAD") {
      let fileData = uploadedFile;
      if (selectedFile && !uploadedFile) {
        fileData = await uploadFile(selectedFile);
        if (!fileData) { setLoading(false); return; }
        setUploadedFile(fileData);
      }
      if (!fileData) { setError("Please select a file to upload"); setLoading(false); return; }
      body = { fileName: fileData.fileName, originalName: fileData.originalName, fileUrl: fileData.url, fileType: fileData.fileType, fileSizeBytes: fileData.fileSizeBytes };
    } else if (assignment.type === "PROJECT") {
      if (assignment.projectDetails?.githubRequired && !githubUrl.trim()) {
        setError("A GitHub repository link is required for this project"); setLoading(false); return;
      }
      let fileData = uploadedFile;
      if (selectedFile && !uploadedFile) {
        fileData = await uploadFile(selectedFile);
        if (!fileData) { setLoading(false); return; }
        setUploadedFile(fileData);
      }
      if (!fileData && !githubUrl.trim()) {
        setError("Upload your project files or link a GitHub repository"); setLoading(false); return;
      }
      body = {
        ...(fileData && { fileName: fileData.fileName, originalName: fileData.originalName, fileUrl: fileData.url, fileType: fileData.fileType, fileSizeBytes: fileData.fileSizeBytes }),
        githubUrl: githubUrl.trim() || null,
      };
    }

    const res  = await fetch(`/api/assignments/${assignment.id}/submissions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Submission failed"); return; }
    setDone(true);
    router.refresh();
  };

  // ── Timed attempt countdown ─────────────────────────────────────────────────
  const [remaining, setRemaining] = useState<number | null>(null);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (remaining === 0 && !autoSubmitted.current && !done) {
      autoSubmitted.current = true;
      submitRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, done]);

  const fmtClock = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  if (done || (existing?.grade)) {
    return (
      <Card className="border-emerald-200">
        <CardContent className="py-8 flex flex-col items-center text-center gap-2">
          <CheckCircle2 className="h-10 w-10 text-emerald-500" />
          <p className="font-semibold text-foreground">{existing?.grade ? "Assignment graded" : "Submitted!"}</p>
          <p className="text-sm text-muted-foreground">
            {existing?.grade ? "Check your grade above." : "Your submission has been recorded."}
          </p>
          {!existing?.grade && (
            <Button variant="outline" size="sm" className="mt-2 gap-1.5" onClick={() => setDone(false)}>
              <RefreshCw className="h-3.5 w-3.5" /> Edit submission
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {existing ? "Update submission" : "Submit your answer"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {deadline && remaining !== null && (
          <div className={`sticky top-0 z-10 flex items-center justify-between rounded-lg border px-4 py-2.5 ${remaining <= 60 ? "bg-red-50 border-red-200" : "bg-card"}`}>
            <span className="text-sm font-medium flex items-center gap-2">
              <Timer className={`h-4 w-4 ${remaining <= 60 ? "text-red-500" : "text-primary"}`} />
              Time remaining
            </span>
            <span className={`font-mono text-lg font-bold tabular-nums ${remaining <= 60 ? "text-red-600" : "text-foreground"}`}>
              {fmtClock(remaining)}
            </span>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        {/* ── SHORT ANSWER ── */}
        {assignment.type === "SHORT_ANSWER" && (
          <Textarea rows={8} placeholder="Write your answer here…" value={answer}
            onChange={(e) => setAnswer(e.target.value)} disabled={loading}
            className="font-mono text-sm resize-y" />
        )}

        {/* ── MULTIPLE CHOICE ── */}
        {assignment.type === "MULTIPLE_CHOICE" && assignment.quizDetails && (
          <div className="space-y-5">
            {assignment.quizDetails.questions.map((q, qi) => (
              <div key={q.id} className="rounded-xl border bg-card p-5 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-base font-medium leading-relaxed">
                    <span className="text-primary font-semibold mr-2">{qi + 1}.</span>
                    {q.text}
                  </p>
                  <span className="shrink-0 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    {q.points} pt{q.points !== 1 ? "s" : ""}
                  </span>
                </div>
                {q.kind === "SHORT_TEXT" ? (
                  <Textarea
                    rows={4}
                    placeholder="Write your answer in your own words…"
                    className="text-sm"
                    value={textAnswers[q.id] ?? ""}
                    onChange={(e) => setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                    disabled={loading}
                  />
                ) : (
                  <div className="space-y-1.5 pl-1">
                    {q.options.map((opt) => {
                      const selected = (quizAnswers[q.id] ?? []).includes(opt.id);
                      return (
                        <button key={opt.id} type="button"
                          onClick={() => toggleOption(q.id, opt.id, q.isMultiple)}
                          className={`w-full text-left text-sm px-3 py-2 rounded-lg border transition-all ${selected ? "border-blue-500 bg-blue-50 text-blue-700 font-medium" : "border-border hover:border-blue-300 hover:bg-muted/60 text-foreground/90"}`}>
                          {opt.text}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── FILE UPLOAD ── */}
        {assignment.type === "FILE_UPLOAD" && (
          <div className="space-y-3">
            {uploadedFile ? (
              <div className="flex items-center gap-3 rounded-xl border bg-emerald-50 border-emerald-200 px-4 py-3">
                <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-800 truncate">{uploadedFile.originalName}</p>
                  <p className="text-xs text-emerald-600">Uploaded successfully</p>
                </div>
                <button type="button" onClick={() => { setUploadedFile(null); setSelectedFile(null); }}
                  className="text-emerald-500 hover:text-red-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Click to select a file</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, ZIP — max 10 MB</p>
                {selectedFile && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">{selectedFile.name} selected</p>
                )}
                <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.zip,.txt,.py,.java,.c"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
              </div>
            )}
          </div>
        )}

        {/* ── PROJECT ── */}
        {assignment.type === "PROJECT" && (
          <div className="space-y-3">
            {uploadedFile ? (
              <div className="flex items-center gap-3 rounded-xl border bg-emerald-50 border-emerald-200 px-4 py-3">
                <FileText className="h-5 w-5 text-emerald-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-emerald-800 truncate">{uploadedFile.originalName}</p>
                  <p className="text-xs text-emerald-600">Uploaded successfully</p>
                </div>
                <button type="button" onClick={() => { setUploadedFile(null); setSelectedFile(null); }}
                  className="text-emerald-500 hover:text-red-500 transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-blue-300 hover:bg-blue-50/50 transition-all cursor-pointer"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">Click to select your project files</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {(assignment.projectDetails?.allowedFileTypes ?? ["zip", "pdf"]).join(", ").toUpperCase()}
                  {" — max "}{assignment.projectDetails?.maxFileSizeMB ?? 25} MB
                  {!assignment.projectDetails?.githubRequired && " (optional if you provide a GitHub link below)"}
                </p>
                {selectedFile && (
                  <p className="text-xs text-blue-600 mt-2 font-medium">{selectedFile.name} selected</p>
                )}
                <input ref={fileRef} type="file" className="hidden"
                  accept={(assignment.projectDetails?.allowedFileTypes ?? ["zip", "pdf"]).map((t) => `.${t}`).join(",")}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)} />
              </div>
            )}

            <div>
              <label className="text-xs font-medium text-muted-foreground">
                GitHub repository {assignment.projectDetails?.githubRequired ? "(required)" : "(optional)"}
              </label>
              <input
                type="url"
                placeholder="https://github.com/your-username/your-project"
                value={githubUrl}
                onChange={(e) => setGithubUrl(e.target.value)}
                disabled={loading}
                className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          {uploading && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" />Uploading file…</span>}
          <Button onClick={submit} disabled={loading || uploading}
            className="gap-2">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</> : (existing ? "Update submission" : "Submit")}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
