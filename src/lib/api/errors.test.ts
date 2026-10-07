import { describe, expect, it } from "vitest";

import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  toErrorResponse,
  UnauthorizedError,
  ValidationError,
} from "./errors";

describe("toErrorResponse", () => {
  it("maps UnauthorizedError to 401", async () => {
    const res = toErrorResponse(new UnauthorizedError());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
  });

  it("maps ForbiddenError to 403", async () => {
    const res = toErrorResponse(new ForbiddenError());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("maps ConflictError to 409 with a custom message", async () => {
    const res = toErrorResponse(new ConflictError("USERNAME_TAKEN", "That username is taken."));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body).toEqual({ error: { code: "USERNAME_TAKEN", message: "That username is taken." } });
  });

  it("maps NotFoundError to 404", async () => {
    const res = toErrorResponse(new NotFoundError());
    expect(res.status).toBe(404);
  });

  it("maps ValidationError to 400", async () => {
    const res = toErrorResponse(new ValidationError("Invalid email."));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Invalid email.");
  });

  it("maps an unknown error to a generic 500", async () => {
    const res = toErrorResponse(new Error("boom"));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
