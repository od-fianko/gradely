import { z } from "zod";
import { AssignmentType } from "@prisma/client";

export const createAssignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Provide a meaningful description"),
  type: z.nativeEnum(AssignmentType),
  totalMarks: z.number().int().positive("Total marks must be positive"),
  passingMarks: z.number().int().positive().optional(),
  dueDate: z.string().datetime("Invalid date"),
  allowLateSubmit: z.boolean().default(false),
});

export type CreateAssignmentSchema = z.infer<typeof createAssignmentSchema>;
