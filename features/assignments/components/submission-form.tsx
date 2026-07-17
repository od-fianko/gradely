"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2, RefreshCw, Play, Upload, X, FileText, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
    starterCode: string | null;
  };
  existing: {
    id:     string;
    status: string;
    grade:  unknown | null;
    shortAnswerSubmission: { answer: string } | null;
    codeSubmission:        { code: string; language: string } | null;
    quizSubmission:        { answers: { questionId: string; selectedOption: { id: string } | null; textAnswer?: string | null }[] } | null;
    fileSubmission:        { originalName: string; fileUrl: string } | null;
  } | null;
  courseId: string;
  deadline?: string | null; // ISO — timed attempts auto-submit at this moment
}

type TestResult = { testCaseId: string; title: string | null; passed: boolean; actual: string; expected: string; points: number };

const LANGUAGES = ["PYTHON", "JAVASCRIPT", "JAVA", "C"];

export function SubmissionForm({ assignment, existing, courseId, deadline }: Props) {
  const router   = useRouter();
  const fileRef  = useRef<HTMLInputElement>(null);

  const [loading,  setLoading]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [running,  setRunning]  = useState(false);
  const [results,  setResults]  = useState<TestResult[] | null>(null);
  const [uploading,setUploading] = useState(false);

  // Short answer
  const [answer, setAnswer] = useState(existing?.shortAnswerSubmission?.answer ?? "");

  // Code — seed with starter code if there's no existing submission yet
  const [code,     setCode]     = useState(existing?.codeSubmission?.code ?? assignment.starterCode ?? "");
  const [language, setLanguage] = useState(existing?.codeSubmission?.language ?? "PYTHON");

  // File
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFile, setUploadedFile] = useState<{ url: string; fileName: string; originalName: string; fileType: string; fileSizeBytes: number } | null>(
    existing?.fileSubmission
      ? { url: existing.fileSubmission.fileUrl, fileName: existing.fileSubmission.originalName, originalName: existing.fileSubmission.originalName, fileType: "", fileSizeBytes: 0 }
      : null
  );

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

  const runTests = async () => {
    if (!existing?.id) { setError("Submit your code first before running tests"); return; }
    setRunning(true); setError(null); setResults(null);
    const res  = await fetch("/api/execute", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ submissionId: existing.id, code, language }),
    });
    const json = await res.json();
    setRunning(false);
    if (!res.ok) { setError(json.error ?? "Execution failed"); return; }
    setResults(json.data.results);
  };

  const submit = async () => {
    setLoading(true); setError(null);
    let body: Record<string, unknown> = {};

    if (assignment.type === "SHORT_ANSWER") {
      if (!answer.trim()) { setError("Answer cannot be empty"); setLoading(false); return; }
      body = { answer };
    } else if (assignment.type === "PROGRAMMING") {
      if (!code.trim()) { setError("Code cannot be empty"); setLoading(false); return; }
      body = { code, language };
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

        {/* ── PROGRAMMING ── */}
        {assignment.type === "PROGRAMMING" && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Select value={language} onValueChange={setLanguage}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-2 text-violet-600 border-violet-200 hover:bg-violet-50"
                onClick={runTests} disabled={running || !existing?.id}>
                {running ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Running…</> : <><Play className="h-3.5 w-3.5" />Run Tests</>}
              </Button>
              {!existing?.id && <span className="text-xs text-muted-foreground">Save first to run tests</span>}
            </div>

            <Textarea rows={14} placeholder={`# Write your ${language} code here…`} value={code}
              onChange={(e) => setCode(e.target.value)} disabled={loading}
              className="font-mono text-sm bg-slate-950 text-emerald-400 border-slate-700 resize-y placeholder:text-slate-400" />

            {results && (
              <div className="space-y-1.5">
                {results.map((r, i) => (
                  <div key={r.testCaseId}
                    className={`flex items-start gap-3 rounded-lg px-3 py-2 text-xs ${r.passed ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200"}`}>
                    <Badge className={`shrink-0 text-xs ${r.passed ? "bg-emerald-500" : "bg-red-500"}`}>
                      {r.passed ? "PASS" : "FAIL"}
                    </Badge>
                    <div className="min-w-0">
                      <p className="font-medium">{r.title ?? `Test ${i + 1}`} — {r.points} pt{r.points !== 1 ? "s" : ""}</p>
                      {!r.passed && <p className="text-red-600 mt-0.5">Got: <code className="font-mono">{r.actual || "(no output)"}</code></p>}
                    </div>
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pt-1">
                  {results.filter((r) => r.passed).length}/{results.length} tests passed ·{" "}
                  {results.filter((r) => r.passed).reduce((s, r) => s + r.points, 0)}/
                  {results.reduce((s, r) => s + r.points, 0)} points
                </p>
              </div>
            )}
          </div>
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
