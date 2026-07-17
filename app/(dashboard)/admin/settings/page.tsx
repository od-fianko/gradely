import { requireRole } from "@/lib/auth/session";
import type { Metadata } from "next";
import { Settings, Database, Key, Globe } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Settings — Admin" };

const ENV_CHECKS = [
  { key: "DATABASE_URL",           label: "PostgreSQL Database",   icon: Database, required: true  },
  { key: "AUTH_SECRET",            label: "Auth Secret",           icon: Key,      required: true  },
  { key: "ANTHROPIC_API_KEY",      label: "Anthropic AI (grading)",icon: Globe,    required: false },
  { key: "BLOB_READ_WRITE_TOKEN",  label: "Vercel Blob (uploads)", icon: Globe,    required: false },
  { key: "PISTON_API_URL",         label: "Piston (code runner)",  icon: Globe,    required: false },
];

export default async function AdminSettingsPage() {
  await requireRole("ADMIN");

  const checks = ENV_CHECKS.map((e) => ({
    ...e,
    set: !!(process.env[e.key] && process.env[e.key] !== '""' && process.env[e.key] !== ""),
  }));

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-red-500" /> Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">Platform configuration and environment status</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Environment Variables</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {checks.map(({ key, label, icon: Icon, required, set }) => (
              <div key={key} className="flex items-center gap-4 px-5 py-3.5">
                <div className={`rounded-lg p-2 ${set ? "bg-emerald-50 text-emerald-600" : required ? "bg-red-50 text-red-500" : "bg-muted/60 text-slate-400"}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{key}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {required && !set && <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Required</Badge>}
                  <Badge variant="outline" className={`text-xs ${set ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-muted-foreground"}`}>
                    {set ? "Configured" : "Not set"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Platform Info</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm">
          {[
            ["App Name", process.env.NEXT_PUBLIC_APP_NAME ?? "Gradely"],
            ["Node Environment", process.env.NODE_ENV ?? "development"],
            ["Next.js", "15.x"],
            ["Database", "PostgreSQL (Neon)"],
            ["Auth", "NextAuth v5 (Auth.js)"],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between py-1 border-b last:border-0">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-medium text-foreground/90">{value}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
