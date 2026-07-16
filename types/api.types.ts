export type ApiResponse<T> =
  | { success: true; data: T; message?: string }
  | { success: false; error: string; details?: unknown };

export type PaginatedResponse<T> = {
  success: true;
  data: T[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
};

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string };
