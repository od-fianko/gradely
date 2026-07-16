"use server";

import { signIn, signOut } from "@/lib/auth/auth";
import { loginSchema } from "@/features/auth/schemas/auth.schema";
import type { ActionResult } from "@/types/api.types";

export async function loginAction(
  formData: FormData
): Promise<ActionResult<void>> {
  const raw = {
    email: formData.get("email"),
    password: formData.get("password"),
  };

  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.errors[0].message };
  }

  try {
    await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    return { ok: true, data: undefined };
  } catch {
    return { ok: false, error: "Invalid email or password" };
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}
