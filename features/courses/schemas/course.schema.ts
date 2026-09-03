import { z } from "zod";
import { LEVELS } from "@/features/auth/schemas/auth.schema";

export const createCourseSchema = z.object({
  code: z.string().min(3).max(10).toUpperCase(),
  title: z.string().min(3),
  description: z.string().optional(),
  semester: z.string().min(1),
  level: z.coerce.number().refine((v) => (LEVELS as readonly number[]).includes(v), "Choose a valid level"),
  // Empty/omitted means visible to every program at this level.
  program: z.string().max(120).optional(),
});

export const updateCourseSchema = createCourseSchema.partial().extend({ isActive: z.boolean().optional() });
export type CreateCourseSchema = z.infer<typeof createCourseSchema>;
export type UpdateCourseSchema = z.infer<typeof updateCourseSchema>;
