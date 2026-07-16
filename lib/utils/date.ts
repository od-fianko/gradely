import { formatDistanceToNow, format, isPast, isFuture } from "date-fns";

export function fromNow(date: Date | string) {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function formatDate(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string) {
  return format(new Date(date), "MMM d, yyyy 'at' h:mm a");
}

export function isOverdue(dueDate: Date | string) {
  return isPast(new Date(dueDate));
}

export function isUpcoming(dueDate: Date | string) {
  return isFuture(new Date(dueDate));
}

export function getDaysUntil(date: Date | string) {
  const diff = new Date(date).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
