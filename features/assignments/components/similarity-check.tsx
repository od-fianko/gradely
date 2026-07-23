"use client";

import { useState } from "react";
import { Loader2, ShieldQuestion } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Pair { studentA: string; studentB: string; score: number; reason: string }

export function SimilarityCheck({ assignmentId, threshold }: { assignmentId: string; threshold: number }) {
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);
  const [result,  setResult]  = useState<{ comparedCount: number; pairs: Pair[] } | null>(null);

  const run = async () => {
    setLoading(true); setError(null);
    const res  = await fetch("/api/ai/check-similarity", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ assignmentId }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Similarity check failed"); return; }
    setResult(json.data);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldQuestion className="h-4 w-4 text-violet-500" /> Code Similarity Check
          <span className="text-xs font-normal text-muted-foreground">flags at {threshold}%+ similarity</span>
        </CardTitle>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {result ? "Re-run check" : "Run similarity check"}
        </Button>
      </CardHeader>
      <CardContent>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {result && (
          result.pairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Compared {result.comparedCount} submissions — nothing flagged above {threshold}% similarity.
            </p>
          ) : (
            <div className="space-y-2">
              {result.pairs.map((p, i) => (
                <div key={i} className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                  <Badge className="bg-amber-500 shrink-0">{p.score}%</Badge>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{p.studentA} ↔ {p.studentB}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.reason}</p>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
        {!result && !error && (
          <p className="text-sm text-muted-foreground">
            Compares every pair of submitted code for structural similarity that suggests copying rather than independent work.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
