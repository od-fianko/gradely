import { AppError } from "./app-error";
import { badRequest, forbidden, notFound, serverError, unauthorized } from "@/lib/api/response";

export function handleApiError(error: unknown) {
  if (error instanceof AppError) {
    switch (error.statusCode) {
      case 401: return unauthorized(error.message);
      case 403: return forbidden(error.message);
      case 404: return notFound(error.message);
      default:  return badRequest(error.message);
    }
  }

  console.error("[Unhandled API Error]", error);
  return serverError("Something went wrong");
}
