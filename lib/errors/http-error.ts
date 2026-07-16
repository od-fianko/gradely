import Anthropic from "@anthropic-ai/sdk";
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

  if (error instanceof Anthropic.AuthenticationError) {
    return serverError("AI service key is invalid or missing — check ANTHROPIC_API_KEY");
  }
  if (error instanceof Anthropic.RateLimitError) {
    return serverError("AI service is rate-limited — wait a moment and try again");
  }
  if (error instanceof Anthropic.APIError) {
    return serverError(`AI service error: ${error.message}`);
  }
  if (error instanceof SyntaxError) {
    return serverError("AI returned malformed output — please try again");
  }

  console.error("[Unhandled API Error]", error);
  return serverError("Something went wrong");
}
