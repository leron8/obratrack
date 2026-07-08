import express from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

export class RequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function getDatabaseError(error: unknown): { code?: string; message?: string; details?: string } | undefined {
  if (!error || typeof error !== "object") return undefined;
  const maybeError = error as { code?: unknown; message?: unknown; details?: unknown };
  if (
    typeof maybeError.code !== "string" &&
    typeof maybeError.message !== "string" &&
    typeof maybeError.details !== "string"
  ) {
    return undefined;
  }

  return {
    code: typeof maybeError.code === "string" ? maybeError.code : undefined,
    message: typeof maybeError.message === "string" ? maybeError.message : undefined,
    details: typeof maybeError.details === "string" ? maybeError.details : undefined
  };
}

export function getErrorResponse(error: unknown, fallback: string): { status: number; message: string } {
  if (error instanceof RequestError) {
    return { status: error.statusCode, message: error.message };
  }

  if (error instanceof z.ZodError) {
    const message = error.issues.map((issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`).join("; ");
    return { status: 400, message };
  }

  const dbError = getDatabaseError(error);
  if (dbError?.code === "23503") {
    const message = dbError.details?.includes("(company_id)")
      ? "Company not found for company_id. Create it in companies first or use an existing company_id."
      : "Referenced record not found. Check related IDs before saving.";
    return { status: 400, message };
  }

  if (dbError?.code === "23505") {
    return { status: 409, message: dbError.message ?? "A record with the same unique value already exists." };
  }

  if (dbError?.code && ["23502", "23514", "22P02"].includes(dbError.code)) {
    return { status: 400, message: dbError.message ?? fallback };
  }

  if (error instanceof Error) {
    return { status: 500, message: error.message || fallback };
  }

  if (dbError?.message) {
    return { status: 500, message: dbError.message };
  }

  return { status: 500, message: fallback };
}

export function sendError(res: express.Response, error: unknown, fallback: string) {
  const { status, message } = getErrorResponse(error, fallback);
  return res.status(status).json({ error: message });
}

export function getRequestedRole(req: express.Request): "admin" | "viewer" {
  const roleHeader = typeof req.header("x-user-role") === "string" ? req.header("x-user-role") : undefined;
  const roleQuery = typeof req.query.role === "string" ? req.query.role : undefined;
  const rawRole = roleHeader ?? roleQuery ?? "admin";
  return rawRole === "viewer" ? "viewer" : "admin";
}

export function getRequestDb(req: express.Request, fallback: SupabaseClient): SupabaseClient {
  return req.db ?? fallback;
}
