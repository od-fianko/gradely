// Deliberately minimal — no sidebar, header, or bottom nav. Assessments run
// full-screen and distraction-free; each page handles its own auth.
export default function ExamLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden bg-background">{children}</div>;
}
