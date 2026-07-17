import { requireRole } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import type { Metadata } from "next";
import { format } from "date-fns";
import { Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Users — Admin" };

const ROLE_COLOR: Record<string, string> = {
  ADMIN:    "bg-red-100 text-red-700 border-red-200",
  LECTURER: "bg-blue-100 text-blue-700 border-blue-200",
  STUDENT:  "bg-emerald-100 text-emerald-700 border-emerald-200",
};

export default async function AdminUsersPage() {
  await requireRole("ADMIN");

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true, name: true, email: true, role: true, isActive: true, createdAt: true,
      _count: { select: { enrollments: true, taughtCourses: true } },
    },
  });

  const byRole = {
    ADMIN:    users.filter((u) => u.role === "ADMIN").length,
    LECTURER: users.filter((u) => u.role === "LECTURER").length,
    STUDENT:  users.filter((u) => u.role === "STUDENT").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-red-500" /> Users
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {users.length} total · {byRole.STUDENT} students · {byRole.LECTURER} lecturers · {byRole.ADMIN} admins
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y">
            {users.map((u) => (
              <div key={u.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                  u.role === "ADMIN" ? "bg-red-100 text-red-600" : u.role === "LECTURER" ? "bg-blue-100 text-blue-600" : "bg-emerald-100 text-emerald-600"
                }`}>
                  {u.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                </div>
                <div className="hidden sm:flex items-center gap-3 text-xs text-muted-foreground shrink-0">
                  {u.role === "STUDENT"  && <span>{u._count.enrollments} courses</span>}
                  {u.role === "LECTURER" && <span>{u._count.taughtCourses} courses</span>}
                  <span>{format(new Date(u.createdAt), "dd MMM yyyy")}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!u.isActive && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  <Badge variant="outline" className={`text-xs ${ROLE_COLOR[u.role]}`}>{u.role}</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
