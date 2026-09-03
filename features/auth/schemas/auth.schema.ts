import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

// Step 1 — email only. Ownership is confirmed via OTP before anything else is collected.
export const startRegisterSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

// Undergraduate levels — most programs run 100/200/300/400; a free number
// field let people submit levels (like 900) that don't exist anywhere.
export const LEVELS = [100, 200, 300, 400] as const;

// Step 3 — collected only after the email has been OTP-verified. Level only
// applies to students; lecturers skip it (refined below).
export const completeRegisterSchema = z
  .object({
    email: z.string().email(),
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
export type StartRegisterSchema = z.infer<typeof startRegisterSchema>;
export type CompleteRegisterSchema = z.infer<typeof completeRegisterSchema>;
export type VerifyCodeSchema = z.infer<typeof verifyCodeSchema>;
