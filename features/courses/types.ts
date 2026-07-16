export type CourseWithCounts = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  semester: string;
  isActive: boolean;
  lecturerId: string;
  lecturer: { name: string; email: string };
  _count: { enrollments: number; assignments: number };
  createdAt: Date;
};

export type CreateCourseInput = {
  code: string;
  title: string;
  description?: string;
  semester: string;
};

export type UpdateCourseInput = Partial<CreateCourseInput> & {
  isActive?: boolean;
};
