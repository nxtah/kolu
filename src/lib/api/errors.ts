// Shared API error shape: { error: { code, message } } per docs/API.md.
// Route handlers catch whatever they throw and pass it to toErrorResponse —
// never leak internal error details for unrecognized errors.

export abstract class ApiError extends Error {
  abstract readonly status: number;
  abstract readonly code: string;
}

export class UnauthorizedError extends ApiError {
  readonly status = 401;
  readonly code = "UNAUTHORIZED";
  constructor(message = "Authentication required.") {
    super(message);
  }
}

export class ForbiddenError extends ApiError {
  readonly status = 403;
  readonly code = "FORBIDDEN";
  constructor(message = "You don't have permission to do that.") {
    super(message);
  }
}

export class NotFoundError extends ApiError {
  readonly status = 404;
  readonly code = "NOT_FOUND";
  constructor(message = "Not found.") {
    super(message);
  }
}

export class ConflictError extends ApiError {
  readonly status = 409;
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export class ValidationError extends ApiError {
  readonly status = 400;
  readonly code = "INVALID_REQUEST";
  constructor(message = "Invalid request.") {
    super(message);
  }
}

export function toErrorResponse(err: unknown): Response {
  if (err instanceof ApiError) {
    return Response.json(
      { error: { code: err.code, message: err.message } },
      { status: err.status },
    );
  }

  console.error("[api] Unhandled error", err);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
    { status: 500 },
  );
}
