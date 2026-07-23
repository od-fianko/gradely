"use client";

import { useState } from "react";
import {
  Code2, Plus, Trash2, ChevronDown, Sparkles, X, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────────

export type QDifficulty = "EASY" | "MEDIUM" | "HARD";
export type CodeLanguage = "PYTHON" | "JAVASCRIPT" | "JAVA" | "C" | "CPP";

export interface WizardTestCase {
  title:          string;
  input:          string;
  expectedOutput: string;
  points:         number;
  isHidden:       boolean;
  group:          string; // "Sample" | "Edge Case" | "Performance"
}

export interface CodingConfig {
  tags:                   string[];
  language:                CodeLanguage;
  starterCode:             string;
  difficulty:              QDifficulty;
  testCases:               WizardTestCase[];
  autoGrade:               boolean;
  similarityCheckEnabled:  boolean;
  similarityThreshold:     number;
  requireManualReview:     boolean;
}

export const defaultCodingConfig = (): CodingConfig => ({
  tags: [],
  language: "PYTHON",
  starterCode: "",
  difficulty: "MEDIUM",
  testCases: [{ title: "", input: "", expectedOutput: "", points: 1, isHidden: false, group: "Sample" }],
  autoGrade: true,
  similarityCheckEnabled: false,
  similarityThreshold: 70,
  requireManualReview: false,
});

const defaultTestCase = (): WizardTestCase =>
  ({ title: "", input: "", expectedOutput: "", points: 1, isHidden: false, group: "Sample" });

const LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  PYTHON: "Python 3", JAVA: "Java 17", CPP: "C++ 20", JAVASCRIPT: "JavaScript (Node)", C: "C",
};

const DIFFICULTY_STYLE: Record<QDifficulty, { active: string; label: string }> = {
  EASY:   { active: "bg-emerald-50 border-emerald-300 text-emerald-700", label: "Easy" },
  MEDIUM: { active: "bg-amber-50 border-amber-300 text-amber-700",       label: "Medium" },
  HARD:   { active: "bg-red-50 border-red-300 text-red-700",             label: "Hard" },
};

const STEP_TITLES = ["Problem Statement", "Language & Starter Code", "Test Cases", "Grading & Review"];
const STEP_LABELS = [
  { title: "Problem",             sub: "Title, tags, statement" },
  { title: "Language & Code",     sub: "Starter code" },
  { title: "Test Cases",          sub: "" },
  { title: "Grading & Review",    sub: "Scoring, checks" },
];

// ── AI draft shapes ──────────────────────────────────────────────────────────────

type ProblemDraft = { kind: "problem"; title: string; statement: string; tags: string[]; difficulty: QDifficulty };
type CodeDraft     = { kind: "code"; code: string };
type TestDraftItem = { name: string; input: string; output: string; points: number; hidden: boolean; group: string };
type TestsDraft    = { kind: "tests"; items: TestDraftItem[] };
type AiDraft = ProblemDraft | CodeDraft | TestsDraft;

const AI_CONTEXT = [
  "Describe the exercise you want (topic, difficulty, constraints) and I'll draft a title, tags and problem statement for you to review.",
  "Tell me the language and approach and I'll draft starter code with the function signature stubbed out.",
  'Tell me how many test cases you need and what to cover (e.g. "5 tests on linked lists, 2 hidden edge cases") and I\'ll draft them.',
  "Ask me anything about scoring or review settings for this exercise.",
];
const AI_PLACEHOLDER = [
  "e.g. A medium exercise on linked lists...",
  "e.g. Python, iterative approach, include a helper class",
  "e.g. 5 tests on linked lists, 2 hidden edge cases",
  "Ask a question...",
];

interface Props {
  title:               string;
  onTitleChange:       (v: string) => void;
  description:         string;
  onDescriptionChange: (v: string) => void;
  totalMarks:          number;
  gradeWeight:         string; // shared with every other assignment type, set in the Details sheet
  onGradeWeightChange: (v: string) => void;
  config:              CodingConfig;
  onChange:            (config: CodingConfig) => void;
}

export function CodingAssignmentWizard({
  title, onTitleChange, description, onDescriptionChange, totalMarks,
  gradeWeight, onGradeWeightChange, config, onChange,
}: Props) {
  const [step, setStep] = useState(0);
  const [newTag, setNewTag] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiDraft, setAiDraft] = useState<AiDraft | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const set = <K extends keyof CodingConfig>(key: K, value: CodingConfig[K]) =>
    onChange({ ...config, [key]: value });

  const totalPoints  = config.testCases.reduce((s, t) => s + (Number(t.points) || 0), 0);
  const hiddenCount  = config.testCases.filter((t) => t.isHidden).length;

  // ── Topics ───────────────────────────────────────────────────────────────────

  const addTag = () => {
    const v = newTag.trim();
    if (!v) return;
    set("tags", [...config.tags, v]);
    setNewTag("");
  };
  const removeTag = (i: number) => set("tags", config.tags.filter((_, idx) => idx !== i));

  // ── Test cases ───────────────────────────────────────────────────────────────

  const addTest = () => {
    const next = [...config.testCases, defaultTestCase()];
    set("testCases", next);
    setExpanded((e) => ({ ...e, [next.length - 1]: true }));
  };
  const removeTest = (i: number) => set("testCases", config.testCases.filter((_, idx) => idx !== i));
  const updateTest = (i: number, field: keyof WizardTestCase, value: string | number | boolean) =>
    set("testCases", config.testCases.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  const toggleExpand = (i: number) => setExpanded((e) => ({ ...e, [i]: !e[i] }));

  // ── AI ───────────────────────────────────────────────────────────────────────

  const generateAI = async () => {
    setAiGenerating(true); setAiError(null); setAiDraft(null);
    const stepKey = ["problem", "code", "tests"][step] as "problem" | "code" | "tests" | undefined;
    if (!stepKey) { setAiGenerating(false); return; }

    const res = await fetch("/api/ai/generate-code-exercise", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        step: stepKey,
        prompt: aiPrompt,
        title, description,
        language: LANGUAGE_LABELS[config.language],
        testCount: config.testCases.length,
      }),
    });
    const json = await res.json();
    setAiGenerating(false);
    if (!res.ok) { setAiError(json.error ?? "AI generation failed"); return; }

    if (stepKey === "problem") {
      setAiDraft({ kind: "problem", title: json.data.title ?? "", statement: json.data.statement ?? "", tags: json.data.tags ?? [], difficulty: ["EASY","MEDIUM","HARD"].includes(json.data.difficulty) ? json.data.difficulty : "MEDIUM" });
    } else if (stepKey === "code") {
      setAiDraft({ kind: "code", code: json.data.code ?? "" });
    } else {
      setAiDraft({ kind: "tests", items: (json.data.tests ?? []).map((t: TestDraftItem) => ({
        name: t.name ?? "", input: t.input ?? "", output: t.output ?? "", points: t.points ?? 1, hidden: !!t.hidden, group: t.group ?? "Sample",
      })) });
    }
  };

  const acceptDraft = () => {
    if (!aiDraft) return;
    if (aiDraft.kind === "problem") {
      onTitleChange(aiDraft.title);
      onDescriptionChange(aiDraft.statement);
      set("tags", aiDraft.tags);
      set("difficulty", aiDraft.difficulty);
    } else if (aiDraft.kind === "code") {
      set("starterCode", aiDraft.code);
    }
    setAiDraft(null);
  };
  const discardDraft = () => setAiDraft(null);

  const acceptTestAt = (idx: number) => {
    if (!aiDraft || aiDraft.kind !== "tests") return;
    const item = aiDraft.items[idx];
    set("testCases", [...config.testCases, {
      title: item.name, input: item.input, expectedOutput: item.output, points: item.points, isHidden: item.hidden, group: item.group,
    }]);
    setAiDraft({ ...aiDraft, items: aiDraft.items.filter((_, i) => i !== idx) });
  };
  const discardTestAt = (idx: number) => {
    if (!aiDraft || aiDraft.kind !== "tests") return;
    setAiDraft({ ...aiDraft, items: aiDraft.items.filter((_, i) => i !== idx) });
  };
  const acceptAllTests = () => {
    if (!aiDraft || aiDraft.kind !== "tests") return;
    set("testCases", [...config.testCases, ...aiDraft.items.map((item) => ({
      title: item.name, input: item.input, expectedOutput: item.output, points: item.points, isHidden: item.hidden, group: item.group,
    }))]);
    setAiDraft(null);
  };

  return (
    <div className="flex gap-5 items-start">

      {/* Step rail */}
      <div className="w-56 shrink-0 hidden lg:block sticky top-0">
        <div className="flex flex-col">
          {STEP_LABELS.map((s, i) => {
            const active = step === i;
            const done   = step > i;
            return (
              <button key={i} type="button" onClick={() => setStep(i)}
                className="flex gap-3 text-left pb-1.5">
                <div className="flex flex-col items-center">
                  <div className={`h-[26px] w-[26px] rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    active ? "bg-primary text-white" : done ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border"
                  }`}>
                    {i + 1}
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div className={`w-0.5 flex-1 min-h-[28px] ${step > i ? "bg-primary/30" : "bg-border"}`} />
                  )}
                </div>
                <div className="pt-0.5 min-w-0 flex-1">
                  <p className={`text-sm whitespace-nowrap ${active ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{s.title}</p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5 whitespace-nowrap">
                    {i === 2 ? `${config.testCases.length} test${config.testCases.length !== 1 ? "s" : ""}` : s.sub}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-7 rounded-xl border bg-card p-3.5">
          <p className="text-[11px] font-bold tracking-wide text-muted-foreground/70 uppercase mb-2">Summary</p>
          <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">Language</span><span className="font-semibold">{LANGUAGE_LABELS[config.language]}</span></div>
          <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">Difficulty</span><span className="font-semibold capitalize">{config.difficulty.toLowerCase()}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Total points</span><span className="font-semibold">{totalPoints}</span></div>
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 min-w-0 flex gap-4 items-start">
        <div className="flex-1 min-w-0 bg-card border rounded-xl overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b">
            <p className="flex items-center gap-2 font-bold text-foreground">
              <Code2 className="h-4.5 w-4.5 text-primary" /> {STEP_TITLES[step]}
            </p>
            <button type="button" onClick={() => setAiOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${aiOpen ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/15"}`}>
              <Sparkles className="h-3.5 w-3.5" /> Ask AI
            </button>
          </div>

          <div className="p-5">

            {/* STEP 0 — Problem */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground/90">Exercise title</label>
                  <Input className="mt-1.5" placeholder="e.g. Reverse a Singly Linked List"
                    value={title} onChange={(e) => onTitleChange(e.target.value)} />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground/90">Topics</label>
                  <div className="flex flex-wrap gap-2 items-center mt-1.5">
                    {config.tags.map((tag, i) => (
                      <span key={i} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
                        {tag}
                        <button type="button" onClick={() => removeTag(i)} className="text-primary/60 hover:text-primary font-bold">×</button>
                      </span>
                    ))}
                    <Input
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Add topic + Enter"
                      className="h-7 w-36 rounded-full text-xs border-dashed"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground/90">Difficulty</label>
                  <div className="flex gap-2 mt-1.5">
                    {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
                      <button key={d} type="button" onClick={() => set("difficulty", d)}
                        className={`px-4 py-1.5 rounded-md text-xs font-semibold border transition-colors ${config.difficulty === d ? DIFFICULTY_STYLE[d].active : "border-border text-muted-foreground hover:bg-muted/60"}`}>
                        {DIFFICULTY_STYLE[d].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground/90">Problem statement</label>
                  <Textarea rows={7} className="mt-1.5 text-sm leading-relaxed"
                    placeholder="Describe the task, constraints, and expected function signature students must implement…"
                    value={description} onChange={(e) => onDescriptionChange(e.target.value)} />
                </div>
              </div>
            )}

            {/* STEP 1 — Language & Code */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground/90">Language students will use</label>
                  <Select value={config.language} onValueChange={(v) => set("language", v as CodeLanguage)}>
                    <SelectTrigger className="mt-1.5 w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(LANGUAGE_LABELS) as CodeLanguage[]).map((l) => (
                        <SelectItem key={l} value={l}>{LANGUAGE_LABELS[l]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground/90">
                    Starter code <span className="font-normal text-muted-foreground">(optional — given to students)</span>
                  </label>
                  <Textarea
                    className="mt-1.5 font-mono text-xs bg-slate-950 text-emerald-400 border-slate-700 placeholder:text-slate-500 min-h-[260px]"
                    rows={13}
                    placeholder="# Write starter code for students here…"
                    value={config.starterCode}
                    onChange={(e) => set("starterCode", e.target.value)}
                    spellCheck={false}
                  />
                </div>
              </div>
            )}

            {/* STEP 2 — Test cases */}
            {step === 2 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-muted-foreground">
                    {config.testCases.length} test{config.testCases.length !== 1 ? "s" : ""} · {totalPoints} pts total · {hiddenCount} hidden
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={addTest} className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Test
                  </Button>
                </div>

                <div className="space-y-3">
                  {config.testCases.map((t, i) => (
                    <div key={i} className="rounded-xl border overflow-hidden">
                      <div onClick={() => toggleExpand(i)}
                        className="flex items-center gap-2.5 px-3.5 py-3 bg-muted/40 cursor-pointer flex-wrap">
                        <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5 text-xs">Test {i + 1}</Badge>
                        <span className="text-sm font-medium text-foreground/90">{t.title || "Untitled test"}</span>
                        {t.isHidden && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs">Hidden</Badge>}
                        <Badge variant="secondary" className="text-xs">{t.group}</Badge>
                        <div className="flex-1" />
                        <span className="text-xs text-muted-foreground">{t.points} pt</span>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded[i] ? "rotate-180" : ""}`} />
                      </div>

                      {expanded[i] && (
                        <div className="p-4 space-y-3">
                          <div className="flex gap-3 items-end flex-wrap">
                            <div className="flex-[2] min-w-[160px]">
                              <label className="text-xs text-muted-foreground">Test name (optional)</label>
                              <Input className="mt-1" placeholder="e.g. Empty array input" value={t.title}
                                onChange={(e) => updateTest(i, "title", e.target.value)} />
                            </div>
                            <div className="w-24">
                              <label className="text-xs text-muted-foreground">Points</label>
                              <Input className="mt-1" type="number" min={1} value={t.points}
                                onChange={(e) => updateTest(i, "points", Number(e.target.value))} />
                            </div>
                            <div className="w-36">
                              <label className="text-xs text-muted-foreground">Group</label>
                              <Select value={t.group} onValueChange={(v) => updateTest(i, "group", v)}>
                                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Sample">Sample</SelectItem>
                                  <SelectItem value="Edge Case">Edge Case</SelectItem>
                                  <SelectItem value="Performance">Performance</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-xs text-muted-foreground">Input (stdin)</label>
                              <Textarea className="mt-1 font-mono text-xs" rows={3} placeholder="Input data…"
                                value={t.input} onChange={(e) => updateTest(i, "input", e.target.value)} />
                            </div>
                            <div>
                              <label className="text-xs text-muted-foreground">Expected output</label>
                              <Textarea className="mt-1 font-mono text-xs" rows={3} placeholder="Expected stdout…"
                                value={t.expectedOutput} onChange={(e) => updateTest(i, "expectedOutput", e.target.value)} />
                            </div>
                          </div>
                          <div className="flex items-center justify-between pt-0.5">
                            <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer">
                              <input type="checkbox" checked={t.isHidden} onChange={(e) => updateTest(i, "isHidden", e.target.checked)} />
                              Hidden from students
                            </label>
                            {config.testCases.length > 1 && (
                              <button type="button" onClick={() => removeTest(i)}
                                className="flex items-center gap-1 text-xs text-red-600 font-medium hover:text-red-700">
                                <Trash2 className="h-3.5 w-3.5" /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 — Grading & review */}
            {step === 3 && (
              <div className="space-y-3.5">
                <ToggleCard
                  title="Auto-grade against test cases"
                  desc="Runs student code against all tests and assigns a score automatically"
                  on={config.autoGrade} onToggle={() => set("autoGrade", !config.autoGrade)}
                >
                  {config.autoGrade && (
                    <div className="flex items-center gap-2.5 pt-3 mt-3 border-t text-xs text-foreground/90">
                      Weight of this exercise in final grade
                      <Input type="number" min={1} className="w-24 h-8" placeholder={`${totalMarks} (default)`}
                        value={gradeWeight} onChange={(e) => onGradeWeightChange(e.target.value)} />
                      <span className="text-muted-foreground">— leave blank to weight by total marks</span>
                    </div>
                  )}
                </ToggleCard>

                <ToggleCard
                  title="Plagiarism / similarity check"
                  desc="Flags submissions with high code similarity across students"
                  on={config.similarityCheckEnabled} onToggle={() => set("similarityCheckEnabled", !config.similarityCheckEnabled)}
                >
                  {config.similarityCheckEnabled && (
                    <div className="flex items-center gap-2.5 pt-3 mt-3 border-t text-xs text-foreground/90">
                      Flag threshold
                      <input type="range" min={40} max={100} value={config.similarityThreshold}
                        onChange={(e) => set("similarityThreshold", Number(e.target.value))} className="w-40" />
                      <span className="text-muted-foreground font-semibold">{config.similarityThreshold}% similar</span>
                    </div>
                  )}
                </ToggleCard>

                <ToggleCard
                  title="Require my review before releasing grades"
                  desc="Auto-scores stay in draft until you approve them"
                  on={config.requireManualReview} onToggle={() => set("requireManualReview", !config.requireManualReview)}
                />

                <div className="rounded-xl border bg-muted/30 p-[18px]">
                  <p className="text-[11px] font-bold tracking-wide text-muted-foreground/70 uppercase mb-3">Assignment preview</p>
                  <p className="text-[15px] font-bold text-foreground">{title || "Untitled exercise"}</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-3 line-clamp-2">
                    {description ? (description.length > 140 ? description.slice(0, 140) + "…" : description) : "No problem statement written yet."}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize bg-card">{LANGUAGE_LABELS[config.language]}</Badge>
                    <Badge variant="outline" className="capitalize bg-card">{config.difficulty.toLowerCase()}</Badge>
                    <Badge variant="outline" className="bg-card">{config.testCases.length} test{config.testCases.length !== 1 ? "s" : ""}</Badge>
                    <Badge variant="outline" className="bg-card">{totalPoints} pts</Badge>
                    <Badge variant="outline" className="bg-card">{totalMarks} marks total</Badge>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t">
            <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
            <Button type="button" disabled={step === 3} onClick={() => setStep((s) => Math.min(3, s + 1))}>
              {step === 3 ? "All steps complete" : "Continue"}
            </Button>
          </div>
        </div>

        {/* AI panel */}
        {aiOpen && (
          <div className="w-80 shrink-0 bg-card border rounded-xl overflow-hidden flex flex-col max-h-[680px]">
            <div className="flex items-center gap-2 px-4 py-3.5 border-b bg-gradient-to-b from-primary/5 to-transparent">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">AI Assistant</span>
              <button type="button" onClick={() => setAiOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4 flex-1 overflow-y-auto space-y-3.5">
              <div className="rounded-lg bg-muted/50 p-3 text-xs text-foreground/80 leading-relaxed">
                {AI_CONTEXT[step]}
              </div>

              {aiError && <p className="text-xs text-red-600">{aiError}</p>}

              {aiGenerating && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Drafting suggestion…
                </div>
              )}

              {aiDraft?.kind === "problem" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs font-bold text-foreground mb-1">{aiDraft.title}</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{aiDraft.statement}</p>
                  <div className="flex gap-1.5 flex-wrap mb-2.5">
                    {aiDraft.tags.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[11px]">{t}</span>
                    ))}
                    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[11px] capitalize">{aiDraft.difficulty.toLowerCase()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={acceptDraft}>Insert into fields</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={discardDraft}>Discard</Button>
                  </div>
                </div>
              )}

              {aiDraft?.kind === "code" && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <pre className="mb-2.5 bg-slate-950 text-slate-200 rounded-md p-2.5 text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">{aiDraft.code}</pre>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" className="flex-1 h-7 text-xs" onClick={acceptDraft}>Insert as starter code</Button>
                    <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={discardDraft}>Discard</Button>
                  </div>
                </div>
              )}

              {aiDraft?.kind === "tests" && (
                <div className="space-y-2">
                  {aiDraft.items.map((it, idx) => (
                    <div key={idx} className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
                      <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-xs font-bold">{it.name}</span>
                        {it.hidden && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">Hidden</span>}
                        <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px]">{it.group}</span>
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground mb-2 truncate">in: {it.input || "—"} → out: {it.output || "—"}</p>
                      <div className="flex gap-1.5">
                        <Button type="button" size="sm" className="flex-1 h-6 text-[11px]" onClick={() => acceptTestAt(idx)}>Accept</Button>
                        <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px]" onClick={() => discardTestAt(idx)}>Discard</Button>
                      </div>
                    </div>
                  ))}
                  {aiDraft.items.length > 0 && (
                    <Button type="button" variant="outline" size="sm" className="w-full text-xs" onClick={acceptAllTests}>Accept all</Button>
                  )}
                </div>
              )}
            </div>

            <div className="p-3.5 border-t">
              <Textarea rows={3} className="text-xs mb-2" placeholder={AI_PLACEHOLDER[step]}
                value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
              <Button type="button" className="w-full gap-1.5" onClick={generateAI} disabled={aiGenerating || step === 3}>
                {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Generate suggestion
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleCard({ title, desc, on, onToggle, children }: {
  title: string; desc: string; on: boolean; onToggle: () => void; children?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
        </div>
        <button type="button" onClick={onToggle}
          className={`relative h-[22px] w-[38px] rounded-full shrink-0 transition-colors ${on ? "bg-primary" : "bg-muted-foreground/30"}`}>
          <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
        </button>
      </div>
      {children}
    </div>
  );
}
