"use client";

import { useState } from "react";
import {
  Code2, Plus, Trash2, Copy, ChevronDown, Sparkles, X, Loader2, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// ── Types ──────────────────────────────────────────────────────────────────────

export type QDifficulty  = "EASY" | "MEDIUM" | "HARD";
export type CodeLanguage = "PYTHON" | "JAVASCRIPT" | "JAVA" | "C" | "CPP";
export type TestKind     = "CONSOLE" | "FUNCTION";

export interface WizardTestCase {
  title:          string;
  input:          string; // CONSOLE: stdin. FUNCTION: JSON array of args, e.g. "[5, 8]"
  expectedOutput: string; // CONSOLE: expected stdout. FUNCTION: JSON-encoded return value, e.g. "13"
  points:         number;
  isHidden:       boolean;
  group:          string; // "Sample" | "Edge Case" | "Performance"
}

export interface CodingConfig {
  tags:                   string[];
  language:               CodeLanguage;
  starterCode:            string;
  difficulty:             QDifficulty;
  testKind:               TestKind;
  functionName:           string; // required when testKind === FUNCTION
  referenceSolution:      string; // hidden from students
  testCases:              WizardTestCase[];
  autoGrade:              boolean; // "Enable Automatic Grading" — false hides Test Cases entirely
  similarityCheckEnabled: boolean;
  similarityThreshold:    number;
  requireManualReview:    boolean;
}

export const defaultCodingConfig = (): CodingConfig => ({
  tags: [],
  language: "PYTHON",
  starterCode: "",
  difficulty: "MEDIUM",
  testKind: "CONSOLE",
  functionName: "",
  referenceSolution: "",
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
  // Steps are dynamic: "Test Cases" only exists while auto-grading is on.
  const steps = [
    { key: "problem",  title: "Problem",           sub: "Title, tags, statement" },
    { key: "code",     title: "Language & Code",   sub: "Starter code" },
    ...(config.autoGrade ? [{ key: "tests", title: "Test Cases", sub: `${config.testCases.length} test${config.testCases.length !== 1 ? "s" : ""}` }] : []),
    { key: "review",   title: "Grading & Review",  sub: "Scoring, checks" },
  ] as const;

  const [step, setStep] = useState(0);
  const safeStep = Math.min(step, steps.length - 1);
  const stepKey  = steps[safeStep].key;

  const [newTag, setNewTag] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({ 0: true });
  const [showSolution, setShowSolution] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const set = <K extends keyof CodingConfig>(key: K, value: CodingConfig[K]) =>
    onChange({ ...config, [key]: value });

  const totalPoints = config.testCases.reduce((s, t) => s + (Number(t.points) || 0), 0);
  const hiddenCount = config.testCases.filter((t) => t.isHidden).length;

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
  const duplicateTest = (i: number) => {
    const copy = { ...config.testCases[i] };
    const next = [...config.testCases.slice(0, i + 1), copy, ...config.testCases.slice(i + 1)];
    set("testCases", next);
    setExpanded((e) => ({ ...e, [i + 1]: true }));
  };
  const removeTest = (i: number) => set("testCases", config.testCases.filter((_, idx) => idx !== i));
  const updateTest = (i: number, field: keyof WizardTestCase, value: string | number | boolean) =>
    set("testCases", config.testCases.map((t, idx) => idx === i ? { ...t, [field]: value } : t));
  const toggleExpand = (i: number) => setExpanded((e) => ({ ...e, [i]: !e[i] }));

  // ── AI: one-shot comprehensive generation ─────────────────────────────────────

  const generateAssignment = async () => {
    if (!aiPrompt.trim()) { setAiError("Describe the exercise you want the AI to generate."); return; }
    setAiGenerating(true); setAiError(null);

    const res = await fetch("/api/ai/generate-assignment-draft", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        subtype: "EXERCISE",
        instructions: aiPrompt,
        totalMarks,
        language: config.language,
        autoGradingEnabled: config.autoGrade,
        testKind: config.testKind,
        testCount: config.testCases.length,
      }),
    });
    const json = await res.json();
    setAiGenerating(false);
    if (!res.ok) { setAiError(json.error ?? "AI generation failed"); return; }

    const d = json.data;
    onTitleChange(d.title ?? title);
    onDescriptionChange(d.statement ?? description);

    const generatedTests: WizardTestCase[] = config.autoGrade
      ? (d.testCases ?? []).map((t: Record<string, unknown>) => ({
          title:          String(t.name ?? ""),
          input:          String(config.testKind === "FUNCTION" ? t.args ?? "[]" : t.input ?? ""),
          expectedOutput: String(config.testKind === "FUNCTION" ? t.expectedReturn ?? "" : t.output ?? ""),
          points:         Number(t.points) || 1,
          isHidden:       !!t.hidden,
          group:          typeof t.group === "string" ? t.group : "Sample",
        }))
      : config.testCases;

    onChange({
      ...config,
      tags:              Array.isArray(d.tags) ? d.tags : config.tags,
      difficulty:        ["EASY", "MEDIUM", "HARD"].includes(d.difficulty) ? d.difficulty : config.difficulty,
      starterCode:       typeof d.starterCode === "string" ? d.starterCode : config.starterCode,
      referenceSolution: typeof d.referenceSolution === "string" ? d.referenceSolution : config.referenceSolution,
      functionName:      config.testKind === "FUNCTION" && typeof d.functionName === "string" ? d.functionName : config.functionName,
      testCases:         generatedTests.length ? generatedTests : config.testCases,
    });
    setAiOpen(false);
  };

  return (
    <div className="space-y-3">

      {/* Obvious, always-visible auto-grading toggle */}
      <label className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3 cursor-pointer">
        <input
          type="checkbox"
          checked={config.autoGrade}
          onChange={(e) => set("autoGrade", e.target.checked)}
          className="h-4 w-4 accent-primary shrink-0"
        />
        <div>
          <p className="text-sm font-semibold text-foreground">Enable Automatic Grading</p>
          <p className="text-xs text-muted-foreground">
            {config.autoGrade
              ? "Students' code runs against your test cases and is scored automatically."
              : "No test cases — you'll grade submissions manually or with a rubric."}
          </p>
        </div>
      </label>

      <div className="flex gap-5 items-start">

        {/* Step rail */}
        <div className="w-56 shrink-0 hidden lg:block sticky top-0">
          <div className="flex flex-col">
            {steps.map((s, i) => {
              const active = safeStep === i;
              const done   = safeStep > i;
              return (
                <button key={s.key} type="button" onClick={() => setStep(i)}
                  className="flex gap-3 text-left pb-1.5">
                  <div className="flex flex-col items-center">
                    <div className={`h-[26px] w-[26px] rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      active ? "bg-primary text-white" : done ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border"
                    }`}>
                      {i + 1}
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`w-0.5 flex-1 min-h-[28px] ${safeStep > i ? "bg-primary/30" : "bg-border"}`} />
                    )}
                  </div>
                  <div className="pt-0.5 min-w-0 flex-1">
                    <p className={`text-sm whitespace-nowrap ${active ? "font-bold text-foreground" : "font-medium text-muted-foreground"}`}>{s.title}</p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5 whitespace-nowrap">{s.sub}</p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-7 rounded-xl border bg-card p-3.5">
            <p className="text-[11px] font-bold tracking-wide text-muted-foreground/70 uppercase mb-2">Summary</p>
            <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">Language</span><span className="font-semibold">{LANGUAGE_LABELS[config.language]}</span></div>
            <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">Difficulty</span><span className="font-semibold capitalize">{config.difficulty.toLowerCase()}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">{config.autoGrade ? "Total points" : "Grading"}</span><span className="font-semibold">{config.autoGrade ? totalPoints : "Manual"}</span></div>
          </div>
        </div>

        {/* Main panel */}
        <div className="flex-1 min-w-0 flex gap-4 items-start">
          <div className="flex-1 min-w-0 bg-card border rounded-xl overflow-hidden">

            <div className="flex items-center justify-between px-5 py-4 border-b">
              <p className="flex items-center gap-2 font-bold text-foreground">
                <Code2 className="h-4.5 w-4.5 text-primary" /> {steps[safeStep].title}
              </p>
              <button type="button" onClick={() => setAiOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${aiOpen ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/15"}`}>
                <Sparkles className="h-3.5 w-3.5" /> Ask AI
              </button>
            </div>

            <div className="p-5">

              {/* Problem */}
              {stepKey === "problem" && (
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

              {/* Language & Code */}
              {stepKey === "code" && (
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
                      Starter code <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <p className="text-xs text-muted-foreground mt-1 mb-1.5">
                      Starter code gives students a template to begin from. Leave blank if students should write their solution from scratch.
                    </p>
                    <Textarea
                      className="font-mono text-xs bg-slate-950 text-emerald-400 border-slate-700 placeholder:text-slate-500 min-h-[240px]"
                      rows={12}
                      placeholder="# Write starter code for students here…"
                      value={config.starterCode}
                      onChange={(e) => set("starterCode", e.target.value)}
                      spellCheck={false}
                    />
                  </div>
                </div>
              )}

              {/* Test Cases (only present in the step list when autoGrade is on) */}
              {stepKey === "tests" && (
                <div className="space-y-4">
                  {/* Test kind */}
                  <div>
                    <label className="text-xs font-semibold text-foreground/90">Test case type</label>
                    <div className="inline-flex rounded-lg border p-1 gap-1 mt-1.5">
                      <button type="button" onClick={() => set("testKind", "CONSOLE")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium ${config.testKind === "CONSOLE" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/60"}`}>
                        Console Program
                      </button>
                      <button type="button" onClick={() => set("testKind", "FUNCTION")}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium ${config.testKind === "FUNCTION" ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/60"}`}>
                        Function-Based
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      {config.testKind === "CONSOLE"
                        ? "Students' program reads input and prints output — compared against expected stdout."
                        : "Students implement one function; each test calls it with arguments and checks the return value."}
                    </p>
                    {config.testKind === "FUNCTION" && (
                      <Input className="mt-2 max-w-xs font-mono text-sm" placeholder="e.g. sum_two_numbers"
                        value={config.functionName} onChange={(e) => set("functionName", e.target.value)} />
                    )}
                  </div>

                  <div className="flex items-center justify-between">
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
                              {config.testKind === "FUNCTION" ? (
                                <>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Arguments <span className="font-normal">(JSON array)</span></label>
                                    <Textarea className="mt-1 font-mono text-xs" rows={3} placeholder="[5, 8]"
                                      value={t.input} onChange={(e) => updateTest(i, "input", e.target.value)} />
                                  </div>
                                  <div>
                                    <label className="text-xs text-muted-foreground">Expected return <span className="font-normal">(JSON)</span></label>
                                    <Textarea className="mt-1 font-mono text-xs" rows={3} placeholder="13"
                                      value={t.expectedOutput} onChange={(e) => updateTest(i, "expectedOutput", e.target.value)} />
                                  </div>
                                </>
                              ) : (
                                <>
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
                                </>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-0.5">
                              <label className="flex items-center gap-2 text-xs text-foreground/90 cursor-pointer">
                                <input type="checkbox" checked={t.isHidden} onChange={(e) => updateTest(i, "isHidden", e.target.checked)} />
                                Hidden from students
                              </label>
                              <div className="flex items-center gap-3">
                                <button type="button" onClick={() => duplicateTest(i)}
                                  className="flex items-center gap-1 text-xs text-muted-foreground font-medium hover:text-foreground">
                                  <Copy className="h-3.5 w-3.5" /> Duplicate
                                </button>
                                {config.testCases.length > 1 && (
                                  <button type="button" onClick={() => removeTest(i)}
                                    className="flex items-center gap-1 text-xs text-red-600 font-medium hover:text-red-700">
                                    <Trash2 className="h-3.5 w-3.5" /> Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Grading & Review */}
              {stepKey === "review" && (
                <div className="space-y-3.5">
                  {config.autoGrade && (
                    <div className="rounded-xl border p-4">
                      <p className="text-sm font-semibold text-foreground">Weight in final course grade</p>
                      <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">How much this exercise counts toward each student's weighted final grade, relative to other assignments.</p>
                      <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                        <Input type="number" min={1} className="w-24 h-8" placeholder={`${totalMarks} (default)`}
                          value={gradeWeight} onChange={(e) => onGradeWeightChange(e.target.value)} />
                        <span className="text-muted-foreground">leave blank to weight by total marks</span>
                      </div>
                    </div>
                  )}

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

                  <div className="rounded-xl border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                          <EyeOff className="h-3.5 w-3.5" /> Reference solution
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">A model answer, hidden from students — yours or the AI's, for your own reference.</p>
                      </div>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setShowSolution((v) => !v)}>
                        {showSolution ? "Hide" : "Show"}
                      </Button>
                    </div>
                    {showSolution && (
                      <Textarea rows={8} className="mt-3 font-mono text-xs bg-slate-950 text-emerald-400 border-slate-700"
                        value={config.referenceSolution} onChange={(e) => set("referenceSolution", e.target.value)}
                        placeholder="No reference solution yet — write one or generate it with the AI Assistant." spellCheck={false} />
                    )}
                  </div>

                  <div className="rounded-xl border bg-muted/30 p-[18px]">
                    <p className="text-[11px] font-bold tracking-wide text-muted-foreground/70 uppercase mb-3">Assignment preview</p>
                    <p className="text-[15px] font-bold text-foreground">{title || "Untitled exercise"}</p>
                    <p className="text-sm text-muted-foreground mt-1 mb-3 line-clamp-2">
                      {description ? (description.length > 140 ? description.slice(0, 140) + "…" : description) : "No problem statement written yet."}
                    </p>
                    <div className="flex gap-2 flex-wrap">
                      <Badge variant="outline" className="capitalize bg-card">{LANGUAGE_LABELS[config.language]}</Badge>
                      <Badge variant="outline" className="capitalize bg-card">{config.difficulty.toLowerCase()}</Badge>
                      {config.autoGrade ? (
                        <>
                          <Badge variant="outline" className="bg-card">{config.testKind === "FUNCTION" ? "Function-based" : "Console"}</Badge>
                          <Badge variant="outline" className="bg-card">{config.testCases.length} test{config.testCases.length !== 1 ? "s" : ""}</Badge>
                          <Badge variant="outline" className="bg-card">{totalPoints} pts</Badge>
                        </>
                      ) : (
                        <Badge variant="outline" className="bg-card">Manually graded</Badge>
                      )}
                      <Badge variant="outline" className="bg-card">{totalMarks} marks total</Badge>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between px-5 py-4 border-t">
              <Button type="button" variant="outline" disabled={safeStep === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
                Back
              </Button>
              <Button type="button" disabled={safeStep === steps.length - 1} onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}>
                {safeStep === steps.length - 1 ? "All steps complete" : "Continue"}
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
                  Describe the exercise you want — topic, difficulty, language, whether to include starter code,
                  what the test cases should cover. I'll fill in the title, problem statement, tags, difficulty,
                  starter code, a hidden reference solution{config.autoGrade ? ", and test cases" : ""} for you to review.
                </div>

                {aiError && <p className="text-xs text-red-600">{aiError}</p>}

                {aiGenerating && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> Generating assignment…
                  </div>
                )}
              </div>

              <div className="p-3.5 border-t">
                <Textarea rows={5} className="text-xs mb-2"
                  placeholder='e.g. "A beginner Python exercise on summing two numbers, no starter code, 3 simple test cases."'
                  value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} />
                <Button type="button" className="w-full gap-1.5" onClick={generateAssignment} disabled={aiGenerating}>
                  {aiGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate Assignment
                </Button>
              </div>
            </div>
          )}
        </div>
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
