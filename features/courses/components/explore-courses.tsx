"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { CourseCard } from "./course-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Course {
  id: string; code: string; title: string; description: string | null;
  semester: string; isActive: boolean;
  lecturer?: { name: string; email: string };
  _count?: { enrollments: number; assignments: number };
}

export function ExploreCourses({ courses }: { courses: Course[] }) {
  const router  = useRouter();
  const [selected, setSelected] = useState<Course | null>(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const enroll = async () => {
    if (!selected) return;
    setLoading(true); setError(null);
    const res  = await fetch(`/api/courses/${selected.id}/enroll`, { method: "POST" });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Enrollment failed"); return; }
    setSelected(null);
    router.refresh();
  };

  if (courses.length === 0)
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="text-sm text-muted-foreground">No additional courses available.</p>
      </div>
    );

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {courses.map((c) => (
          <div key={c.id} className="relative">
            <CourseCard course={c} role="STUDENT" />
            <div className="absolute inset-0 rounded-xl" onClick={(e) => { e.preventDefault(); setSelected(c); }} />
          </div>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => { if (!v) { setSelected(null); setError(null); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Enroll in {selected?.code}?</DialogTitle>
            <DialogDescription>{selected?.title}</DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
            <Button onClick={enroll} disabled={loading}>
              {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Enrolling…</> : "Confirm Enroll"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
