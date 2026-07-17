"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Timer, Loader2, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function StartAttempt({ assignmentId, minutes }: { assignmentId: string; minutes: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const start = async () => {
    setLoading(true); setError(null);
    const res = await fetch(`/api/assignments/${assignmentId}/start`, { method: "POST" });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Could not start the attempt");
      setLoading(false);
      return;
    }
    router.refresh();
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="py-10 flex flex-col items-center text-center gap-3">
        <div className="rounded-full bg-primary/10 p-3">
          <Timer className="h-7 w-7 text-primary" />
        </div>
        <p className="font-semibold text-lg">This is a timed assignment</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          You will have <span className="font-semibold text-foreground">{minutes} minutes</span> from
          the moment you begin. The timer cannot be paused, and your work is submitted automatically
          when time runs out.
        </p>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <Button onClick={start} disabled={loading} size="lg" className="mt-2 gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Start attempt
        </Button>
      </CardContent>
    </Card>
  );
}
