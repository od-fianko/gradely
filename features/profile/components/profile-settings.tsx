"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, Sun, Moon, User, KeyRound, Palette, CheckCircle2, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { LEVELS } from "@/features/auth/schemas/auth.schema";

interface Props {
  user: {
    name: string; email: string; role: string;
    level: number | null; program: string | null; university: string | null;
    memberSince: Date | string | null;
  };
}

export function ProfileSettings({ user }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const isStudent = user.role === "STUDENT";

  // Profile fields
  const [name,        setName]        = useState(user.name);
  const [level,       setLevel]       = useState(user.level != null ? String(user.level) : "");
  const [program,     setProgram]     = useState(user.program ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg,    setProfileMsg]    = useState<string | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwMsg,     setPwMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  const dirty = name.trim() !== user.name
    || (isStudent && level !== (user.level != null ? String(user.level) : ""))
    || program.trim() !== (user.program ?? "");

  const saveProfile = async () => {
    setProfileSaving(true); setProfileMsg(null);
    const res  = await fetch("/api/profile", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        name,
        program: program.trim() || null,
        ...(isStudent && { level: level ? Number(level) : null }),
      }),
    });
    const json = await res.json();
    setProfileSaving(false);
    setProfileMsg(res.ok ? "Saved" : (json.error ?? "Failed to save"));
    if (res.ok) router.refresh();
  };

  const changePassword = async () => {
    setPwSaving(true); setPwMsg(null);
    const res  = await fetch("/api/profile", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const json = await res.json();
    setPwSaving(false);
    if (res.ok) {
      setPwMsg({ ok: true, text: "Password changed" });
      setCurrentPw(""); setNewPw("");
    } else {
      setPwMsg({ ok: false, text: json.error ?? "Failed to change password" });
    }
  };

  return (
    <div className="space-y-6">

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" /> Profile
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Display name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="mt-1.5 max-w-sm" />
          </div>

          <div className={isStudent ? "grid grid-cols-2 gap-4 max-w-sm" : "max-w-sm"}>
            {isStudent && (
              <div>
                <label className="text-sm font-medium">Level</label>
                <Select value={level} onValueChange={setLevel}>
                  <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select level" /></SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((l) => <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">
                {isStudent ? "Program" : "Department"} <span className="text-muted-foreground font-normal">(optional)</span>
              </label>
              <Input placeholder="Computer Science" value={program}
                onChange={(e) => setProgram(e.target.value)} className="mt-1.5" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={saveProfile} disabled={profileSaving || !dirty} className="gap-1.5">
              {profileSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save
            </Button>
            {profileMsg && <p className="text-xs text-muted-foreground">{profileMsg}</p>}
          </div>

          <div className="grid gap-1 text-sm pt-3 border-t">
            <p><span className="text-muted-foreground">Email:</span> {user.email}</p>
            <p><span className="text-muted-foreground">Role:</span> {user.role.charAt(0) + user.role.slice(1).toLowerCase()}</p>
            {user.university && (
              <p className="flex items-center gap-1.5">
                <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">University:</span> {user.university}
              </p>
            )}
            {user.memberSince && (
              <p><span className="text-muted-foreground">Member since:</span> {format(new Date(user.memberSince), "MMMM yyyy")}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card id="appearance">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Palette className="h-4 w-4 text-primary" /> Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            {([
              { value: "light", label: "Light", icon: Sun },
              { value: "dark",  label: "Dark",  icon: Moon },
            ] as const).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setTheme(value)}
                className={`flex flex-col items-center gap-2 rounded-xl border-2 px-8 py-4 transition-colors ${
                  theme === value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                }`}
              >
                <Icon className={`h-5 w-5 ${theme === value ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-sm font-medium">{label}</span>
                {theme === value && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-3">Your choice is remembered on this device.</p>
        </CardContent>
      </Card>

      {/* Password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" /> Change password
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 max-w-sm">
          <div>
            <label className="text-sm font-medium">Current password</label>
            <Input type="password" className="mt-1.5" value={currentPw}
              onChange={(e) => setCurrentPw(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">New password</label>
            <Input type="password" className="mt-1.5" placeholder="Min 8 characters" value={newPw}
              onChange={(e) => setNewPw(e.target.value)} />
          </div>
          {pwMsg && (
            <p className={`text-sm ${pwMsg.ok ? "text-emerald-600" : "text-red-600"}`}>{pwMsg.text}</p>
          )}
          <Button onClick={changePassword} disabled={pwSaving || !currentPw || newPw.length < 8} className="gap-1.5">
            {pwSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Update password
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
