import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Undergraduate levels — most programs run 100/200/300/400; a free number
// field let people submit levels (like 900) that don't exist anywhere.
export const LEVELS = [100, 200, 300, 400] as const;

// Registration — collected in one screen, matching the design. The account
// is created immediately (unverified); a follow-up OTP just confirms the
// email before the person can sign in. Level only applies to students.
export const registerSchema = z
  .object({
    email: z.string().email("Enter a valid email address"),
    role: z.enum(["STUDENT", "LECTURER"]),
    name: z.string().min(2, "Name must be at least 2 characters"),
    level: z.coerce.number().refine((v) => (LEVELS as readonly number[]).includes(v), "Choose a valid level").optional(),
    program: z.string().max(120).optional(),
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[A-Z]/, "Password must contain an uppercase letter")
      .regex(/[0-9]/, "Password must contain a number"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.role !== "STUDENT" || data.level !== undefined, {
    message: "Select your level",
    path: ["level"],
  });

export const verifyCodeSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6, "Enter the 6-digit code"),
});

export type LoginSchema = z.infer<typeof loginSchema>;
export type RegisterSchema = z.infer<typeof registerSchema>;
export type VerifyCodeSchema = z.infer<typeof verifyCodeSchema>;
