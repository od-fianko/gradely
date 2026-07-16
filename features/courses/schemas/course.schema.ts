import { z } from "zod";

export const createCourseSchema = z.object({
  code: z
    .string()
    .min(3, "Course code too short")
    .max(10, "Course code too long")
    .toUpperCase(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().optional(),
  semester: z.string().min(1, "Semester is required"),
});

export const updateCourseSchema = createCourseSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export type CreateCourseSchema = z.infer<typeof createCourseSchema>;
export type UpdateCourseSchema = z.infer<typeof updateCourseSchema>;
