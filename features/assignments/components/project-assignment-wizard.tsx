"use client";

import { useState } from "react";
import { FolderGit2, Sparkles, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { MarkdownText } from "@/features/assignments/components/markdown-text";

export interface ProjectConfig {
  brief:                  string;
  functionalRequirements: string; // one per line
  deliverables:           string; // one per line
  rubric:                 string;
  githubRequired:         boolean;
  allowedFileTypes:       string[];
  maxFileSizeMB:          number;
}

export const defaultProjectConfig = (): ProjectConfig => ({
  brief: "",
  functionalRequirements: "",
  deliverables: "",
  rubric: "",
  githubRequired: false,
  allowedFileTypes: ["zip", "pdf"],
  maxFileSizeMB: 25,
});

const STEPS = [
  { title: "Project Brief",       sub: "Overview for students" },
  { title: "Requirements",        sub: "Functional reqs & deliverables" },
  { title: "Rubric",              sub: "Grading criteria" },
  { title: "Submission Settings", sub: "Files, GitHub" },
] as const;

interface Props {
  title:               string;
  onTitleChange:       (v: string) => void;
  totalMarks:          number;
  gradeWeight:         string;
  onGradeWeightChange: (v: string) => void;
  config:              ProjectConfig;
  onChange:            (config: ProjectConfig) => void;
}

export function ProjectAssignmentWizard({
  title, onTitleChange, totalMarks, gradeWeight, onGradeWeightChange, config, onChange,
}: Props) {
  const [step, setStep] = useState(0);
  const [preview, setPreview] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const set = <K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]) =>
    onChange({ ...config, [key]: value });

  const requirementCount = config.functionalRequirements.split("\n").map((l) => l.trim()).filter(Boolean).length;
  const deliverableCount = config.deliverables.split("\n").map((l) => l.trim()).filter(Boolean).length;

  const generateAssignment = async () => {
    if (!aiPrompt.trim()) { setAiError("Describe the project you want the AI to generate."); return; }
    setAiGenerating(true); setAiError(null);

    const res = await fetch("/api/ai/generate-assignment-draft", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ subtype: "PROJECT", instructions: aiPrompt, totalMarks }),
    });
    const json = await res.json();
    setAiGenerating(false);
    if (!res.ok) { setAiError(json.error ?? "AI generation failed"); return; }

    const d = json.data;
    onTitleChange(d.title ?? title);
    onChange({
      ...config,
      brief:                  d.brief ?? config.brief,
      functionalRequirements: d.functionalRequirements ?? config.functionalRequirements,
      deliverables:           d.deliverables ?? config.deliverables,
      rubric:                 d.rubric ?? config.rubric,
    });
    setAiOpen(false);
  };

  return (
    <div className="flex gap-5 items-start">

      {/* Step rail */}
      <div className="w-56 shrink-0 hidden lg:block sticky top-0">
        <div className="flex flex-col">
          {STEPS.map((s, i) => {
            const active = step === i;
            const done   = step > i;
            return (
              <button key={i} type="button" onClick={() => setStep(i)} className="flex gap-3 text-left pb-1.5">
                <div className="flex flex-col items-center">
                  <div className={`h-[26px] w-[26px] rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    active ? "bg-primary text-white" : done ? "bg-primary/10 text-primary border border-primary/30" : "bg-card text-muted-foreground border"
                  }`}>
                    {i + 1}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-0.5 flex-1 min-h-[28px] ${step > i ? "bg-primary/30" : "bg-border"}`} />
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
          <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">Requirements</span><span className="font-semibold">{requirementCount}</span></div>
          <div className="flex justify-between text-sm mb-1.5"><span className="text-muted-foreground">Deliverables</span><span className="font-semibold">{deliverableCount}</span></div>
          <div className="flex justify-between text-sm"><span className="text-muted-foreground">Grading</span><span className="font-semibold">Manual / Rubric</span></div>
        </div>
      </div>

      {/* Main panel */}
      <div className="flex-1 min-w-0 flex gap-4 items-start">
        <div className="flex-1 min-w-0 bg-card border rounded-xl overflow-hidden">

          <div className="flex items-center justify-between px-5 py-4 border-b">
            <p className="flex items-center gap-2 font-bold text-foreground">
              <FolderGit2 className="h-4.5 w-4.5 text-primary" /> {STEPS[step].title}
            </p>
            <button type="button" onClick={() => setAiOpen((v) => !v)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${aiOpen ? "bg-primary text-white" : "bg-primary/10 text-primary hover:bg-primary/15"}`}>
              <Sparkles className="h-3.5 w-3.5" /> Ask AI
            </button>
          </div>

          <div className="p-5">

            {/* Project Brief */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground/90">Project title</label>
                  <Input className="mt-1.5" placeholder="e.g. Hospital Management System"
                    value={title} onChange={(e) => onTitleChange(e.target.value)} />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-foreground/90">Project brief</label>
                    <button type="button" onClick={() => setPreview((v) => !v)} className="text-xs text-primary hover:underline">
                      {preview ? "Edit" : "Preview"}
                    </button>
                  </div>
                  {preview ? (
                    <div className="mt-1.5 rounded-lg border p-3 min-h-[180px]">
                      <MarkdownText text={config.brief || "Nothing written yet."} className="text-sm" />
                    </div>
                  ) : (
                    <Textarea rows={9} className="mt-1.5 text-sm leading-relaxed"
                      placeholder="Describe the project students will build — context, purpose, and scope. Markdown supported (## headings, **bold**, bullet lists)…"
                      value={config.brief} onChange={(e) => set("brief", e.target.value)} />
                  )}
                </div>
              </div>
            )}

            {/* Requirements & Deliverables */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-foreground/90">Functional requirements</label>
                  <p className="text-xs text-muted-foreground mt-1 mb-1.5">One requirement per line.</p>
                  <Textarea rows={7} className="text-sm"
                    placeholder={"Users can register and log in\nAdmins can add, edit, and remove patient records\nSearch patients by name or ID"}
                    value={config.functionalRequirements} onChange={(e) => set("functionalRequirements", e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground/90">Deliverables</label>
                  <p className="text-xs text-muted-foreground mt-1 mb-1.5">One deliverable per line — what students must submit.</p>
                  <Textarea rows={5} className="text-sm"
                    placeholder={"Source code as a ZIP file\nA README explaining setup and usage\nA short demo video (optional)"}
                    value={config.deliverables} onChange={(e) => set("deliverables", e.target.value)} />
                </div>
              </div>
            )}

            {/* Rubric */}
            {step === 2 && (
              <div>
                <label className="text-xs font-semibold text-foreground/90">Grading rubric</label>
                <p className="text-xs text-muted-foreground mt-1 mb-1.5">
                  Describe how you'll grade this project — criteria and point allocations. Markdown supported.
                </p>
                <Textarea rows={12} className="text-sm leading-relaxed"
                  placeholder={"## Functionality (40 pts)\n- All core features work as specified\n\n## Code Quality (20 pts)\n- Clear structure, meaningful names\n\n## Documentation (20 pts)\n- README covers setup and usage\n\n## Presentation (20 pts)\n- Clean UI, sensible error handling"}
                  value={config.rubric} onChange={(e) => set("rubric", e.target.value)} />
              </div>
            )}

            {/* Submission Settings */}
            {step === 3 && (
              <div className="space-y-3.5">
                <div className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Require a GitHub repository link</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Students provide a repo URL alongside their file upload.</p>
                    </div>
                    <button type="button" onClick={() => set("githubRequired", !config.githubRequired)}
                      className={`relative h-[22px] w-[38px] rounded-full shrink-0 transition-colors ${config.githubRequired ? "bg-primary" : "bg-muted-foreground/30"}`}>
                      <span className={`absolute top-0.5 h-[18px] w-[18px] rounded-full bg-white shadow transition-all ${config.githubRequired ? "left-[18px]" : "left-0.5"}`} />
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border p-4 space-y-3">
                  <p className="text-sm font-semibold text-foreground">File upload</p>
                  <div>
                    <label className="text-xs text-muted-foreground">Allowed file types (comma-separated)</label>
                    <Input className="mt-1" value={config.allowedFileTypes.join(", ")}
                      onChange={(e) => set("allowedFileTypes", e.target.value.split(",").map((s) => s.trim().replace(/^\./, "")).filter(Boolean))}
                      placeholder="zip, pdf" />
                  </div>
                  <div className="w-32">
                    <label className="text-xs text-muted-foreground">Max file size (MB)</label>
                    <Input type="number" min={1} className="mt-1" value={config.maxFileSizeMB}
                      onChange={(e) => set("maxFileSizeMB", Number(e.target.value))} />
                  </div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-[18px]">
                  <p className="text-[11px] font-bold tracking-wide text-muted-foreground/70 uppercase mb-3">Assignment preview</p>
                  <p className="text-[15px] font-bold text-foreground">{title || "Untitled project"}</p>
                  <p className="text-sm text-muted-foreground mt-1 mb-3 line-clamp-2">
                    {config.brief ? (config.brief.length > 140 ? config.brief.slice(0, 140) + "…" : config.brief) : "No brief written yet."}
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="outline" className="bg-card">{requirementCount} requirements</Badge>
                    <Badge variant="outline" className="bg-card">{deliverableCount} deliverables</Badge>
                    {config.githubRequired && <Badge variant="outline" className="bg-card">GitHub required</Badge>}
                    <Badge variant="outline" className="bg-card">{totalMarks} marks total</Badge>
                  </div>
                </div>

                <div className="rounded-xl border p-4">
                  <p className="text-sm font-semibold text-foreground">Weight in final course grade</p>
                  <p className="text-xs text-muted-foreground mt-0.5 mb-2.5">Relative to other assignments in this course.</p>
                  <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                    <Input type="number" min={1} className="w-24 h-8" placeholder={`${totalMarks} (default)`}
                      value={gradeWeight} onChange={(e) => onGradeWeightChange(e.target.value)} />
                    <span className="text-muted-foreground">leave blank to weight by total marks</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between px-5 py-4 border-t">
            <Button type="button" variant="outline" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
              Back
            </Button>
            <Button type="button" disabled={step === STEPS.length - 1} onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}>
              {step === STEPS.length - 1 ? "All steps complete" : "Continue"}
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
                Describe the project you want — domain, scope, tech constraints. I'll draft the title, brief,
                functional requirements, deliverables, and a grading rubric for you to review.
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
                placeholder='e.g. "A hospital management system project — patient records, appointments, basic admin login. Any language."'
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
  );
}
