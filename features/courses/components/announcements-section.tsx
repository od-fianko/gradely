"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { Megaphone, Plus, Loader2, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

interface Announcement {
  id:        string;
  title:     string;
  content:   string;
  createdAt: string;
  author:    { name: string; role: string };
}

interface Props {
  courseId:      string;
  announcements: Announcement[];
  canPost:       boolean;
}

export function AnnouncementsSection({ courseId, announcements: initial, canPost }: Props) {
  const router  = useRouter();
  const [items,    setItems]    = useState<Announcement[]>(initial);
  const [showForm, setShowForm] = useState(false);
  const [title,    setTitle]    = useState("");
  const [content,  setContent]  = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const post = async () => {
    if (!title.trim() || !content.trim()) { setError("Title and content are required"); return; }
    setLoading(true); setError(null);
    const res  = await fetch("/api/announcements", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ courseId, title, content }),
    });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) { setError(json.error ?? "Failed to post"); return; }
    setItems((prev) => [{ ...json.data, author: { name: "You", role: "LECTURER" } }, ...prev]);
    setTitle(""); setContent(""); setShowForm(false);
    router.refresh();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-amber-500" /> Announcements
        </h2>
        {canPost && !showForm && (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowForm(true)}>
            <Plus className="h-3.5 w-3.5" /> Post
          </Button>
        )}
      </div>

      {showForm && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="pt-4 space-y-3">
            {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <Input placeholder="Announcement title…" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Textarea rows={4} placeholder="Write your announcement…" value={content} onChange={(e) => setContent(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => { setShowForm(false); setError(null); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Cancel
              </Button>
              <Button size="sm" disabled={loading}
                className="bg-amber-500 hover:bg-amber-600 text-white"
                onClick={post}>
                {loading ? <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Posting…</> : "Post Announcement"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {items.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            No announcements yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {items.map((a) => (
            <Card key={a.id} className="border-amber-100">
              <CardHeader className="pb-1 pt-4 px-4">
                <CardTitle className="text-sm flex items-start justify-between gap-2">
                  <span>{a.title}</span>
                  <span className="text-xs font-normal text-muted-foreground shrink-0">
                    {formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })}
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">by {a.author.name}</p>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <p className="text-sm text-foreground/90 whitespace-pre-wrap">{a.content}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
