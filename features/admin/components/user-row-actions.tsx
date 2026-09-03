"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, CheckCircle2, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";

interface Props {
  userId: string;
  name: string;
  isActive: boolean;
  disabled: boolean; // the viewer's own row, or the last remaining admin
}

export function UserRowActions({ userId, name, isActive, disabled }: Props) {
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleActive = async () => {
    setTogglingActive(true); setError(null);
    const res = await fetch(`/api/users/${userId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isActive: !isActive }),
    });
    const json = await res.json();
    setTogglingActive(false);
    if (!res.ok) { setError(json.error ?? "Failed to update"); return; }
    router.refresh();
  };

  const deleteUser = async () => {
    setDeleting(true); setError(null);
    const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
    const json = await res.json();
    setDeleting(false);
    if (!res.ok) { setError(json.error ?? "Failed to delete"); return; }
    setConfirmDelete(false);
    router.refresh();
  };

  return (
    <>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          title={isActive ? "Deactivate account" : "Reactivate account"}
          disabled={disabled || togglingActive}
          onClick={toggleActive}
        >
          {togglingActive ? <Loader2 className="h-4 w-4 animate-spin" />
            : isActive ? <Ban className="h-4 w-4 text-amber-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
        </Button>
        <Button
          variant="ghost" size="icon" className="h-8 w-8"
          title="Delete account"
          disabled={disabled}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>

      <Dialog open={confirmDelete} onOpenChange={(v) => { setConfirmDelete(v); if (!v) setError(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription>
              This permanently deletes the account and can&apos;t be undone. If they have any courses,
              submissions, or grades on record, deletion will be blocked — deactivate them instead in that case.
            </DialogDescription>
          </DialogHeader>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(false)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={deleteUser} disabled={deleting} className="gap-1.5">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Delete account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
