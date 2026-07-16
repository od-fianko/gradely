"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  assignmentId: string;
  isPublished:  boolean;
  courseId:     string;
}

export function PublishToggle({ assignmentId, isPublished, courseId }: Props) {
  const router  = useRouter();
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    await fetch(`/api/assignments/${assignmentId}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ isPublished: !isPublished }),
    });
    setLoading(false);
    router.refresh();
  };

  return (
    <Button
      onClick={toggle}
      disabled={loading}
      variant={isPublished ? "outline" : "default"}
      className={isPublished
        ? "border-orange-200 text-orange-600 hover:bg-orange-50"
        : "bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md shadow-emerald-200"}
    >
      {loading ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : isPublished ? (
        <EyeOff className="mr-2 h-4 w-4" />
      ) : (
        <Eye className="mr-2 h-4 w-4" />
      )}
      {isPublished ? "Unpublish" : "Publish"}
    </Button>
  );
}
