export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = "AppError";
  }

  static unauthorized(message = "You must be logged in") {
    return new AppError(message, "UNAUTHORIZED", 401);
  }

  static forbidden(message = "You do not have permission") {
    return new AppError(message, "FORBIDDEN", 403);
  }

  static notFound(resource: string) {
    return new AppError(`${resource} not found`, "NOT_FOUND", 404);
  }

  static validationError(message: string) {
    return new AppError(message, "VALIDATION_ERROR", 400);
  }
}
