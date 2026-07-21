// Full-screen, distraction-free shell for the assessment builder — no
// dashboard sidebar/header. The builder ships its own dedicated left nav.
export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-screen w-screen overflow-hidden bg-background">{children}</div>;
}
