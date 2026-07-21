"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Loader2, Plus, Trash2, CheckSquare, Code2, Sparkles, FileText, Upload,
  Search, Copy, Eye, EyeOff, ArrowRight, Lightbulb, X, Wand2,
  Rocket, ChevronDown, SlidersHorizontal, FolderArchive, Inbox,
} from "lucide-react";
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
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BuilderSidebar, type BuilderCourse } from "./builder-sidebar";

const schema = z.object({
  title:        z.string().min(3, "Title must be at least 3 characters"),
  description:  z.string().min(10, "Please provide a description"),
  type:         z.enum(["PROGRAMMING", "MULTIPLE_CHOICE", "SHORT_ANSWER", "FILE_UPLOAD"]),
  totalMarks:   z.coerce.number().int().min(1).max(1000),
  dueDate:      z.string().min(1, "Due date is required"),
  passingMarks: z.coerce.number().int().min(0).optional(),
  timeLimitMinutes: z.string().optional()
    .refine((v) => !v || (/^\d+$/.test(v) && +v >= 1 && +v <= 600), "1–600 minutes"),
});

type Schema = z.infer<typeof schema>;

interface QuizOption   { text: string; isCorrect: boolean }
type QuestionKind = "MCQ" | "SHORT_TEXT";
type QDifficulty  = "EASY" | "MEDIUM" | "HARD";
interface QuizQuestion { text: string; points: number; kind: QuestionKind; difficulty: QDifficulty; sampleAnswer: string; options: QuizOption[] }
interface TestCase     { title: string; input: string; expectedOutput: string; points: number; isHidden: boolean }

const DIFFICULTY_LABEL: Record<QDifficulty, string> = { EASY: "Beginner", MEDIUM: "Intermediate", HARD: "Advanced" };

const defaultOption   = (): QuizOption   => ({ text: "", isCorrect: false });
const defaultQuestion = (kind: QuestionKind = "MCQ"): QuizQuestion => ({ text: "", points: kind === "MCQ" ? 1 : 5, kind, difficulty: "MEDIUM", sampleAnswer: "", options: kind === "MCQ" ? [defaultOption(), defaultOption()] : [] });
const defaultTestCase = (): TestCase     => ({ title: "", input: "", expectedOutput: "", points: 1, isHidden: false });

const TYPE_LABELS: Record<string, string> = {
  MULTIPLE_CHOICE: "Multiple Choice (MCQ)",
  THEORY_SET:      "Theory Questions (written answers)",
  SHORT_ANSWER:    "Essay — single question (AI-assisted grading)",
  PROGRAMMING:     "Programming (auto-graded via tests)",
  FILE_UPLOAD:     "File Upload (manual grading)",
  OTHER:           "Custom — describe it to the AI",
};
// THEORY_SET and OTHER are UI-level choices; both resolve to real DB types.

interface Props {
  courseId:        string;
  courseCode:      string;
  courseTitle:     string;
  lecturerCourses: BuilderCourse[];
}

export function CreateAssignmentForm({ courseId, courseCode, courseTitle, lecturerCourses }: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Quiz state
  const [questions,      setQuestions]      = useState<QuizQuestion[]>([defaultQuestion()]);
  const [aiInstructions, setAiInstructions] = useState("");
  const [aiQLoading,     setAiQLoading]     = useState(false);
  const [activeQ,        setActiveQ]        = useState(0);
  const [quizSearch,     setQuizSearch]     = useState("");
  const [previewOpen,    setPreviewOpen]    = useState(false);
  const [sourceFiles,    setSourceFiles]    = useState<File[]>([]);
  const quizFilesRef = useRef<HTMLInputElement>(null);
  const [suggestion,  setSuggestion]  = useState<string | null>(null);

  // Short answer state
  const [rubric,       setRubric]       = useState("");
  const [aiRLoading,   setAiRLoading]   = useState(false);

  // Programming state
  const [testCases,    setTestCases]    = useState<TestCase[]>([defaultTestCase()]);
  const [starterCode,  setStarterCode]  = useState("");
  const [difficulty,   setDifficulty]   = useState<"EASY" | "MEDIUM" | "HARD">("MEDIUM");

  // Generate-from-slides (shared across types)
  const slidesInputRef = useRef<HTMLInputElement>(null);
  const [slidesLoading, setSlidesLoading] = useState(false);

  // UI-level type selection: THEORY_SET/OTHER are presentation choices on top of DB types
  const [uiType,       setUiType]       = useState<string>("MULTIPLE_CHOICE");
  const [customFile,   setCustomFile]   = useState<File | null>(null);
  const customFileRef = useRef<HTMLInputElement>(null);
  const [designLoading, setDesignLoading] = useState(false);

  const form = useForm<Schema>({
    resolver:      zodResolver(schema),
    defaultValues: { title: "", description: "", type: "MULTIPLE_CHOICE", totalMarks: 100, dueDate: "" },
  });

  const selectedType  = form.watch("type");
  const title         = form.watch("title");
  const description   = form.watch("description");
  const totalMarks    = form.watch("totalMarks");

  const handleTypeChange = (v: string) => {
    setUiType(v);
    if (v === "MULTIPLE_CHOICE" || v === "THEORY_SET") {
      form.setValue("type", "MULTIPLE_CHOICE");
      if (v === "THEORY_SET" && questions.every((q) => !q.text.trim())) {
        setQuestions([defaultQuestion("SHORT_TEXT")]);
      }
    } else if (v === "OTHER") {
      // form type resolves when the AI designs the assignment
    } else {
      form.setValue("type", v as Schema["type"]);
    }
  };

  const showQuiz        = uiType === "MULTIPLE_CHOICE" || uiType === "THEORY_SET";
  const showEssay       = uiType === "SHORT_ANSWER";
  const showProgramming = uiType === "PROGRAMMING";
  const showCustom      = uiType === "OTHER";

  const safeActiveQ   = Math.min(activeQ, questions.length - 1);
  const activeQuestion = questions[safeActiveQ] as QuizQuestion | undefined;

  // ── Quiz helpers ──────────────────────────────────────────────────────────────

  const addQuestion    = (kind: QuestionKind = "MCQ") => setQuestions((q) => [...q, defaultQuestion(kind)]);

  const addAndSelect = (kind: QuestionKind) => {
    setActiveQ(questions.length);
    addQuestion(kind);
  };

  const duplicateQuestion = (i: number) => {
    setQuestions((q) => {
      const copy = { ...q[i], options: q[i].options.map((o) => ({ ...o })) };
      return [...q.slice(0, i + 1), copy, ...q.slice(i + 1)];
    });
    setActiveQ(i + 1);
  };

  const setQuestionKind = (i: number, kind: QuestionKind) =>
    setQuestions((q) => q.map((qs, idx) => idx === i
      ? { ...qs, kind, options: kind === "MCQ" && qs.options.length === 0 ? [defaultOption(), defaultOption()] : qs.options }
      : qs));
  const removeQuestion = (i: number) => setQuestions((q) => q.filter((_, idx) => idx !== i));
  const removeQuestionSafe = (i: number) => {
    if (questions.length <= 1) return;
    removeQuestion(i);
    setActiveQ((a) => Math.max(0, Math.min(a, questions.length - 2)));
  };

  const handleAddSourceFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    setSourceFiles((prev) => [...prev, ...picked].slice(0, 3));
  };
  const removeSourceFile = (i: number) => setSourceFiles((prev) => prev.filter((_, idx) => idx !== i));

  const switchToCode = () => {
    if (questions.some((q) => q.text.trim()) &&
        !window.confirm("Switch to a Programming assignment? Your quiz questions won't carry over.")) return;
    handleTypeChange("PROGRAMMING");
  };

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

  const generateQuestions = async (overrideText?: string) => {
    const text = (overrideText ?? aiInstructions).trim();
    if (!text) { setError("Tell the AI what you want — e.g. \"6 hard questions on AVL rotations and 2 easy ones on BST basics\""); return; }
    setAiQLoading(true); setError(null); setSuggestion(null);

    const formData = new FormData();
    formData.append("instructions", text);
    formData.append("description", description);
    formData.append("totalMarks", String(totalMarks));
    sourceFiles.forEach((f) => formData.append("files", f));

    const res  = await fetch("/api/ai/generate-questions", { method: "POST", body: formData });
    const json = await res.json();
    setAiQLoading(false);
    if (!res.ok) { setError(json.error ?? "AI generation failed"); return; }
    const generated: QuizQuestion[] = (json.data.questions ?? []).map((q: QuizQuestion) => ({
      text:         q.text,
      points:       q.points ?? 1,
      kind:         q.kind === "SHORT_TEXT" ? "SHORT_TEXT" : "MCQ",
      difficulty:   ["EASY", "MEDIUM", "HARD"].includes(q.difficulty) ? q.difficulty : "MEDIUM",
      sampleAnswer: q.sampleAnswer ?? "",
      options:      (q.options ?? []).map((o: QuizOption) => ({ text: o.text, isCorrect: o.isCorrect })),
    }));
    if (generated.length) { setQuestions(generated); setActiveQ(0); }
    if (typeof json.data.suggestion === "string" && json.data.suggestion.trim()) {
      setSuggestion(json.data.suggestion.trim());
    }
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
        difficulty:   ["EASY", "MEDIUM", "HARD"].includes(q.difficulty) ? q.difficulty : "MEDIUM",
        sampleAnswer: q.sampleAnswer ?? "",
        options:      (q.options ?? []).map((o: QuizOption) => ({ text: o.text, isCorrect: o.isCorrect })),
      }));
      if (generated.length) { setQuestions(generated); setActiveQ(0); }
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

  // ── AI: design a full assignment from natural language (+ optional slides) ──

  const designWithAi = async () => {
    if (!aiInstructions.trim()) { setError("Describe the assignment you want — question types, counts, difficulty, topic…"); return; }
    setDesignLoading(true); setError(null);

    const formData = new FormData();
    formData.append("instructions", aiInstructions);
    formData.append("totalMarks", String(totalMarks));
    if (customFile) formData.append("file", customFile);

    const res  = await fetch("/api/ai/design-assignment", { method: "POST", body: formData });
    const json = await res.json();
    setDesignLoading(false);
    if (!res.ok) { setError(json.error ?? "AI design failed"); return; }

    const d = json.data;
    form.setValue("type", d.type);
    if (!title.trim() && d.title)             form.setValue("title", d.title);
    if (!description.trim() && d.description) form.setValue("description", d.description);

    if (d.type === "MULTIPLE_CHOICE") {
      const generated: QuizQuestion[] = (d.questions ?? []).map((q: QuizQuestion) => ({
        text:         q.text,
        points:       q.points ?? 1,
        kind:         q.kind === "SHORT_TEXT" ? "SHORT_TEXT" : "MCQ",
        difficulty:   ["EASY", "MEDIUM", "HARD"].includes(q.difficulty) ? q.difficulty : "MEDIUM",
        sampleAnswer: q.sampleAnswer ?? "",
        options:      (q.options ?? []).map((o: QuizOption) => ({ text: o.text, isCorrect: o.isCorrect })),
      }));
      if (generated.length) { setQuestions(generated); setActiveQ(0); }
      setUiType("MULTIPLE_CHOICE");
    } else if (d.type === "PROGRAMMING") {
      setStarterCode(d.starterCode ?? "");
      if (d.difficulty === "EASY" || d.difficulty === "MEDIUM" || d.difficulty === "HARD") setDifficulty(d.difficulty);
      const generated: TestCase[] = (d.testCases ?? []).map((tc: TestCase) => ({
        title:          tc.title ?? "",
        input:          tc.input ?? "",
        expectedOutput: tc.expectedOutput ?? "",
        points:         tc.points ?? 1,
        isHidden:       tc.isHidden ?? false,
      }));
      if (generated.length) setTestCases(generated);
      setUiType("PROGRAMMING");
    } else if (d.type === "SHORT_ANSWER") {
      setRubric(d.rubric ?? "");
      setUiType("SHORT_ANSWER");
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
            difficulty:   q.difficulty,
            sampleAnswer: q.sampleAnswer.trim() || null,
            isMultiple:   q.kind === "MCQ" && q.options.filter((o) => o.isCorrect).length > 1,
            options:      q.kind === "MCQ" ? q.options.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })) : [],
          })),
        },
      }),
      ...(data.type === "PROGRAMMING" && {
        programmingDetails: {
          starterCode: starterCode.trim() || null,
          difficulty,
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

  const pillClass = (active: boolean) =>
    `px-3 py-1.5 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors ${
      active ? "bg-card shadow-sm" : "text-muted-foreground hover:bg-card"
    }`;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="h-screen w-screen flex overflow-hidden bg-background">

        <BuilderSidebar activeCourseId={courseId} courses={lecturerCourses} />

        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Top bar */}
          <header className="h-16 shrink-0 border-b flex items-center gap-3 px-4 bg-card">
            <Link href={`/lecturer/courses/${courseId}`}
              className="text-sm text-muted-foreground hover:text-red-600 transition-colors shrink-0">
              ← Exit
            </Link>
            <span className="text-border shrink-0">|</span>

            <FileText className="h-5 w-5 text-primary shrink-0" />
            <div className="min-w-0">
              <input
                value={title}
                onChange={(e) => form.setValue("title", e.target.value, { shouldValidate: true })}
                placeholder="Untitled Assessment"
                disabled={isLoading}
                className="font-bold text-base bg-transparent border-none outline-none focus:ring-0 p-0 w-full truncate placeholder:text-muted-foreground placeholder:font-normal"
              />
              {form.formState.errors.title && (
                <p className="text-[11px] text-red-600 -mt-0.5">{form.formState.errors.title.message}</p>
              )}
            </div>

            <div className="flex-1" />

            {/* Type tabs */}
            <div className="hidden lg:inline-flex rounded-lg border bg-muted/40 p-1 gap-1 shrink-0">
              <button type="button" onClick={() => showQuiz ? addAndSelect("MCQ") : handleTypeChange("MULTIPLE_CHOICE")}
                className={pillClass(showQuiz)}>
                <CheckSquare className="h-3.5 w-3.5" /> MCQ
              </button>
              <button type="button" onClick={() => setUiType("OTHER")}
                className={pillClass(showCustom)}>
                <Wand2 className="h-3.5 w-3.5" /> Portmanteau
              </button>
              <button type="button" onClick={() => showQuiz ? addAndSelect("SHORT_TEXT") : handleTypeChange("THEORY_SET")}
                className={pillClass(false)}>
                <FileText className="h-3.5 w-3.5" /> Theory
              </button>
              <button type="button" onClick={switchToCode}
                className={pillClass(showProgramming)}>
                <Code2 className="h-3.5 w-3.5" /> Code
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className={pillClass(showEssay || uiType === "FILE_UPLOAD")}>
                    <SlidersHorizontal className="h-3.5 w-3.5" /> More <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleTypeChange("SHORT_ANSWER")}>Essay (single question)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleTypeChange("FILE_UPLOAD")}>File Upload</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Details sheet */}
            <Sheet open={detailsOpen} onOpenChange={setDetailsOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
                  <SlidersHorizontal className="h-3.5 w-3.5" /> Details
                </Button>
              </SheetTrigger>
              <SheetContent className="overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Assessment details</SheetTitle>
                  <SheetDescription>Description, marks, deadline, and timing.</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 mt-4">
                  <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description / Instructions</FormLabel>
                      <FormControl>
                        <Textarea rows={4} placeholder="Explain what students should do…" disabled={isLoading} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
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
                  <FormField control={form.control} name="timeLimitMinutes" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Time limit, min <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl><Input type="number" min={1} max={600} placeholder="e.g. 45" disabled={isLoading} {...field} value={field.value ?? ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
              </SheetContent>
            </Sheet>

            <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
              <Link href={`/lecturer/courses/${courseId}`}><FolderArchive className="h-3.5 w-3.5" /> Drafts</Link>
            </Button>

            <Button type="submit" size="sm" disabled={isLoading} className="gap-1.5 shrink-0">
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Rocket className="h-3.5 w-3.5" />}
              Start Exam
            </Button>
          </header>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border-b border-red-200 px-4 py-2 shrink-0">{error}</p>
          )}

          <input ref={slidesInputRef} type="file" className="hidden"
            accept=".pdf,.pptx,.jpg,.jpeg,.png,.webp" onChange={handleSlidesSelected} />

          <main className="flex-1 overflow-y-auto p-5 space-y-4">
            <p className="text-xs text-muted-foreground">{courseCode} · {courseTitle}</p>

            {/* Mobile fallback: the tab pills are desktop-only */}
            <div className="lg:hidden">
              <Select onValueChange={handleTypeChange} value={uiType}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

        {/* ── CUSTOM: describe the whole assignment to the AI ───────────────── */}
        {showCustom && (
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" /> Describe your assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                rows={5}
                className="text-sm"
                placeholder={`Tell the AI exactly what you want, in your own words. Examples:

"A mixed test: 5 MCQs on sorting algorithms (2 marks each), 2 theory questions on time complexity (10 marks each)."

"A Python coding exercise on recursion with 6 test cases, half of them hidden."

"One long essay question comparing TCP and UDP with a rubric."`}
                value={aiInstructions}
                onChange={(e) => setAiInstructions(e.target.value)}
              />
              <div className="flex items-center gap-2 flex-wrap">
                <Button type="button" size="sm" onClick={designWithAi} disabled={designLoading} className="gap-1.5">
                  {designLoading
                    ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Designing…</>
                    : <><Sparkles className="h-3.5 w-3.5" />Design with AI</>}
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5"
                  onClick={() => customFileRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" />
                  {customFile ? customFile.name.slice(0, 24) : "Attach slides (optional)"}
                </Button>
                {customFile && (
                  <button type="button" className="text-xs text-muted-foreground hover:text-red-500"
                    onClick={() => setCustomFile(null)}>
                    remove
                  </button>
                )}
                <input ref={customFileRef} type="file" className="hidden"
                  accept=".pdf,.pptx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => { setCustomFile(e.target.files?.[0] ?? null); e.target.value = ""; }} />
              </div>
              <p className="text-xs text-muted-foreground">
                The AI picks the best structure (MCQ mix, theory, essay, or code), drafts everything, and shows it here for you to review and edit before creating.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── SHORT ANSWER: rubric ───────────────────────────────────────────── */}
        {showEssay && (
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
                  className="bg-card text-sm"
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

        {/* ── MULTIPLE CHOICE / THEORY: assessment builder workspace ─────────── */}
        {showQuiz && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] rounded-xl border overflow-hidden bg-card">

              {/* LEFT — question list */}
              <div className="border-b lg:border-b-0 lg:border-r bg-muted/20 flex flex-col lg:max-h-[560px]">
                <div className="p-3 border-b">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input value={quizSearch} onChange={(e) => setQuizSearch(e.target.value)}
                      placeholder="Search questions…" className="pl-8 h-9 text-sm" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5 max-h-72 lg:max-h-none">
                  {questions.map((q, qi) => {
                    if (quizSearch.trim() && !q.text.toLowerCase().includes(quizSearch.trim().toLowerCase())) return null;
                    const selected = qi === safeActiveQ;
                    return (
                      <button key={qi} type="button" onClick={() => setActiveQ(qi)}
                        className={`w-full text-left rounded-lg border p-2.5 transition-colors ${selected ? "border-primary bg-primary/5" : "border-transparent hover:bg-muted/60"}`}>
                        <p className="text-[10px] font-semibold text-muted-foreground tracking-wide">QUESTION {String(qi + 1).padStart(2, "0")}</p>
                        <p className="text-sm font-medium line-clamp-2 mt-0.5">{q.text.trim() || "Untitled question"}</p>
                        <div className="flex items-center justify-between mt-1.5">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{q.kind === "MCQ" ? "MCQ" : "THEORY"}</Badge>
                          <span className="text-[10px] text-muted-foreground">{q.points} pt{q.points !== 1 ? "s" : ""}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="p-2 border-t shrink-0">
                  <button type="button" onClick={() => addAndSelect("MCQ")}
                    className="w-full border border-dashed rounded-lg py-2 text-xs font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors flex items-center justify-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> New Question
                  </button>
                </div>
              </div>

              {/* CENTER — question editor */}
              <div className="overflow-y-auto lg:max-h-[560px] p-5 space-y-4 border-b lg:border-b-0 lg:border-r">
                {activeQuestion && (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm">Question Editor</h3>
                      <div className="flex items-center gap-1">
                        <button type="button" title="Duplicate question" onClick={() => duplicateQuestion(safeActiveQ)}
                          className="p-1.5 rounded-md text-muted-foreground hover:bg-muted/60 hover:text-foreground">
                          <Copy className="h-4 w-4" />
                        </button>
                        {questions.length > 1 && (
                          <button type="button" title="Delete question" onClick={() => removeQuestionSafe(safeActiveQ)}
                            className="p-1.5 rounded-md text-muted-foreground hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="inline-flex rounded-md border overflow-hidden text-xs">
                      <button type="button" onClick={() => setQuestionKind(safeActiveQ, "MCQ")}
                        className={`px-2.5 py-1 transition-colors ${activeQuestion.kind === "MCQ" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted/60"}`}>
                        MCQ
                      </button>
                      <button type="button" onClick={() => setQuestionKind(safeActiveQ, "SHORT_TEXT")}
                        className={`px-2.5 py-1 transition-colors border-l ${activeQuestion.kind === "SHORT_TEXT" ? "bg-primary text-white" : "bg-card text-muted-foreground hover:bg-muted/60"}`}>
                        Theory
                      </button>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-muted-foreground tracking-wide">QUESTION PROMPT</label>
                      <Textarea rows={4} className="mt-1.5 text-sm" placeholder="Enter your question text here…"
                        value={activeQuestion.text} onChange={(e) => updateQuestion(safeActiveQ, "text", e.target.value)} />
                    </div>

                    {activeQuestion.kind === "MCQ" ? (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide">MULTIPLE CHOICE OPTIONS</label>
                        <div className="mt-1.5 space-y-2">
                          {activeQuestion.options.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <span className="h-7 w-7 shrink-0 rounded-full border flex items-center justify-center text-xs font-semibold text-muted-foreground">
                                {String.fromCharCode(65 + oi)}
                              </span>
                              <Input value={opt.text} placeholder={`Option ${oi + 1}`}
                                onChange={(e) => updateOption(safeActiveQ, oi, "text", e.target.value)}
                                className={opt.isCorrect ? "border-emerald-300 bg-emerald-50" : ""} />
                              <button type="button" title="Mark as correct"
                                onClick={() => updateOption(safeActiveQ, oi, "isCorrect", !opt.isCorrect)}
                                className={`h-6 w-6 shrink-0 rounded-full border-2 flex items-center justify-center transition-colors ${opt.isCorrect ? "border-primary bg-primary" : "border-border"}`}>
                                {opt.isCorrect && <span className="h-2 w-2 rounded-full bg-white" />}
                              </button>
                              {activeQuestion.options.length > 2 && (
                                <button type="button" onClick={() => removeOption(safeActiveQ, oi)}
                                  className="text-muted-foreground hover:text-red-500 shrink-0">
                                  <X className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        <Button type="button" variant="ghost" size="sm" className="text-xs gap-1 mt-2 text-primary"
                          onClick={() => addOption(safeActiveQ)}>
                          <Plus className="h-3.5 w-3.5" /> Add another option
                        </Button>
                      </div>
                    ) : (
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide">
                          MODEL ANSWER <span className="font-normal normal-case">(optional — guides AI-assisted grading)</span>
                        </label>
                        <Textarea rows={4} className="mt-1.5 text-sm" placeholder="What should a full-marks answer cover?"
                          value={activeQuestion.sampleAnswer} onChange={(e) => updateQuestion(safeActiveQ, "sampleAnswer", e.target.value)} />
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 pt-3 border-t">
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide">DIFFICULTY</label>
                        <Select value={activeQuestion.difficulty} onValueChange={(v) => updateQuestion(safeActiveQ, "difficulty", v)}>
                          <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
                              <SelectItem key={d} value={d}>{DIFFICULTY_LABEL[d]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-muted-foreground tracking-wide">POINT VALUE</label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <Input type="number" min={1} className="h-9 text-sm" value={activeQuestion.points}
                            onChange={(e) => updateQuestion(safeActiveQ, "points", Number(e.target.value))} />
                          <span className="text-xs text-muted-foreground shrink-0">PTS</span>
                        </div>
                      </div>
                    </div>

                    <button type="button" onClick={() => setPreviewOpen((v) => !v)}
                      className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground">
                      {previewOpen ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {previewOpen ? "Hide" : "Show"} Student View Preview
                    </button>

                    {previewOpen && (
                      <div className="rounded-xl border bg-muted/30 p-5">
                        <p className="text-base font-medium leading-relaxed">
                          <span className="text-primary font-semibold mr-2">1.</span>
                          {activeQuestion.text.trim() || "Untitled question"}
                          <span className="ml-2 text-xs font-normal text-muted-foreground">
                            ({activeQuestion.points} pt{activeQuestion.points !== 1 ? "s" : ""})
                          </span>
                        </p>
                        {activeQuestion.kind === "MCQ" ? (
                          <div className="mt-3 space-y-1.5">
                            {activeQuestion.options.map((opt, oi) => (
                              <div key={oi} className="rounded-lg border px-3 py-2 text-sm bg-card">
                                {opt.text.trim() || `Option ${oi + 1}`}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <Textarea disabled rows={3} className="mt-3 text-sm bg-card"
                            placeholder="The student writes their answer here…" />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* RIGHT — AI Assistant */}
              <div className="bg-muted/10 flex flex-col lg:max-h-[560px]">
                <div className="p-4 border-b flex items-center gap-2 shrink-0">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">AI Assistant</span>
                  <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" title="Ready" />
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">

                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold text-muted-foreground tracking-wide">CONTENT SOURCES</p>
                      <button type="button" onClick={() => quizFilesRef.current?.click()}
                        className="text-xs font-medium text-primary hover:underline">Upload</button>
                    </div>
                    <input ref={quizFilesRef} type="file" multiple className="hidden"
                      accept=".pdf,.pptx,.jpg,.jpeg,.png,.webp" onChange={handleAddSourceFiles} />
                    <div className="mt-2 space-y-1.5">
                      {sourceFiles.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Attach slides to ground questions in your content.</p>
                      ) : sourceFiles.map((f, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg border bg-card p-2">
                          <FileText className="h-4 w-4 text-primary shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-medium truncate">{f.name}</p>
                            <p className="text-[10px] text-muted-foreground">{(f.size / 1024 / 1024).toFixed(1)} MB · Ready</p>
                          </div>
                          <button type="button" onClick={() => removeSourceFile(i)} className="text-muted-foreground hover:text-red-500 shrink-0">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] font-semibold text-muted-foreground tracking-wide mb-1.5">PROMPT TO QUESTION</p>
                    <Textarea rows={4} className="text-sm bg-card"
                      placeholder="Generate 5 MCQ questions about AVL Tree rotations from the uploaded slides…"
                      value={aiInstructions} onChange={(e) => setAiInstructions(e.target.value)} />
                    <Button type="button" className="w-full mt-2 gap-1.5" onClick={() => generateQuestions()} disabled={aiQLoading}>
                      {aiQLoading
                        ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating…</>
                        : <>Generate <ArrowRight className="h-3.5 w-3.5" /></>}
                    </Button>
                  </div>

                  {suggestion && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <p className="text-xs flex items-start gap-1.5">
                        <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span>&ldquo;{suggestion}&rdquo;</span>
                      </p>
                      <div className="flex gap-2">
                        <Button type="button" size="sm" className="text-xs h-7"
                          onClick={() => { const s = suggestion; setSuggestion(null); generateQuestions(s); }}>
                          Generate
                        </Button>
                        <Button type="button" size="sm" variant="outline" className="text-xs h-7" onClick={() => setSuggestion(null)}>
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── PROGRAMMING: starter code + test cases ────────────────────────── */}
        {showProgramming && (
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
                  className="bg-card text-sm"
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

              {/* Difficulty */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
                <div className="flex gap-2 mt-1.5">
                  {(["EASY", "MEDIUM", "HARD"] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDifficulty(d)}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium capitalize border transition-colors ${
                        difficulty === d
                          ? d === "EASY" ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                          : d === "MEDIUM" ? "bg-amber-50 border-amber-300 text-amber-700"
                          : "bg-red-50 border-red-300 text-red-700"
                          : "border-border text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      {d.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Starter code */}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Starter code <span className="text-muted-foreground font-normal">(optional — given to students)</span>
                </label>
                <Textarea
                  className="mt-1 font-mono text-xs bg-slate-950 text-emerald-400 border-slate-700 placeholder:text-slate-400"
                  rows={6}
                  placeholder="# Write starter code for students here…"
                  value={starterCode}
                  onChange={(e) => setStarterCode(e.target.value)}
                />
              </div>

              {/* Test cases */}
              <div className="space-y-4">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Test Cases</p>
                {testCases.map((tc, i) => (
                  <div key={i} className="border rounded-xl p-4 space-y-3 bg-muted/40">
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
                        <label className="text-xs font-medium text-muted-foreground">Test name (optional)</label>
                        <Input className="mt-1" placeholder="e.g. Empty array input" value={tc.title}
                          onChange={(e) => updateTestCase(i, "title", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Points</label>
                        <Input className="mt-1" type="number" min={1} value={tc.points}
                          onChange={(e) => updateTestCase(i, "points", Number(e.target.value))} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Input (stdin)</label>
                        <Textarea className="mt-1 font-mono text-xs" rows={3} placeholder="Input data…"
                          value={tc.input} onChange={(e) => updateTestCase(i, "input", e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-muted-foreground">Expected output</label>
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

        {/* ── FILE UPLOAD: no extra setup needed ──────────────────────────────── */}
        {uiType === "FILE_UPLOAD" && (
          <Card className="border-emerald-100">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Inbox className="h-4 w-4 text-emerald-500" /> File Upload Assignment
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Students upload a PDF, DOCX, or ZIP file (max 10 MB) for you to grade manually.
                No extra setup is needed here — set the description, marks, and deadline under{" "}
                <button type="button" onClick={() => setDetailsOpen(true)} className="text-primary underline underline-offset-2">
                  Details
                </button>.
              </p>
            </CardContent>
          </Card>
        )}
          </main>
        </div>
      </form>
    </Form>
  );
}
