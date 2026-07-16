"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Trash2, CheckSquare, Code2, Sparkles, FileText, Upload } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const schema = z.object({
  title:        z.string().min(3, "Title must be at least 3 characters"),
  description:  z.string().min(10, "Please provide a description"),
  type:         z.enum(["PROGRAMMING", "MULTIPLE_CHOICE", "SHORT_ANSWER", "FILE_UPLOAD"]),
  totalMarks:   z.coerce.number().int().min(1).max(1000),
  dueDate:      z.string().min(1, "Due date is required"),
  passingMarks: z.coerce.number().int().min(0).optional(),
});

type Schema = z.infer<typeof schema>;

interface QuizOption   { text: string; isCorrect: boolean }
type QuestionKind = "MCQ" | "SHORT_TEXT";
interface QuizQuestion { text: string; points: number; kind: QuestionKind; sampleAnswer: string; options: QuizOption[] }
interface TestCase     { title: string; input: string; expectedOutput: string; points: number; isHidden: boolean }

const defaultOption   = (): QuizOption   => ({ text: "", isCorrect: false });
const defaultQuestion = (kind: QuestionKind = "MCQ"): QuizQuestion => ({ text: "", points: kind === "MCQ" ? 1 : 5, kind, sampleAnswer: "", options: kind === "MCQ" ? [defaultOption(), defaultOption()] : [] });
const defaultTestCase = (): TestCase     => ({ title: "", input: "", expectedOutput: "", points: 1, isHidden: false });

const TYPE_LABELS: Record<string, string> = {
  PROGRAMMING:     "Programming (auto-graded via tests)",
  MULTIPLE_CHOICE: "Quiz — MCQ, theory, or a mix",
  SHORT_ANSWER:    "Short Answer (AI-assisted grading)",
  FILE_UPLOAD:     "File Upload (manual grading)",
};

export function CreateAssignmentForm({ courseId }: { courseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // Quiz state
  const [questions,      setQuestions]      = useState<QuizQuestion[]>([defaultQuestion()]);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiQLoading,     setAiQLoading]     = useState(false);

  // Short answer state
  const [rubric,       setRubric]       = useState("");
  const [aiRLoading,   setAiRLoading]   = useState(false);

  // Programming state
  const [testCases,    setTestCases]    = useState<TestCase[]>([defaultTestCase()]);
  const [starterCode,  setStarterCode]  = useState("");

  // Generate-from-slides (shared across types)
  const slidesInputRef = useRef<HTMLInputElement>(null);
  const [slidesLoading, setSlidesLoading] = useState(false);

  const form = useForm<Schema>({
    resolver:      zodResolver(schema),
    defaultValues: { title: "", description: "", type: "SHORT_ANSWER", totalMarks: 100, dueDate: "" },
  });

  const selectedType  = form.watch("type");
  const title         = form.watch("title");
  const description   = form.watch("description");
  const totalMarks    = form.watch("totalMarks");

  // ── Quiz helpers ──────────────────────────────────────────────────────────────

  const addQuestion    = (kind: QuestionKind = "MCQ") => setQuestions((q) => [...q, defaultQuestion(kind)]);

  const setQuestionKind = (i: number, kind: QuestionKind) =>
    setQuestions((q) => q.map((qs, idx) => idx === i
      ? { ...qs, kind, options: kind === "MCQ" && qs.options.length === 0 ? [defaultOption(), defaultOption()] : qs.options }
      : qs));
  const removeQuestion = (i: number) => setQuestions((q) => q.filter((_, idx) => idx !== i));

  const updateQuestion = (i: number, field: keyof Omit<QuizQuestion, "options">, value: string | number) =>
    setQuestions((q) => q.map((qs, idx) => idx === i ? { ...qs, [field]: value } : qs));

  const addOption    = (qi: number) =>
    setQuestions((q) => q.map((qs, idx) => idx === qi ? { ...qs, options: [...qs.options, defaultOption()] } : qs));
  const removeOption = (qi: number, oi: number) =>
    setQuestions((q) => q.map((qs, idx) => idx === qi ? { ...qs, options: qs.options.filter((_, i) => i !== oi) } : qs));
  const updateOption = (qi: number, oi: number, field: keyof QuizOption, value: string | boolean) =>
    setQuestions((q) => q.map((qs, idx) =>
      idx === qi ? { ...qs, options: qs.options.map((o, i) => i === oi ? { ...o, [field]: value } : o) } : qs));

  // ── AI: generate quiz questions ───────────────────────────────────────────────

  const generateQuestions = async () => {
    if (!aiInstructions.trim()) { setError("Tell the AI what you want — e.g. \"6 hard questions on AVL rotations and 2 easy ones on BST basics\""); return; }
    setAiQLoading(true); setError(null);
    const res  = await fetch("/api/ai/generate-questions", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ instructions: aiInstructions, description, totalMarks }),
    });
    const json = await res.json();
    setAiQLoading(false);
    if (!res.ok) { setError(json.error ?? "AI generation failed"); return; }
    const generated: QuizQuestion[] = (json.data.questions ?? []).map((q: QuizQuestion) => ({
      text:         q.text,
      points:       q.points ?? 1,
      kind:         q.kind === "SHORT_TEXT" ? "SHORT_TEXT" : "MCQ",
      sampleAnswer: q.sampleAnswer ?? "",
      options:      (q.options ?? []).map((o: QuizOption) => ({ text: o.text, isCorrect: o.isCorrect })),
    }));
    if (generated.length) setQuestions(generated);
  };

  // ── AI: generate rubric ───────────────────────────────────────────────────────

  const generateRubric = async () => {
    setAiRLoading(true); setError(null);
    const res  = await fetch("/api/ai/generate-rubric", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ title, description, totalMarks, instructions: aiInstructions }),
    });
    const json = await res.json();
    setAiRLoading(false);
    if (!res.ok) { setError(json.error ?? "AI generation failed"); return; }
    setRubric(json.data.rubric ?? "");
  };

  // ── AI: generate from uploaded slides (PDF / PPTX / image) ───────────────────

  const triggerSlidesUpload = () => slidesInputRef.current?.click();

  const handleSlidesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setSlidesLoading(true); setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("type", selectedType);
    formData.append("title", title);
    formData.append("description", description);
    formData.append("instructions", aiInstructions);
    formData.append("totalMarks", String(totalMarks));
    formData.append("count", String(selectedType === "PROGRAMMING" ? testCases.length : 4));

    const res  = await fetch("/api/ai/generate-from-slides", { method: "POST", body: formData });
    const json = await res.json();
    setSlidesLoading(false);
    if (!res.ok) { setError(json.error ?? "Failed to generate from slides"); return; }

    if (selectedType === "MULTIPLE_CHOICE") {
      const generated: QuizQuestion[] = (json.data.questions ?? []).map((q: QuizQuestion) => ({
        text:         q.text,
        points:       q.points ?? 1,
        kind:         q.kind === "SHORT_TEXT" ? "SHORT_TEXT" : "MCQ",
        sampleAnswer: q.sampleAnswer ?? "",
        options:      (q.options ?? []).map((o: QuizOption) => ({ text: o.text, isCorrect: o.isCorrect })),
      }));
      if (generated.length) setQuestions(generated);
    } else if (selectedType === "SHORT_ANSWER") {
      setRubric(json.data.rubric ?? "");
      if (!title.trim())       form.setValue("title", json.data.suggestedTitle ?? "");
      if (!description.trim()) form.setValue("description", json.data.suggestedDescription ?? "");
    } else if (selectedType === "PROGRAMMING") {
      setStarterCode(json.data.starterCode ?? "");
      const generated: TestCase[] = (json.data.testCases ?? []).map((tc: TestCase) => ({
        title:          tc.title ?? "",
        input:          tc.input ?? "",
        expectedOutput: tc.expectedOutput ?? "",
        points:         tc.points ?? 1,
        isHidden:       tc.isHidden ?? false,
      }));
      if (generated.length) setTestCases(generated);
      if (!title.trim())       form.setValue("title", json.data.suggestedTitle ?? "");
      if (!description.trim()) form.setValue("description", json.data.suggestedDescription ?? "");
    }
  };

  // ── Test case helpers ─────────────────────────────────────────────────────────

  const addTestCase    = () => setTestCases((t) => [...t, defaultTestCase()]);
  const removeTestCase = (i: number) => setTestCases((t) => t.filter((_, idx) => idx !== i));
  const updateTestCase = (i: number, field: keyof TestCase, value: string | number | boolean) =>
    setTestCases((t) => t.map((tc, idx) => idx === i ? { ...tc, [field]: value } : tc));

  // ── Submit ────────────────────────────────────────────────────────────────────

  const onSubmit = async (data: Schema) => {
    setError(null);

    if (data.type === "MULTIPLE_CHOICE") {
      for (const q of questions) {
        if (!q.text.trim()) { setError("All questions must have text"); return; }
        if (q.kind === "MCQ") {
          if (q.options.length < 2)                  { setError("Each MCQ needs at least 2 options"); return; }
          if (!q.options.some((o) => o.isCorrect))   { setError("Each MCQ must have at least one correct answer"); return; }
          if (q.options.some((o) => !o.text.trim())) { setError("All option texts must be filled in"); return; }
        }
      }
    }

    if (data.type === "PROGRAMMING") {
      for (const tc of testCases) {
        if (!tc.expectedOutput.trim()) { setError("All test cases must have an expected output"); return; }
      }
    }

    const body: Record<string, unknown> = {
      ...data,
      ...(data.type === "SHORT_ANSWER" && {
        shortAnswerDetails: { rubric: rubric.trim() || "Grade based on accuracy, completeness, and clarity." },
      }),
      ...(data.type === "FILE_UPLOAD" && {
        fileUploadDetails: { allowedFileTypes: ["pdf", "docx", "zip"], maxFileSizeMB: 10 },
      }),
      ...(data.type === "MULTIPLE_CHOICE" && {
        quizDetails: {
          questions: questions.map((q) => ({
            text:         q.text.trim(),
            points:       Number(q.points),
            kind:         q.kind,
            sampleAnswer: q.sampleAnswer.trim() || null,
            isMultiple:   q.kind === "MCQ" && q.options.filter((o) => o.isCorrect).length > 1,
            options:      q.kind === "MCQ" ? q.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })) : [],
          })),
        },
      }),
      ...(data.type === "PROGRAMMING" && {
        programmingDetails: {
          starterCode: starterCode.trim() || null,
          testCases: testCases.map((tc) => ({
            title:          tc.title.trim() || null,
            input:          tc.input,
            expectedOutput: tc.expectedOutput.trim(),
            points:         Number(tc.points),
            isHidden:       tc.isHidden,
          })),
        },
      }),
    };

    const res  = await fetch(`/api/courses/${courseId}/assignments`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Failed to create assignment"); return; }
    router.push(`/lecturer/courses/${courseId}/assignments/${json.data.id}`);
    router.refresh();
  };

  const isLoading = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
        )}

        <input ref={slidesInputRef} type="file" className="hidden"
          accept=".pdf,.pptx,.jpg,.jpeg,.png,.webp" onChange={handleSlidesSelected} />

        {/* Basic details */}
        <Card>
          <CardHeader><CardTitle className="text-base">Basic details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <FormField control={form.control} name="type" render={({ field }) => (
              <FormItem>
                <FormLabel>Assignment type</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {Object.entries(TYPE_LABELS).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="title" render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. Week 4 Quiz: Data Structures" disabled={isLoading} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Description / Instructions</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Explain what students should do…" disabled={isLoading} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* Marks & deadline */}
        <Card>
          <CardHeader><CardTitle className="text-base">Marks & deadline</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="totalMarks" render={({ field }) => (
                <FormItem>
                  <FormLabel>Total marks</FormLabel>
                  <FormControl><Input type="number" min={1} disabled={isLoading} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="passingMarks" render={({ field }) => (
                <FormItem>
                  <FormLabel>Passing marks <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                  <FormControl><Input type="number" min={0} disabled={isLoading} {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>
            <FormField control={form.control} name="dueDate" render={({ field }) => (
              <FormItem>
                <FormLabel>Due date & time</FormLabel>
                <FormControl>
                  <Input type="datetime-local" disabled={isLoading}
                    min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
          </CardContent>
        </Card>

        {/* ── SHORT ANSWER: rubric ───────────────────────────────────────────── */}
        {selectedType === "SHORT_ANSWER" && (
          <Card className="border-amber-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-amber-500" /> Grading Rubric
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">

              {/* AI Assistant */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
                </p>
                <Textarea
                  rows={2}
                  className="bg-white text-sm"
                  placeholder='Optional guidance — e.g. "Focus the question on time complexity trade-offs, aimed at second-year students."'
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" size="sm" variant="outline"
                    onClick={generateRubric} disabled={aiRLoading || !title} className="gap-1.5">
                    {aiRLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                      : <><Sparkles className="h-3.5 w-3.5" />Generate Rubric</>}
                  </Button>
                  <Button type="button" size="sm" variant="outline"
                    onClick={triggerSlidesUpload} disabled={slidesLoading} className="gap-1.5">
                    {slidesLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading slides…</>
                      : <><Upload className="h-3.5 w-3.5" />Question + Rubric from Slides</>}
                  </Button>
                </div>
              </div>
              <Textarea
                rows={5}
                placeholder="Describe how this assignment should be graded, or use AI to generate a rubric…"
                value={rubric}
                onChange={(e) => setRubric(e.target.value)}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1.5">
                This rubric is used by the AI grading assistant and shown to lecturers during manual grading.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── MULTIPLE CHOICE: question builder ─────────────────────────────── */}
        {selectedType === "MULTIPLE_CHOICE" && (
          <Card className="border-blue-100">
            <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-blue-500" /> Questions
                <span className="text-xs font-normal text-muted-foreground">MCQ, theory, or a mix</span>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("MCQ")} className="gap-1.5 h-8 text-xs">
                  <Plus className="h-3 w-3" /> MCQ
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => addQuestion("SHORT_TEXT")} className="gap-1.5 h-8 text-xs">
                  <Plus className="h-3 w-3" /> Theory
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* AI Assistant */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
                </p>
                <Textarea
                  rows={3}
                  className="bg-white text-sm"
                  placeholder='Describe what you want in your own words — e.g. "Generate 6 questions on binary trees: 2 easy, 3 medium, 1 very hard on AVL rotations. Worth 5 marks each."'
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                />
                <div className="flex items-center gap-2 flex-wrap">
                  <Button type="button" size="sm" onClick={generateQuestions} disabled={aiQLoading} className="gap-1.5">
                    {aiQLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                      : <><Sparkles className="h-3.5 w-3.5" />Generate Questions</>}
                  </Button>
                  <Button type="button" size="sm" variant="outline"
                    onClick={triggerSlidesUpload} disabled={slidesLoading} className="gap-1.5">
                    {slidesLoading
                      ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading slides…</>
                      : <><Upload className="h-3.5 w-3.5" />From Slides (PDF/PPTX)</>}
                  </Button>
                  <span className="text-xs text-muted-foreground">Your instructions apply to both.</span>
                </div>
              </div>
              {questions.map((q, qi) => (
                <div key={qi} className="border rounded-xl p-4 space-y-3 bg-slate-50/50">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-blue-600 border-blue-200">Q{qi + 1}</Badge>
                      {/* Kind toggle */}
                      <div className="inline-flex rounded-md border overflow-hidden text-xs">
                        <button type="button"
                          onClick={() => setQuestionKind(qi, "MCQ")}
                          className={`px-2.5 py-1 transition-colors ${q.kind === "MCQ" ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                          MCQ
                        </button>
                        <button type="button"
                          onClick={() => setQuestionKind(qi, "SHORT_TEXT")}
                          className={`px-2.5 py-1 transition-colors border-l ${q.kind === "SHORT_TEXT" ? "bg-primary text-white" : "bg-white text-slate-500 hover:bg-slate-50"}`}>
                          Theory
                        </button>
                      </div>
                    </div>
                    {questions.length > 1 && (
                      <button type="button" onClick={() => removeQuestion(qi)}
                        className="text-red-400 hover:text-red-600 transition-colors">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div className="col-span-3">
                      <label className="text-xs font-medium text-slate-600">Question text</label>
                      <Input className="mt-1" placeholder="Enter question…" value={q.text}
                        onChange={(e) => updateQuestion(qi, "text", e.target.value)} />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-600">Points</label>
                      <Input className="mt-1" type="number" min={1} value={q.points}
                        onChange={(e) => updateQuestion(qi, "points", Number(e.target.value))} />
                    </div>
                  </div>

                  {q.kind === "MCQ" ? (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-500">Options <span className="text-muted-foreground font-normal">(tick the correct one(s))</span></p>
                      {q.options.map((opt, oi) => (
                        <div key={oi} className="flex items-center gap-2">
                          <input type="checkbox" checked={opt.isCorrect}
                            onChange={(e) => updateOption(qi, oi, "isCorrect", e.target.checked)}
                            className="h-4 w-4 rounded border-slate-300 accent-blue-600" />
                          <Input
                            placeholder={`Option ${oi + 1}`}
                            value={opt.text}
                            onChange={(e) => updateOption(qi, oi, "text", e.target.value)}
                            className={opt.isCorrect ? "border-emerald-300 bg-emerald-50" : ""} />
                          {q.options.length > 2 && (
                            <button type="button" onClick={() => removeOption(qi, oi)}
                              className="text-red-400 hover:text-red-600 shrink-0">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      ))}
                      <Button type="button" variant="ghost" size="sm" className="text-xs gap-1" onClick={() => addOption(qi)}>
                        <Plus className="h-3 w-3" /> Add option
                      </Button>
                    </div>
                  ) : (
                    <div>
                      <label className="text-xs font-medium text-slate-600">
                        Model answer <span className="text-muted-foreground font-normal">(optional — guides AI-assisted grading)</span>
                      </label>
                      <Textarea className="mt-1 text-sm" rows={3}
                        placeholder="What should a full-marks answer cover?"
                        value={q.sampleAnswer}
                        onChange={(e) => updateQuestion(qi, "sampleAnswer", e.target.value)} />
                      <p className="text-xs text-muted-foreground mt-1">Students answer this in their own words. You grade it (with AI help) after submission.</p>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* ── PROGRAMMING: starter code + test cases ────────────────────────── */}
        {selectedType === "PROGRAMMING" && (
          <Card className="border-violet-100">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Code2 className="h-4 w-4 text-violet-500" /> Programming Setup
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addTestCase} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Add Test
              </Button>
            </CardHeader>
            <CardContent className="space-y-5">

              {/* AI Assistant */}
              <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" /> AI Assistant
                </p>
                <Textarea
                  rows={2}
                  className="bg-white text-sm"
                  placeholder='Optional guidance — e.g. "A medium-difficulty exercise on linked lists with 5 test cases, two of them hidden edge cases."'
                  value={aiInstructions}
                  onChange={(e) => setAiInstructions(e.target.value)}
                />
                <Button type="button" size="sm" variant="outline"
                  onClick={triggerSlidesUpload} disabled={slidesLoading} className="gap-1.5">
                  {slidesLoading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading slides…</>
                    : <><Upload className="h-3.5 w-3.5" />Exercise + Tests from Slides</>}
                </Button>
              </div>

              {/* Starter code */}
              <div>
                <label className="text-xs font-medium text-slate-600">
                  Starter code <span className="text-muted-foreground font-normal">(optional — given to students)</span>
                </label>
                <Textarea
                  className="mt-1 font-mono text-xs bg-slate-950 text-emerald-400 border-slate-700 placeholder:text-slate-500"
                  rows={6}
                  placeholder="# Write starter code for students here…"
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                />
              </div>

              {/* Test cases */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Test Cases</p>
                {testCases.map((tc, i) => (
                  <div key={i} className="border rounded-xl p-4 space-y-3 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-violet-600 border-violet-200">Test {i + 1}</Badge>
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer">
                          <input type="checkbox" checked={tc.isHidden}
                            onChange={(e) => updateTestCase(i, "isHidden", e.target.checked)}
                            className="rounded accent-violet-600" />
                          Hidden from students
                        </label>
                      </div>
                      {testCases.length > 1 && (
                        <button type="button" onClick={() => removeTestCase(i)}
                          className="text-red-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                      <div className="col-span-3">
                        <label className="text-xs font-medium text-slate-600">Test name (optional)</label>
                        <Input className="mt-1" placeholder="e.g. Empty array input" value={tc.title}
                          onChange={(e) => updateTestCase(i, "title", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Points</label>
                        <Input className="mt-1" type="number" min={1} value={tc.points}
                          onChange={(e) => updateTestCase(i, "points", Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-slate-600">Input (stdin)</label>
                        <Textarea className="mt-1 font-mono text-xs" rows={3} placeholder="Input data…"
                          value={tc.input} onChange={(e) => updateTestCase(i, "input", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-slate-600">Expected output</label>
                        <Textarea className="mt-1 font-mono text-xs" rows={3} placeholder="Expected stdout…"
                          value={tc.expectedOutput} onChange={(e) => updateTestCase(i, "expectedOutput", e.target.value)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : "Create Assignment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
