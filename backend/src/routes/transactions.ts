import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import express from "express";
import { z } from "zod";
import { parseMovementText } from "../services/openai";
import {
  createMovement,
  deleteMovement,
  insertMovement,
  listMovements,
  getMovement,
  reportMonthMovements,
  updateMovement,
  listAccounts,
  listExpenseCategories
} from "../services/supabase";
import type { Env } from "../env";
import type { MovementDirection, MovementKind, PaymentMethod } from "@expenses/shared";

const DirectionSchema = z.enum(["in", "out"]);
const MovementKindSchema = z.enum([
  "client_income",
  "cash_income",
  "invoice_exchange",
  "expense",
  "supplier_payment",
  "supplier_credit_purchase",
  "fuel_expense",
  "payroll_payment",
  "employee_loan_disbursement",
  "employee_loan_repayment",
  "partner_loan_disbursement",
  "partner_loan_repayment",
  "card_funding",
  "bank_fee",
  "tax_payment",
  "internal_transfer",
  "adjustment"
]);
const PaymentMethodSchema = z.enum([
  "cash",
  "bank_transfer",
  "card",
  "cheque",
  "fuel_card",
  "credit",
  "payroll_discount",
  "other"
]);

const NullableStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || null : value),
  z.string().nullable().optional()
);

const NullableUuidSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid().nullable().optional()
);

const OptionalDateSchema = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable().optional()
);

const MovementWriteSchema = z
  .object({
    account_id: z.string().uuid().nullable().optional(),
    movement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
    direction: DirectionSchema,
    movement_kind: MovementKindSchema,
    amount: z.coerce.number().positive(),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(12)
      .transform((value) => value.toUpperCase())
      .optional()
      .default("MXN"),
    payment_method: z.preprocess(
      (value) => (value === "" ? null : value),
      PaymentMethodSchema.nullable().optional()
    ),
    description: NullableStringSchema,
    notes: NullableStringSchema,
    business_partner_id: NullableUuidSchema,
    employee_id: NullableUuidSchema,
    project_id: NullableUuidSchema,
    vehicle_id: NullableUuidSchema,
    expense_category_id: NullableUuidSchema,
    cost_center_id: NullableUuidSchema,
    check_number: NullableStringSchema,
    invoice_number: NullableStringSchema,
    external_reference: NullableStringSchema
  })
  .strip();

const MovementUpdateSchema = z
  .object({
    account_id: z.string().uuid().optional(),
    movement_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").optional(),
    direction: DirectionSchema.optional(),
    movement_kind: MovementKindSchema.optional(),
    amount: z.coerce.number().positive().optional(),
    currency: z
      .string()
      .trim()
      .min(1)
      .max(12)
      .transform((value) => value.toUpperCase())
      .optional(),
    payment_method: z.preprocess(
      (value) => (value === "" ? null : value),
      PaymentMethodSchema.nullable().optional()
    ),
    description: NullableStringSchema,
    notes: NullableStringSchema,
    business_partner_id: NullableUuidSchema,
    employee_id: NullableUuidSchema,
    project_id: NullableUuidSchema,
    vehicle_id: NullableUuidSchema,
    expense_category_id: NullableUuidSchema,
    cost_center_id: NullableUuidSchema,
    check_number: NullableStringSchema,
    invoice_number: NullableStringSchema,
    external_reference: NullableStringSchema
  })
  .strip();

class RequestError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string
  ) {
    super(message);
  }
}

function normalizeMovementPayload({
  payload,
  requireAmount
}: {
  payload: Record<string, unknown>;
  requireAmount?: boolean;
}) {
  const parsed = MovementWriteSchema.parse(payload);
  const normalized: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined)
  );

  if (requireAmount && normalized.amount === undefined) {
    throw new RequestError(400, "`amount` is required.");
  }

  if (Object.keys(normalized).length === 0) {
    throw new RequestError(400, "No valid movement fields provided.");
  }

  return normalized;
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

function getErrorResponse(error: unknown, fallback: string): { status: number; message: string } {
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
      : "Referenced record not found. Check related IDs before saving this movement.";
    return { status: 400, message };
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

function sendError(res: express.Response, error: unknown, fallback: string) {
  const { status, message } = getErrorResponse(error, fallback);
  return res.status(status).json({ error: message });
}

function getRequestedRole(req: express.Request): "admin" | "viewer" {
  const roleHeader = typeof req.header("x-user-role") === "string" ? req.header("x-user-role") : undefined;
  const roleQuery = typeof req.query.role === "string" ? req.query.role : undefined;
  const rawRole = roleHeader ?? roleQuery ?? "admin";
  return rawRole === "viewer" ? "viewer" : "admin";
}

export function createTransactionsRouter({
  env,
  openaiClient,
  db
}: {
  env: Env;
  openaiClient: OpenAI;
  db: SupabaseClient;
}) {
  const router = express.Router();

  // ── Parse movement from natural language ──────────────────────────

  router.post("/parse-movement", async (req, res) => {
    try {
      const { text } = req.body as { text?: string };
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Missing `text`." });
      }

      const parsed = await parseMovementText({
        client: openaiClient,
        model: env.OPENAI_PARSING_MODEL,
        text,
        defaultCurrency: env.DEFAULT_CURRENCY
      });

      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;

      // Build insert payload for account_movements
      const payload: Record<string, unknown> = {
        movement_date: parsed.movement_date ?? new Date().toISOString().slice(0, 10),
        direction: parsed.direction,
        movement_kind: parsed.movement_kind,
        amount: parsed.amount,
        currency: parsed.currency,
        description: parsed.description ?? null,
        payment_method: parsed.payment_method ?? null,
        account_id: parsed.account_id ?? null,
        business_partner_id: parsed.business_partner_id ?? null,
        employee_id: parsed.employee_id ?? null,
        project_id: parsed.project_id ?? null,
        vehicle_id: parsed.vehicle_id ?? null,
        expense_category_id: parsed.expense_category_id ?? null,
        cost_center_id: parsed.cost_center_id ?? null,
        source_module: "whatsapp_parse"
      };

      const inserted = await insertMovement({
        db,
        companyId,
        payload
      });

      return res.json({
        transcript: text,
        parsed,
        movement: inserted
      });
    } catch (error) {
      console.error("parse-movement error:", error);
      return sendError(res, error, "Unable to parse movement.");
    }
  });

  // Legacy alias
  router.post("/parse-transaction", async (req, res) => {
    try {
      const { text } = req.body as { text?: string };
      if (!text || !text.trim()) {
        return res.status(400).json({ error: "Missing `text`." });
      }

      const parsed = await parseMovementText({
        client: openaiClient,
        model: env.OPENAI_PARSING_MODEL,
        text,
        defaultCurrency: env.DEFAULT_CURRENCY
      });

      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;

      const payload: Record<string, unknown> = {
        movement_date: parsed.movement_date ?? new Date().toISOString().slice(0, 10),
        direction: parsed.direction,
        movement_kind: parsed.movement_kind,
        amount: parsed.amount,
        currency: parsed.currency,
        description: parsed.description ?? null,
        payment_method: parsed.payment_method ?? null,
        source_module: "api_parse"
      };

      const inserted = await insertMovement({
        db,
        companyId,
        payload
      });

      return res.json({
        transcript: text,
        parsed,
        movement: inserted
      });
    } catch (error) {
      console.error("parse-transaction error:", error);
      return sendError(res, error, "Unable to parse movement.");
    }
  });

  // ── List movements ────────────────────────────────────────────────

  router.get("/movements", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const limit = Number(req.query.limit ?? 50);
      const direction = typeof req.query.direction === "string" ? (req.query.direction as MovementDirection) : undefined;
      const movementKind = typeof req.query.movement_kind === "string" ? (req.query.movement_kind as MovementKind) : undefined;

      const rows = await listMovements({
        db,
        companyId,
        limit: Math.min(Math.max(limit, 1), 200),
        direction,
        movementKind
      });

      return res.json({ movements: rows });
    } catch (error) {
      console.error("list-movements error:", error);
      return sendError(res, error, "Unable to list movements.");
    }
  });

  // Legacy alias
  router.get("/transactions", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const limit = Number(req.query.limit ?? 50);
      const rows = await listMovements({
        db,
        companyId,
        limit: Math.min(Math.max(limit, 1), 200)
      });

      return res.json({ transactions: rows });
    } catch (error) {
      console.error("list-transactions error:", error);
      return sendError(res, error, "Unable to list transactions.");
    }
  });

  // ── Get single movement ───────────────────────────────────────────

  router.get("/movements/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const movement = await getMovement({
        db,
        companyId,
        movementId: req.params.id
      });

      if (!movement) {
        return res.status(404).json({ error: "Movement not found." });
      }

      return res.json({ movement });
    } catch (error) {
      console.error("get-movement error:", error);
      return sendError(res, error, "Unable to get movement.");
    }
  });

  // ── Create movement ───────────────────────────────────────────────

  router.post("/movements", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const normalizedPayload = normalizeMovementPayload({
        payload: req.body as Record<string, unknown>,
        requireAmount: true
      });

      // Always set source_module
      if (!normalizedPayload.source_module) {
        normalizedPayload.source_module = "api";
      }

      const created = await createMovement({ db, companyId, payload: normalizedPayload });
      return res.json({ movement: created });
    } catch (error) {
      console.error("create-movement error:", error);
      return sendError(res, error, "Unable to create movement.");
    }
  });

  // Legacy alias
  router.post("/transactions", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const body = req.body as Record<string, unknown>;

      // Map legacy transaction_type to direction/movement_kind
      const transactionType = body.transaction_type ?? body.type;
      const direction: MovementDirection = transactionType === "income" ? "in" : "out";
      let movementKind: MovementKind = "expense";
      if (transactionType === "income") movementKind = "client_income";
      else if (transactionType === "payroll") movementKind = "payroll_payment";
      else if (transactionType === "transfer") movementKind = "internal_transfer";
      else if (transactionType === "adjustment") movementKind = "adjustment";

      const payload: Record<string, unknown> = {
        account_id: body.account_id ?? null,
        movement_date: body.transaction_date ?? new Date().toISOString().slice(0, 10),
        direction,
        movement_kind: movementKind,
        amount: body.amount,
        currency: body.currency ?? env.DEFAULT_CURRENCY,
        payment_method: body.payment_method ?? null,
        description: body.description ?? body.notes ?? null,
        notes: body.notes ?? null,
        business_partner_id: body.supplier_id ?? body.client_id ?? null,
        employee_id: body.employee_id ?? null,
        project_id: body.project_id ?? null,
        vehicle_id: body.vehicle_id ?? null,
        expense_category_id: body.expense_category_id ?? body.category_id ?? null,
        cost_center_id: body.cost_center_id ?? null,
        source_module: "api"
      };

      const created = await createMovement({ db, companyId, payload });
      return res.json({ transaction: created });
    } catch (error) {
      console.error("create-transaction error:", error);
      return sendError(res, error, "Unable to create transaction.");
    }
  });

  // ── Update movement ───────────────────────────────────────────────

  router.put("/movements/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const body = req.body as Record<string, unknown>;
      const parsed = MovementUpdateSchema.parse(body);
      const payload: Record<string, unknown> = Object.fromEntries(
        Object.entries(parsed).filter(([, value]) => value !== undefined)
      );

      const updated = await updateMovement({
        db,
        companyId,
        movementId: req.params.id,
        payload
      });

      return res.json({ movement: updated });
    } catch (error) {
      console.error("update-movement error:", error);
      return sendError(res, error, "Unable to update movement.");
    }
  });

  // Legacy alias
  router.put("/transactions/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const body = req.body as Record<string, unknown>;
      const payload: Record<string, unknown> = {};

      if (body.amount !== undefined) payload.amount = body.amount;
      if (body.currency !== undefined) payload.currency = body.currency;
      if (body.description !== undefined) payload.description = body.description;
      if (body.notes !== undefined) payload.notes = body.notes;
      if (body.payment_method !== undefined) payload.payment_method = body.payment_method;
      if (body.transaction_date !== undefined) payload.movement_date = body.transaction_date;
      if (body.account_id !== undefined) payload.account_id = body.account_id;
      if (body.project_id !== undefined) payload.project_id = body.project_id;
      if (body.supplier_id !== undefined) payload.business_partner_id = body.supplier_id;
      if (body.client_id !== undefined) payload.business_partner_id = body.client_id;
      if (body.employee_id !== undefined) payload.employee_id = body.employee_id;
      if (body.vehicle_id !== undefined) payload.vehicle_id = body.vehicle_id;
      if (body.expense_category_id !== undefined) payload.expense_category_id = body.expense_category_id;

      const updated = await updateMovement({
        db,
        companyId,
        movementId: req.params.id,
        payload
      });

      return res.json({ transaction: updated });
    } catch (error) {
      console.error("update-transaction error:", error);
      return sendError(res, error, "Unable to update transaction.");
    }
  });

  // ── Delete movement (soft) ────────────────────────────────────────

  router.delete("/movements/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deleteMovement({ db, companyId, movementId: req.params.id });
      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-movement error:", error);
      return sendError(res, error, "Unable to delete movement.");
    }
  });

  // Legacy alias
  router.delete("/transactions/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deleteMovement({ db, companyId, movementId: req.params.id });
      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-transaction error:", error);
      return sendError(res, error, "Unable to delete transaction.");
    }
  });

  // ── Monthly report ────────────────────────────────────────────────

  router.get("/report/month", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const month = (req.query.month as string | undefined) ?? new Date().toISOString().slice(0, 7); // YYYY-MM

      const [yearStr, monthStr] = month.split("-");
      const year = Number(yearStr);
      const monthIndex = Number(monthStr) - 1;
      if (!Number.isFinite(year) || !Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) {
        return res.status(400).json({ error: "Invalid `month`. Use YYYY-MM." });
      }

      const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
      const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0));

      const totals = await reportMonthMovements({
        db,
        companyId,
        startInclusive: start.toISOString().slice(0, 10),
        endExclusive: end.toISOString().slice(0, 10)
      });

      return res.json({ month, company_id: companyId, ...totals });
    } catch (error) {
      console.error("report-month error:", error);
      return sendError(res, error, "Unable to calculate report.");
    }
  });

  // ── Lookups ───────────────────────────────────────────────────────

  router.get("/accounts", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const accounts = await listAccounts({ db, companyId });
      return res.json({ accounts });
    } catch (error) {
      console.error("list-accounts error:", error);
      return sendError(res, error, "Unable to list accounts.");
    }
  });

  router.get("/expense-categories", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const categories = await listExpenseCategories({ db, companyId });
      return res.json({ categories });
    } catch (error) {
      console.error("list-expense-categories error:", error);
      return sendError(res, error, "Unable to list expense categories.");
    }
  });

  return router;
}