"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Loader2, CheckCircle2, Clock, Sparkles, ChevronDown, ChevronUp, ShieldAlert, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useRouter } from "next/navigation";

interface QuizAnswerDisplay {
  questionId:      string;
  question?:       { text: string; points: number };
  selectedOption?: { id: string; text: string; isCorrect: boolean } | null;
}

interface TestResultDisplay {
  id:             string;
  passed:         boolean;
  actualOutput?:  string | null;
  expectedOutput: string;
  pointsAwarded:  number;
  error?:         string | null;
  testCase:       { title?: string | null; points: number; isHidden: boolean };
}

interface CodeReview {
  quality:      string;
  summary:      string;
  strengths:    string[];
  improvements: string[];
  codeStyle:    string;
  complexity:   string;
}

interface Submission {
  id:          string;
  status:      string;
  submittedAt: Date | null;
  isLate:      boolean;
  integrityFlagged:   boolean;
  integrityScore:     number | null;
  integrityVerdict:   string | null;
  integrityReason:    string | null;
  integrityCheckedAt: Date | null;
  student:     { id: string; name: string; email: string };
  grade:       { score: number; maxScore: number; percentage: number; feedback: string | null } | null;
  shortAnswerSubmission: { answer: string } | null;
  codeSubmission: {
    code:        string;
    language:    string;
    testResults: TestResultDisplay[];
  } | null;
  fileSubmission: { originalName: string; fileUrl: string } | null;
  quizSubmission: { answers: QuizAnswerDisplay[] } | null;
}

interface Props {
  submissions:      Submission[];
  assignmentId:     string;
  assignmentTitle?: string;
  assignmentDesc?:  string;
  totalMarks:       number;
  type:             string;
  rubric:           string | null;
}

const QUALITY_STYLE: Record<string, string> = {
  excellent: "text-emerald-600 bg-emerald-50 border-emerald-200",
  good:      "text-blue-600 bg-blue-50 border-blue-200",
  fair:      "text-amber-600 bg-amber-50 border-amber-200",
  poor:      "text-red-600 bg-red-50 border-red-200",
};

export function SubmissionsTable({
  submissions, assignmentId, assignmentTitle, assignmentDesc, totalMarks, type, rubric,
}: Props) {
  const router = useRouter();
  const [expanded,      setExpanded]      = useState<string | null>(null);
  const [scores,        setScores]        = useState<Record<string, string>>({});
  const [feedbacks,     setFeedbacks]     = useState<Record<string, string>>({});
  const [saving,        setSaving]        = useState<Record<string, boolean>>({});
  const [aiLoading,     setAiLoading]     = useState<Record<string, boolean>>({});
  const [codeReview,    setCodeReview]    = useState<Record<string, CodeReview>>({});
  const [reviewLoading, setReviewLoading] = useState<Record<string, boolean>>({});
  const [showReview,    setShowReview]    = useState<Record<string, boolean>>({});
  const [integrityLoading, setIntegrityLoading] = useState<Record<string, boolean>>({});

  const runIntegrity = async (submissionId: string) => {
    setIntegrityLoading((s) => ({ ...s, [submissionId]: true }));
    await fetch("/api/ai/check-integrity", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ submissionId }),
    });
    setIntegrityLoading((s) => ({ ...s, [submissionId]: false }));
    router.refresh();
  };

  const saveGrade = async (submissionId: string) => {
    setSaving((s) => ({ ...s, [submissionId]: true }));
    await fetch(`/api/assignments/${assignmentId}/grade`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        submissionId,
        marksObtained: Number(scores[submissionId] ?? 0),
        feedback:      feedbacks[submissionId] ?? "",
      }),
    });
    setSaving((s) => ({ ...s, [submissionId]: false }));
    router.refresh();
  };

  const getAiFeedback = async (submissionId: string, answer: string) => {
    setAiLoading((s) => ({ ...s, [submissionId]: true }));
    const res  = await fetch("/api/ai/grade-short-answer", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ submissionId, answer, rubric, totalMarks }),
    });
    const json = await res.json();
    setAiLoading((s) => ({ ...s, [submissionId]: false }));
    if (res.ok && json.data) {
      setScores((s)    => ({ ...s, [submissionId]: String(json.data.suggestedScore ?? "") }));
      setFeedbacks((s) => ({ ...s, [submissionId]: json.data.feedback ?? "" }));
    }
  };

  const getCodeReview = async (submissionId: string, code: string, language: string) => {
    setReviewLoading((s) => ({ ...s, [submissionId]: true }));
    const res  = await fetch("/api/ai/review-code", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        code, language,
        assignmentTitle: assignmentTitle ?? "",
        assignmentDescription: assignmentDesc ?? "",
      }),
    });
    const json = await res.json();
    setReviewLoading((s) => ({ ...s, [submissionId]: false }));
    if (res.ok && json.data) {
      setCodeReview((s) => ({ ...s, [submissionId]: json.data }));
      setShowReview((s) => ({ ...s, [submissionId]: true }));
    }
  };

  if (submissions.length === 0)
    return (
      <Card className="border-dashed">
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          No submissions yet.
        </CardContent>
      </Card>
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Submissions ({submissions.length})</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {submissions.map((sub) => {
            const isExpanded  = expanded === sub.id;
            const hasGrade    = !!sub.grade;
            const testResults = sub.codeSubmission?.testResults ?? [];
            const passedTests = testResults.filter((r) => r.passed).length;

            return (
              <div key={sub.id} className="px-5 py-4">
                {/* Row header */}
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-800 truncate">{sub.student.name}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{sub.student.email}</span>
                      {sub.submittedAt && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(sub.submittedAt), "dd MMM, h:mm a")}
                        </span>
                      )}
                      {sub.isLate && <Badge variant="destructive" className="text-xs">Late</Badge>}
                      {sub.integrityFlagged && (
                        <Badge variant="destructive" className="text-xs gap-1">
                          <ShieldAlert className="h-3 w-3" /> Integrity {sub.integrityScore != null ? `${sub.integrityScore}%` : ""}
                        </Badge>
                      )}
                      {!sub.integrityFlagged && sub.integrityCheckedAt && (
                        <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200 bg-emerald-50">
                          <ShieldCheck className="h-3 w-3" /> Original
                        </Badge>
                      )}
                      {testResults.length > 0 && (
                        <Badge variant="outline" className={`text-xs ${passedTests === testResults.length ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-amber-600 border-amber-200 bg-amber-50"}`}>
                          {passedTests}/{testResults.length} tests passed
                        </Badge>
                      )}
                      {hasGrade && (
                        <Badge className="bg-emerald-500 text-xs">
                          {sub.grade!.score}/{sub.grade!.maxScore} · {sub.grade!.percentage.toFixed(0)}%
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setExpanded(isExpanded ? null : sub.id)}>
                    {isExpanded ? "Collapse" : hasGrade ? "Review" : "Grade"}
                  </Button>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="mt-4 space-y-4 border-t pt-4">

                    {/* Integrity report */}
                    {sub.integrityCheckedAt ? (
                      <div className={`rounded-lg border p-3 ${sub.integrityFlagged ? "bg-red-50 border-red-200" : "bg-emerald-50/50 border-emerald-200"}`}>
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <p className={`text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5 ${sub.integrityFlagged ? "text-red-700" : "text-emerald-700"}`}>
                            {sub.integrityFlagged ? <ShieldAlert className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                            Integrity check — {sub.integrityVerdict ?? (sub.integrityFlagged ? "Flagged" : "No concerns")}
                            {sub.integrityScore != null && <span className="font-normal normal-case">({sub.integrityScore}% AI-likelihood)</span>}
                          </p>
                          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs"
                            onClick={() => runIntegrity(sub.id)} disabled={integrityLoading[sub.id]}>
                            {integrityLoading[sub.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : "Re-check"}
                          </Button>
                        </div>
                        {sub.integrityReason && (
                          <p className={`text-xs mt-1.5 ${sub.integrityFlagged ? "text-red-600" : "text-emerald-700/80"}`}>
                            {sub.integrityReason}
                          </p>
                        )}
                      </div>
                    ) : (sub.shortAnswerSubmission || sub.codeSubmission) && (
                      <Button type="button" variant="outline" size="sm" className="gap-1.5"
                        onClick={() => runIntegrity(sub.id)} disabled={integrityLoading[sub.id]}>
                        {integrityLoading[sub.id]
                          ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Checking…</>
                          : <><ShieldAlert className="h-3.5 w-3.5" />Run integrity check</>}
                      </Button>
                    )}

                    {/* Short answer */}
                    {sub.shortAnswerSubmission && (
                      <div className="rounded-lg bg-slate-50 border p-3">
                        <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wide">Answer</p>
                        <p className="text-sm text-slate-700 whitespace-pre-wrap">{sub.shortAnswerSubmission.answer}</p>
                        {rubric && (
                          <p className="text-xs text-muted-foreground mt-2 border-t pt-2">
                            <span className="font-medium">Rubric:</span> {rubric}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Code + test results + AI review */}
                    {sub.codeSubmission && (
                      <div className="space-y-3">
                        <div className="rounded-lg bg-slate-900 border p-3 overflow-x-auto">
                          <p className="text-xs font-semibold text-slate-400 mb-2">{sub.codeSubmission.language}</p>
                          <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">{sub.codeSubmission.code}</pre>
                        </div>

                        {testResults.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                              Test Results — {passedTests}/{testResults.length} passed
                            </p>
                            {testResults.map((r, i) => (
                              <div key={r.id}
                                className={`flex items-start gap-3 rounded-lg px-3 py-2 text-xs border ${r.passed ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200"}`}>
                                <Badge className={`shrink-0 text-xs ${r.passed ? "bg-emerald-500" : "bg-red-500"}`}>
                                  {r.passed ? "PASS" : "FAIL"}
                                </Badge>
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium">
                                    {r.testCase.title ?? `Test ${i + 1}`}
                                    {r.testCase.isHidden && <span className="ml-1 text-muted-foreground">(hidden)</span>}
                                    <span className="ml-1 text-muted-foreground">· {r.pointsAwarded}/{r.testCase.points} pts</span>
                                  </p>
                                  {!r.passed && (
                                    <p className="text-red-600 mt-0.5">
                                      Got: <code className="font-mono">{r.actualOutput || "(no output)"}</code>
                                      {" · "}Expected: <code className="font-mono">{r.expectedOutput}</code>
                                    </p>
                                  )}
                                  {r.error && <p className="text-red-500 mt-0.5 font-mono truncate">{r.error}</p>}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* AI code review button */}
                        <div className="flex items-center gap-2">
                          <Button type="button" variant="outline" size="sm"
                            className="gap-1.5 text-purple-600 border-purple-200 hover:bg-purple-50"
                            disabled={reviewLoading[sub.id]}
                            onClick={() => {
                              if (codeReview[sub.id]) {
                                setShowReview((s) => ({ ...s, [sub.id]: !s[sub.id] }));
                              } else {
                                getCodeReview(sub.id, sub.codeSubmission!.code, sub.codeSubmission!.language);
                              }
                            }}>
                            {reviewLoading[sub.id]
                              ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Reviewing…</>
                              : <><Sparkles className="h-3.5 w-3.5" />AI Code Review</>}
                          </Button>
                          {codeReview[sub.id] && (
                            <button type="button"
                              onClick={() => setShowReview((s) => ({ ...s, [sub.id]: !s[sub.id] }))}
                              className="text-xs text-muted-foreground flex items-center gap-1 hover:text-slate-700">
                              {showReview[sub.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                              {showReview[sub.id] ? "Hide" : "Show"} review
                            </button>
                          )}
                        </div>

                        {showReview[sub.id] && codeReview[sub.id] && (() => {
                          const r = codeReview[sub.id];
                          return (
                            <div className="rounded-lg border p-4 space-y-3 bg-purple-50/40 border-purple-100">
                              <div className="flex items-center gap-2">
                                <Sparkles className="h-4 w-4 text-purple-500" />
                                <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">AI Code Review</span>
                                <Badge variant="outline" className={`text-xs capitalize ${QUALITY_STYLE[r.quality] ?? ""}`}>
                                  {r.quality}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-700">{r.summary}</p>
                              <div className="grid grid-cols-2 gap-3 text-xs">
                                {r.strengths?.length > 0 && (
                                  <div>
                                    <p className="font-semibold text-emerald-700 mb-1">Strengths</p>
                                    <ul className="space-y-0.5">{r.strengths.map((s, i) => <li key={i} className="text-slate-600">• {s}</li>)}</ul>
                                  </div>
                                )}
                                {r.improvements?.length > 0 && (
                                  <div>
                                    <p className="font-semibold text-amber-700 mb-1">Improvements</p>
                                    <ul className="space-y-0.5">{r.improvements.map((s, i) => <li key={i} className="text-slate-600">• {s}</li>)}</ul>
                                  </div>
                                )}
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-xs border-t pt-2">
                                <p><span className="font-medium text-slate-600">Style:</span> {r.codeStyle}</p>
                                <p><span className="font-medium text-slate-600">Complexity:</span> {r.complexity}</p>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* Quiz answers */}
                    {sub.quizSubmission && sub.quizSubmission.answers.length > 0 && (
                      <div className="rounded-lg bg-slate-50 border p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Quiz Answers</p>
                        {sub.quizSubmission.answers.map((a, i) => (
                          <div key={a.questionId} className="text-sm">
                            <p className="font-medium text-slate-700 text-xs">
                              Q{i + 1}. {a.question?.text ?? a.questionId}
                              {a.question && <span className="ml-1 text-muted-foreground">({a.question.points} pt{a.question.points !== 1 ? "s" : ""})</span>}
                            </p>
                            {a.selectedOption ? (
                              <p className={`text-xs mt-0.5 ${a.selectedOption.isCorrect ? "text-emerald-600" : "text-red-600"}`}>
                                → {a.selectedOption.text} {a.selectedOption.isCorrect ? "✓" : "✗"}
                              </p>
                            ) : (
                              <p className="text-xs mt-0.5 text-muted-foreground">No answer selected</p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* File */}
                    {sub.fileSubmission && (
                      <div className="rounded-lg bg-slate-50 border p-3">
                        <p className="text-xs font-semibold text-slate-500 mb-1">File</p>
                        <a href={sub.fileSubmission.fileUrl} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline">
                          {sub.fileSubmission.originalName}
                        </a>
                      </div>
                    )}

                    {/* Grading controls */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Score (max {totalMarks})</label>
                        <Input type="number" min={0} max={totalMarks} className="mt-1"
                          value={scores[sub.id] ?? sub.grade?.score ?? ""}
                          onChange={(e) => setScores((s) => ({ ...s, [sub.id]: e.target.value }))} />
                      </div>
                      <div className="flex items-end">
                        {type === "SHORT_ANSWER" && sub.shortAnswerSubmission && (
                          <Button variant="outline" size="sm" className="w-full text-purple-600 border-purple-200 hover:bg-purple-50"
                            onClick={() => getAiFeedback(sub.id, sub.shortAnswerSubmission!.answer)}
                            disabled={aiLoading[sub.id]}>
                            {aiLoading[sub.id]
                              ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Grading…</>
                              : <><Sparkles className="mr-1.5 h-3.5 w-3.5" />AI Suggest</>}
                          </Button>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-medium text-slate-600">Feedback</label>
                      <Textarea className="mt-1" rows={3} placeholder="Write feedback for the student…"
                        value={feedbacks[sub.id] ?? sub.grade?.feedback ?? ""}
                        onChange={(e) => setFeedbacks((s) => ({ ...s, [sub.id]: e.target.value }))} />
                    </div>

                    <div className="flex justify-end">
                      <Button onClick={() => saveGrade(sub.id)}
                        disabled={saving[sub.id] || !scores[sub.id]}
                        className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
                        {saving[sub.id]
                          ? <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />Saving…</>
                          : <><CheckCircle2 className="mr-2 h-3.5 w-3.5" />{hasGrade ? "Update grade" : "Save grade"}</>}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
