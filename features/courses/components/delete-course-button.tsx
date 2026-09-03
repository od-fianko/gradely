"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  courseId: string;
  courseCode: string;
  studentCount: number;
  assignmentCount: number;
}

export function DeleteCourseButton({ courseId, courseCode, studentCount, assignmentCount }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteCourse = async () => {
    setDeleting(true); setError(null);
    const res = await fetch(`/api/courses/${courseId}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    if (!res.ok) { setError(json.error ?? "Failed to delete course"); return; }
    router.push("/lecturer/courses");
    router.refresh();
  };

  return (
    <>
      <Button variant="outline" className="gap-2 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" /> Delete Course
      </Button>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setError(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {courseCode}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the course, all {assignmentCount} assignment{assignmentCount !== 1 ? "s" : ""}
              {" "}(with every submission and grade), and unenrolls all {studentCount} student{studentCount !== 1 ? "s" : ""}.
              This can&apos;t be undone.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={deleteCourse} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
