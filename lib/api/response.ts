import { NextResponse } from "next/server";

type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

type ApiError = {
  success: false;
  error: string;
  details?: unknown;
};

export function ok<T>(data: T, message?: string, status = 200) {
  const body: ApiSuccess<T> = { success: true, data, ...(message && { message }) };
  return NextResponse.json(body, { status });
}

export function created<T>(data: T, message?: string) {
  return ok(data, message, 201);
}

export function badRequest(error: string, details?: unknown) {
  const body: ApiError = details !== undefined
    ? { success: false, error, details }
    : { success: false, error };
  return NextResponse.json(body, { status: 400 });
}

export function unauthorized(error = "Unauthorized") {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 401 });
}

export function forbidden(error = "Forbidden") {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 403 });
}

export function notFound(error = "Not found") {
  const body: ApiError = { success: false, error };
  return NextResponse.json(body, { status: 404 });
}

export function serverError(error = "Internal server error", details?: unknown) {
  const body: ApiError = details !== undefined
    ? { success: false, error, details }
    : { success: false, error };
  return NextResponse.json(body, { status: 500 });
}
