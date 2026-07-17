"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { Loader2, Sun, Moon, User, KeyRound, Palette, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  user: { name: string; email: string; role: string };
}

export function ProfileSettings({ user }: Props) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  // Name
  const [name,        setName]        = useState(user.name);
  const [nameSaving,  setNameSaving]  = useState(false);
  const [nameMsg,     setNameMsg]     = useState<string | null>(null);

  // Password
  const [currentPw, setCurrentPw] = useState("");
  const [newPw,     setNewPw]     = useState("");
  const [pwSaving,  setPwSaving]  = useState(false);
  const [pwMsg,     setPwMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  const saveName = async () => {
    setNameSaving(true); setNameMsg(null);
    const res  = await fetch("/api/profile", {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name }),
    });
    const json = await res.json();
    setNameSaving(false);
    setNameMsg(res.ok ? "Saved" : (json.error ?? "Failed to save"));
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
            <div className="flex gap-2 mt-1.5">
              <Input value={name} onChange={(e) => setName(e.target.value)} className="max-w-sm" />
              <Button onClick={saveName} disabled={nameSaving || name.trim() === user.name} className="gap-1.5">
                {nameSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save
              </Button>
            </div>
            {nameMsg && <p className="text-xs text-muted-foreground mt-1.5">{nameMsg}</p>}
          </div>
          <div className="grid gap-1 text-sm">
            <p><span className="text-muted-foreground">Email:</span> {user.email}</p>
            <p><span className="text-muted-foreground">Role:</span> {user.role.charAt(0) + user.role.slice(1).toLowerCase()}</p>
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
