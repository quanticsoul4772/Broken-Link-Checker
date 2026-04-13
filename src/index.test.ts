// SPDX-License-Identifier: MIT
//
// Tests for the global middleware wired in src/index.ts:
//   1. 404 handler for unknown routes
//   2. Express error handler (must have 4 params to fire on next(err))
//
// These tests use a minimal in-process Express instance so they run without
// any network access and don't share state with the production app.

import { describe, it, expect } from "vitest";
import express, { NextFunction, Request, Response } from "express";
import request from "supertest";
import {
  HTTP_STATUS_NOT_FOUND,
  HTTP_STATUS_INTERNAL_SERVER_ERROR,
} from "@constant";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal app that mirrors the error-handler wiring in index.ts. */
function buildTestApp() {
  const app = express();

  // A route that exercises the error handler by calling next(err).
  app.get("/boom", (_req: Request, _res: Response, next: NextFunction) => {
    next(new Error("intentional test error"));
  });

  // 404 handler (mirrors the production wildcard).
  app.use("*", (_req: Request, res: Response) => {
    res.status(HTTP_STATUS_NOT_FOUND).json({ success: false, error: "Endpoint not found" });
  });

  // Error handler — exactly four parameters so Express recognises it.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    res.status(HTTP_STATUS_INTERNAL_SERVER_ERROR).json({
      success: false,
      error: "Internal server error",
    });
  });

  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Global middleware (index.ts)", () => {
  describe("404 handler", () => {
    it("returns 404 JSON for an unknown route", async () => {
      const app = buildTestApp();
      const res = await request(app).get("/no-such-path");
      expect(res.status).toBe(HTTP_STATUS_NOT_FOUND);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBeDefined();
    });
  });

  describe("Error handler", () => {
    it("returns 500 JSON when a route calls next(err)", async () => {
      // This test would silently return a default Express error page (no body)
      // if the error handler had fewer than 4 parameters and was therefore
      // never registered as an error handler.
      const app = buildTestApp();
      const res = await request(app).get("/boom");
      expect(res.status).toBe(HTTP_STATUS_INTERNAL_SERVER_ERROR);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Internal server error");
    });
  });
});
