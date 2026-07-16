"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Notification {
  id:        string;
  type:      string;
  title:     string;
  message:   string;
  isRead:    boolean;
  createdAt: string;
}

const TYPE_ICON: Record<string, string> = {
  ASSIGNMENT_PUBLISHED: "📋",
  DEADLINE_APPROACHING: "⏰",
  GRADED:              "✅",
  ANNOUNCEMENT:        "📢",
  ENROLLMENT:          "🎓",
  INTEGRITY_FLAG:      "🚩",
};

export function NotificationsPopover() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open,          setOpen]          = useState(false);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => r.json())
      .then((j) => { if (j.success) setNotifications(j.data); })
      .catch(() => {});
  }, []);

  const unread = notifications.filter((n) => !n.isRead).length;

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
  };

  const markAllRead = () => {
    notifications.filter((n) => !n.isRead).forEach((n) => markRead(n.id));
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative hover:bg-slate-100 transition-colors">
          <Bell className="h-4 w-4 text-slate-500" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-lg border-slate-200 p-0">
        <div className="flex items-center justify-between px-4 py-3">
          <DropdownMenuLabel className="p-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button onClick={markAllRead} className="text-xs text-blue-600 hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <DropdownMenuSeparator className="my-0" />

        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="h-6 w-6 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            notifications.map((n) => (
              <div key={n.id}
                onClick={() => !n.isRead && markRead(n.id)}
                className={`flex gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-slate-50 transition-colors ${n.isRead ? "opacity-60" : ""}`}>
                <span className="text-lg shrink-0 mt-0.5">{TYPE_ICON[n.type] ?? "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs leading-snug ${n.isRead ? "text-slate-600" : "text-slate-800 font-semibold"}`}>
                    {n.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                  </p>
                </div>
                {!n.isRead && <div className="h-2 w-2 rounded-full bg-blue-500 shrink-0 mt-1.5" />}
              </div>
            ))
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
