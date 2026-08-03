import { z } from "zod";

export const createCourseSchema = z.object({
  code: z.string().min(3).max(10).toUpperCase(),
  title: z.string().min(3),
  description: z.string().optional(),
  semester: z.string().min(1),
  level: z.coerce.number().int().min(100).max(900),
});

export const updateCourseSchema = createCourseSchema.partial().extend({ isActive: z.boolean().optional() });
export type CreateCourseSchema = z.infer<typeof createCourseSchema>;
export type UpdateCourseSchema = z.infer<typeof updateCourseSchema>;
