"use client";

import { useEffect, useState } from "react";
import { Code2, Sparkles, LayoutDashboard, type LucideIcon } from "lucide-react";

interface Feature {
  icon: LucideIcon;
  label: string;
  title: string;
  caption: string;
}

const FEATURES: Feature[] = [
  {
    icon: Code2, label: "CODING WORKSPACE",
    title: "Students code in the browser",
    caption: "Tests run the moment they submit. The AI tutor gives hints, never the answer.",
  },
  {
    icon: Sparkles, label: "ASSIGNMENT BUILDER",
    title: "Build it yourself, or brief the AI",
    caption: "Write every question by hand, or generate a draft and edit what it gives you.",
  },
  {
    icon: LayoutDashboard, label: "STUDENT DASHBOARD",
    title: "Grades land the moment work is marked",
    caption: "Students see deadlines, results, and feedback in one place.",
  },
];

export function AuthShowcase() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setActive((a) => (a + 1) % FEATURES.length), 4200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative hidden lg:flex flex-col justify-between min-h-screen overflow-hidden bg-[#0d0f14]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 760px 460px at 16% 6%, rgba(109,111,240,.28), transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 620px 400px at 88% 92%, rgba(37,99,235,.16), transparent 70%)" }}
      />

      {/* Brand */}
      <div className="relative flex items-center gap-3 px-11 py-8">
        <div className="flex h-[30px] w-[30px] items-center justify-center rounded-[7px] bg-primary">
          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
          </svg>
        </div>
        <div className="font-serif text-[17px] font-bold tracking-tight text-zinc-100">Gradely</div>
      </div>

      {/* Headline */}
      <div className="relative max-w-[520px] px-11">
        <div className="font-serif text-[38px] font-bold leading-[1.14] tracking-tight text-white text-balance">
          Set coding work as often as your students need it.
        </div>
        <p className="mt-3.5 max-w-[420px] text-sm leading-relaxed text-zinc-400 text-balance">
          Write assignments yourself, or brief the built-in AI and edit what it drafts. Test cases run the moment students submit.
        </p>
      </div>

      {/* Feature showcase */}
      <div className="relative px-11 pb-9 pt-7">
        <div className="relative h-[210px]">
          {FEATURES.map((f, i) => {
            const order = (i - active + FEATURES.length) % FEATURES.length;
            const front = order === 0;
            const Icon = f.icon;
            return (
              <button
                key={f.label}
                onClick={() => setActive(i)}
                className="absolute w-[420px] rounded-xl border text-left transition-all duration-500"
                style={{
                  top: order * 14, left: order * 20,
                  borderColor: `rgba(255,255,255,${front ? 0.16 : 0.08})`,
                  background: "#0f1218",
                  boxShadow: front ? "0 26px 60px -18px rgba(0,0,0,.85)" : "0 14px 34px -14px rgba(0,0,0,.7)",
                  transform: `scale(${1 - order * 0.045})`, transformOrigin: "top left",
                  opacity: front ? 1 : order === 1 ? 0.5 : 0.28,
                  zIndex: 10 - order,
                  cursor: front ? "default" : "pointer",
                }}
              >
                <div className="flex items-center gap-1.5 border-b border-white/[.07] bg-[#171a21] px-3 py-2">
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="h-2 w-2 rounded-full bg-zinc-600" />
                  <span className="ml-2 font-mono text-[10px] tracking-wide text-zinc-500">{f.label}</span>
                </div>
                <div className="flex h-[150px] items-center justify-center bg-gradient-to-br from-primary/20 via-[#151824] to-[#0f1218]">
                  <Icon className="h-11 w-11 text-primary/70" strokeWidth={1.5} />
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-6">
          <div className="min-w-0 flex-1">
            <div className="font-serif text-[17px] font-bold text-white">{FEATURES[active].title}</div>
            <p className="mt-1 text-[12.5px] text-zinc-400 text-balance">{FEATURES[active].caption}</p>
          </div>
          <div className="flex shrink-0 gap-1.5">
            {FEATURES.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setActive(i)}
                aria-label={`Show ${f.title}`}
                className="h-1.5 rounded-full transition-all duration-300"
                style={{ width: i === active ? 20 : 6, background: i === active ? "#8b8dff" : "rgba(255,255,255,.22)" }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
