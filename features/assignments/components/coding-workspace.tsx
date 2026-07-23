"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Editor, { type OnMount } from "@monaco-editor/react";
import {
  X, Timer, Loader2, Play, Sparkles, Send, Settings, Cloud, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { MarkdownText } from "@/features/assignments/components/markdown-text";

interface TestCase {
  id: string; title: string | null; input: string; expectedOutput: string;
}

interface RunResult {
  testCaseId: string; title: string | null; passed: boolean;
  actual: string; expected: string; points: number;
}

interface Props {
  assignment: {
    id: string; title: string; description: string;
    courseId: string; courseCode: string; courseTitle: string;
    totalMarks: number; timeLimitMinutes: number | null;
    language: string; difficulty: "EASY" | "MEDIUM" | "HARD";
    timeLimitSeconds: number; memoryLimitMB: number;
    hiddenTestCount: number;
    testCases: TestCase[];
  };
  submissionId: string;
  initialCode: string;
  deadline: string | null; // ISO
  overdue: boolean;
}

const EXT: Record<string, string> = { PYTHON: "py", JAVASCRIPT: "js", JAVA: "java", C: "c" };
const MONACO_LANG: Record<string, string> = { PYTHON: "python", JAVASCRIPT: "javascript", JAVA: "java", C: "c" };
const DIFFICULTY_STYLE: Record<string, string> = {
  EASY:   "text-emerald-700 bg-emerald-50 border-emerald-200",
  MEDIUM: "text-amber-700 bg-amber-50 border-amber-200",
  HARD:   "text-red-700 bg-red-50 border-red-200",
};

type ChatMessage = { role: "user" | "assistant"; content: string };

export function CodingWorkspace({ assignment: a, submissionId, initialCode, deadline, overdue }: Props) {
  const router = useRouter();

  const [code, setCode]         = useState(initialCode);
  const [fontSize, setFontSize] = useState(14);
  const [cursor, setCursor]     = useState({ line: 1, col: 1 });

  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [running, setRunning]   = useState(false);
  const [results, setResults]   = useState<RunResult[] | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitted,  setSubmitted]  = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Countdown ────────────────────────────────────────────────────────────────
  const [remaining, setRemaining] = useState<number | null>(null);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, Math.floor((new Date(deadline).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const fmtClock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── Autosave (debounced) ─────────────────────────────────────────────────────
  const scheduleSave = useCallback((nextCode: string) => {
    if (submitted) return;
    setSaveState("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await fetch(`/api/assignments/${a.id}/draft`, {
          method:  "PATCH",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ code: nextCode, language: a.language }),
        });
        setSaveState("saved");
      } catch {
        setSaveState("idle");
      }
    }, 1200);
  }, [a.id, a.language, submitted]);

  const handleCodeChange = (value: string | undefined) => {
    const next = value ?? "";
    setCode(next);
    scheduleSave(next);
  };

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  // ── Run visible tests ────────────────────────────────────────────────────────
  const runCode = async () => {
    setRunning(true); setRunError(null);
    const res  = await fetch("/api/execute", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ submissionId, code, language: a.language }),
    });
    const json = await res.json();
    setRunning(false);
    if (!res.ok) { setRunError(json.error ?? "Execution failed"); return; }
    setResults(json.data.results);
  };

  // ── Final submit ─────────────────────────────────────────────────────────────
  const submitExam = async () => {
    if (!window.confirm("Submit your final answer? You won't be able to change it afterwards.")) return;
    setSubmitting(true); setSubmitError(null);

    // Run the full grading pass (all test cases, including hidden), then lock the submission in.
    await fetch("/api/execute", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ submissionId, code, language: a.language }),
    }).catch(() => null);

    const res  = await fetch(`/api/assignments/${a.id}/submissions`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ code, language: a.language }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) { setSubmitError(json.error ?? "Submission failed"); return; }
    setSubmitted(true);
    setTimeout(() => {
      router.push(`/student/courses/${a.courseId}/assignments/${a.id}`);
    }, 1400);
  };

  useEffect(() => {
    if (remaining === 0 && !autoSubmitted.current && !submitted && !submitting) {
      autoSubmitted.current = true;
      submitExam();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  const exit = () => {
    if (window.confirm("Exit the assessment? Your saved progress will remain, but the timer keeps running.")) {
      router.push(`/student/courses/${a.courseId}/assignments/${a.id}`);
    }
  };

  const onMountEditor: OnMount = (editor) => {
    editor.onDidChangeCursorPosition((e) => {
      setCursor({ line: e.position.lineNumber, col: e.position.column });
    });
  };

  // ── AI Tutor chat ────────────────────────────────────────────────────────────
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat, chatLoading]);

  const sendChat = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;
    setChatInput("");
    const nextChat: ChatMessage[] = [...chat, { role: "user", content: message }];
    setChat(nextChat);
    setChatLoading(true);
    const res  = await fetch("/api/ai/tutor", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ assignmentId: a.id, code, message, history: nextChat.slice(0, -1) }),
    });
    const json = await res.json();
    setChatLoading(false);
    setChat((prev) => [...prev, { role: "assistant", content: res.ok ? json.data.reply : "I couldn't reach the tutor just now — try again in a moment." }]);
  };

  if (submitted) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircle2 className="h-12 w-12 text-emerald-500" />
          <p className="text-lg font-semibold">Submitted!</p>
          <p className="text-sm text-muted-foreground">Taking you back to the assignment…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">

      {/* Top bar */}
      <header className="h-14 shrink-0 border-b flex items-center justify-between px-4 gap-4 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={exit} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-red-600 transition-colors shrink-0">
            <X className="h-4 w-4" /> Exit Assessment
          </button>
          <span className="text-border">|</span>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="font-bold text-sm shrink-0">Gradely</span>
            <span className="text-sm text-muted-foreground truncate">{a.courseCode}: {a.title}</span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            {saveState === "saving" && <><Loader2 className="h-3 w-3 animate-spin" /> Saving…</>}
            {saveState === "saved"  && <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Saved</>}
            {saveState === "idle"   && <><Cloud className="h-3 w-3" /> Autosave on</>}
          </span>
          {deadline && remaining !== null && (
            <div className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 font-mono text-sm font-bold tabular-nums ${remaining <= 60 ? "bg-red-50 border-red-200 text-red-600" : "border-border"}`}>
              <Timer className="h-4 w-4" /> {fmtClock(remaining)}
            </div>
          )}
          <Button onClick={submitExam} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Submit Exam
          </Button>
        </div>
      </header>

      {submitError && (
        <p className="text-sm text-red-600 bg-red-50 border-b border-red-200 px-4 py-2">{submitError}</p>
      )}

      {/* Three panes */}
      <div className="flex-1 flex overflow-hidden">

        {/* Problem statement */}
        <aside className="w-full max-w-sm shrink-0 border-r overflow-y-auto p-6 space-y-5">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-xs font-mono">{a.language}</Badge>
            <Badge variant="outline" className={`text-xs capitalize ${DIFFICULTY_STYLE[a.difficulty]}`}>
              {a.difficulty.toLowerCase()}
            </Badge>
          </div>

          <div>
            <h1 className="text-xl font-bold">{a.title}</h1>
            <MarkdownText text={a.description} className="text-sm text-muted-foreground mt-2" />
          </div>

          {a.testCases.length > 0 && (
            <div className="space-y-3">
              {a.testCases.map((tc, i) => (
                <div key={tc.id} className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                  <p className="text-xs font-semibold">Example {i + 1}:</p>
                  <p className="text-xs font-mono"><span className="text-muted-foreground">Input: </span>{tc.input || "(none)"}</p>
                  <p className="text-xs font-mono"><span className="text-muted-foreground">Output: </span>{tc.expectedOutput}</p>
                  {tc.title && <p className="text-xs text-muted-foreground italic">Note: {tc.title}</p>}
                </div>
              ))}
            </div>
          )}

          <div>
            <p className="text-sm font-semibold mb-1.5">Constraints:</p>
            <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
              <li>Time limit: {a.timeLimitSeconds}s per test run</li>
              <li>Memory limit: {a.memoryLimitMB} MB</li>
              {a.hiddenTestCount > 0 && (
                <li>{a.hiddenTestCount} additional hidden test{a.hiddenTestCount !== 1 ? "s" : ""} will be evaluated on submission</li>
              )}
              <li>Worth {a.totalMarks} marks total</li>
            </ul>
          </div>
        </aside>

        {/* Editor */}
        <section className="flex-1 flex flex-col min-w-0 bg-[#1e1e1e]">
          <div className="h-10 shrink-0 flex items-center justify-between px-4 border-b border-black/30">
            <span className="text-xs text-slate-300 font-mono">solution.{EXT[a.language] ?? "txt"}</span>
            <button
              onClick={() => setFontSize((f) => (f >= 18 ? 12 : f + 2))}
              title="Cycle font size"
              className="text-slate-400 hover:text-slate-200 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              theme="vs-dark"
              language={MONACO_LANG[a.language] ?? "plaintext"}
              value={code}
              onChange={handleCodeChange}
              onMount={onMountEditor}
              options={{
                fontSize,
                minimap: { enabled: false },
                automaticLayout: true,
                tabSize: 4,
                scrollBeyondLastLine: false,
                padding: { top: 12 },
              }}
            />
          </div>

          {(results || runError) && (
            <div className="shrink-0 max-h-40 overflow-y-auto border-t border-black/30 bg-[#151515] p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300">
                  {runError ? "Error" : `${results!.filter((r) => r.passed).length}/${results!.length} tests passed`}
                </p>
                <button onClick={() => { setResults(null); setRunError(null); }} className="text-slate-500 hover:text-slate-300">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {runError && <p className="text-xs text-red-400">{runError}</p>}
              {results?.map((r, i) => (
                <div key={r.testCaseId} className={`text-xs rounded px-2 py-1.5 ${r.passed ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"}`}>
                  <span className="font-semibold">{r.passed ? "PASS" : "FAIL"}</span> — {r.title ?? `Test ${i + 1}`}
                  {!r.passed && <span className="ml-2 opacity-80">got: {r.actual || "(no output)"}</span>}
                </div>
              ))}
            </div>
          )}

          <div className="h-12 shrink-0 flex items-center justify-between px-4 border-t border-black/30">
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => chatInputRef.current?.focus()}>
                <Sparkles className="h-3.5 w-3.5" /> Ask AI Tutor
              </Button>
              <Button size="sm" className="gap-1.5" onClick={runCode} disabled={running}>
                {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                Run Code
              </Button>
            </div>
            <span className="text-xs text-slate-500 font-mono">Ln {cursor.line}, Col {cursor.col}</span>
          </div>
        </section>

        {/* AI Tutor */}
        <aside className="w-full max-w-sm shrink-0 border-l flex flex-col bg-slate-900 text-slate-200">
          <div className="h-12 shrink-0 flex items-center gap-2 px-4 border-b border-slate-800">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">AI Tutor</span>
            <span className="ml-auto text-[10px] font-bold text-primary bg-primary/15 px-1.5 py-0.5 rounded">HINTS ONLY</span>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-3 w-3 text-primary" />
              </div>
              <div className="bg-slate-800 rounded-xl rounded-tl-sm px-3 py-2 text-sm text-slate-200 max-w-[85%]">
                Ask me anything about this problem — I'll help you think it through, but I won't hand you the solution.
              </div>
            </div>
            {chat.map((m, i) => m.role === "user" ? (
              <div key={i} className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-xl rounded-tr-sm px-3 py-2 text-sm max-w-[85%]">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-slate-800 rounded-xl rounded-tl-sm px-3 py-2 text-sm text-slate-200 max-w-[85%] whitespace-pre-wrap">
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-2">
                <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles className="h-3 w-3 text-primary" />
                </div>
                <div className="bg-slate-800 rounded-xl rounded-tl-sm px-3 py-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="shrink-0 border-t border-slate-800 p-3 space-y-1.5">
            <div className="flex gap-2">
              <Input
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendChat(); }}
                placeholder="Type a follow-up…"
                disabled={chatLoading}
                className="bg-slate-800 border-slate-700 text-slate-100 placeholder:text-slate-500"
              />
              <Button size="icon" onClick={sendChat} disabled={chatLoading || !chatInput.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[10px] text-slate-500 text-center">AI may provide hints, not direct solutions.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
