import type { SupabaseClient } from "@supabase/supabase-js";
import express from "express";
import { z } from "zod";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject
} from "../services/supabase";
import type { Env } from "../env";
import type { ProjectStatus } from "@expenses/shared";
import { RequestError, getRequestDb, getRequestedRole, sendError } from "./http-helpers";

const ProjectStatusSchema = z.enum(["planning", "active", "paused", "completed", "cancelled"]);

const NullableStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || null : value),
  z.string().nullable().optional()
);

const NullableUuidSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid().nullable().optional()
);

const NullableDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable().optional()
);

const ProjectWriteSchema = z
  .object({
    client_id: NullableUuidSchema,
    code: NullableStringSchema,
    name: z.string().trim().min(1, "Project name is required.").max(180),
    description: NullableStringSchema,
    status: ProjectStatusSchema.optional().default("active"),
    budget: z.coerce.number().min(0).optional().default(0),
    start_date: NullableDateSchema,
    estimated_end_date: NullableDateSchema,
    completed_at: NullableDateSchema,
    address: NullableStringSchema
  })
  .strip();

const ProjectUpdateSchema = z
  .object({
    client_id: NullableUuidSchema,
    code: NullableStringSchema,
    name: z.string().trim().min(1, "Project name is required.").max(180).optional(),
    description: NullableStringSchema,
    status: ProjectStatusSchema.optional(),
    budget: z.coerce.number().min(0).optional(),
    start_date: NullableDateSchema,
    estimated_end_date: NullableDateSchema,
    completed_at: NullableDateSchema,
    address: NullableStringSchema
  })
  .strip();

function normalizeProjectPayload({
  payload,
  isUpdate = false
}: {
  payload: Record<string, unknown>;
  isUpdate?: boolean;
}) {
  const parsed = (isUpdate ? ProjectUpdateSchema : ProjectWriteSchema).parse(payload);
  const normalized: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined)
  );

  const shouldClearCompletedAt =
    (!isUpdate && normalized.status !== "completed") ||
    (isUpdate && normalized.status !== undefined && normalized.status !== "completed");

  if (shouldClearCompletedAt && !("completed_at" in normalized)) {
    normalized.completed_at = null;
  }

  if (Object.keys(normalized).length === 0) {
    throw new RequestError(400, "No valid project fields provided.");
  }

  return normalized;
}

export function createProjectsRouter({
  env,
  db
}: {
  env: Env;
  db: SupabaseClient;
}) {
  const router = express.Router();

  router.get("/projects", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const limit = Number(req.query.limit ?? 50);
      const status =
        typeof req.query.status === "string"
          ? (ProjectStatusSchema.parse(req.query.status) as ProjectStatus)
          : undefined;

      const projects = await listProjects({
        db: getRequestDb(req, db),
        companyId,
        limit: Math.min(Math.max(limit, 1), 200),
        status
      });

      return res.json({ projects });
    } catch (error) {
      console.error("list-projects error:", error);
      return sendError(res, error, "Unable to list projects.");
    }
  });

  router.get("/projects/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const project = await getProject({
        db: getRequestDb(req, db),
        companyId,
        projectId: req.params.id
      });

      if (!project) {
        return res.status(404).json({ error: "Project not found." });
      }

      return res.json({ project });
    } catch (error) {
      console.error("get-project error:", error);
      return sendError(res, error, "Unable to get project.");
    }
  });

  router.post("/projects", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const project = await createProject({
        db: getRequestDb(req, db),
        companyId,
        payload: normalizeProjectPayload({ payload: req.body as Record<string, unknown> })
      });

      return res.json({ project });
    } catch (error) {
      console.error("create-project error:", error);
      return sendError(res, error, "Unable to create project.");
    }
  });

  router.put("/projects/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const project = await updateProject({
        db: getRequestDb(req, db),
        companyId,
        projectId: req.params.id,
        payload: normalizeProjectPayload({
          payload: req.body as Record<string, unknown>,
          isUpdate: true
        })
      });

      return res.json({ project });
    } catch (error) {
      console.error("update-project error:", error);
      return sendError(res, error, "Unable to update project.");
    }
  });

  router.delete("/projects/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deleteProject({
        db: getRequestDb(req, db),
        companyId,
        projectId: req.params.id
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-project error:", error);
      return sendError(res, error, "Unable to delete project.");
    }
  });

  return router;
}
