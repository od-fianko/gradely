import type { NotificationType } from "@prisma/client";

export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  metadata: Record<string, string> | null;
};

export type NotificationMetadata = {
  courseId?: string;
  assignmentId?: string;
  submissionId?: string;
};
