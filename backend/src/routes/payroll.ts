import type { SupabaseClient } from "@supabase/supabase-js";
import express from "express";
import { z } from "zod";
import {
  createPayrollLine,
  createPayrollRun,
  deletePayrollLine,
  deletePayrollRun,
  getPayrollRun,
  listEmployeeLoanBalances,
  listPayrollLines,
  listPayrollRuns,
  updatePayrollLine,
  updatePayrollRun
} from "../services/supabase";
import type { Env } from "../env";
import type { PayrollStatus, PaymentMethod } from "@expenses/shared";
import { RequestError, getRequestDb, getRequestedRole, sendError } from "./http-helpers";

const PayrollStatusSchema = z.enum(["draft", "approved", "paid", "cancelled"]);
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

const NullableDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable().optional()
);

const NullablePositiveNumberSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().min(0).nullable().optional()
);

const NullablePositiveIntegerSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.coerce.number().int().min(1).nullable().optional()
);

const PayrollRunWriteSchema = z
  .object({
    run_number: NullableStringSchema,
    week_number: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().int().min(1).max(53).nullable().optional()),
    period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
    period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD."),
    status: PayrollStatusSchema.optional().default("draft"),
    description: NullableStringSchema
  })
  .strip();

const PayrollRunUpdateSchema = z
  .object({
    run_number: NullableStringSchema,
    week_number: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().int().min(1).max(53).nullable().optional()),
    period_start: NullableDateSchema,
    period_end: NullableDateSchema,
    status: PayrollStatusSchema.optional(),
    description: NullableStringSchema
  })
  .strip();

const PayrollLineWriteSchema = z
  .object({
    employee_id: NullableUuidSchema,
    worker_name: NullableStringSchema,
    project_id: NullableUuidSchema,
    cost_center_id: NullableUuidSchema,
    role_or_task: NullableStringSchema,
    days_worked: NullablePositiveNumberSchema,
    gross_amount: z.coerce.number().min(0),
    loan_deduction_amount: z.coerce.number().min(0).optional().default(0),
    other_deduction_amount: z.coerce.number().min(0).optional().default(0),
    payment_method: PaymentMethodSchema.optional().default("cash"),
    notes: NullableStringSchema,
    source_row: NullablePositiveIntegerSchema
  })
  .strip();

const PayrollLineUpdateSchema = z
  .object({
    employee_id: NullableUuidSchema,
    worker_name: NullableStringSchema,
    project_id: NullableUuidSchema,
    cost_center_id: NullableUuidSchema,
    role_or_task: NullableStringSchema,
    days_worked: NullablePositiveNumberSchema,
    gross_amount: z.coerce.number().min(0).optional(),
    loan_deduction_amount: z.coerce.number().min(0).optional(),
    other_deduction_amount: z.coerce.number().min(0).optional(),
    payment_method: PaymentMethodSchema.optional(),
    notes: NullableStringSchema,
    source_row: NullablePositiveIntegerSchema
  })
  .strip();

function normalizePayrollRunPayload({
  payload,
  isUpdate = false
}: {
  payload: Record<string, unknown>;
  isUpdate?: boolean;
}) {
  const parsed = (isUpdate ? PayrollRunUpdateSchema : PayrollRunWriteSchema).parse(payload);
  const normalized = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));

  if (!isUpdate && normalized.period_start && normalized.period_end) {
    ensurePeriodOrder({
      periodStart: String(normalized.period_start),
      periodEnd: String(normalized.period_end)
    });
  }

  if (isUpdate && normalized.period_start && normalized.period_end) {
    ensurePeriodOrder({
      periodStart: String(normalized.period_start),
      periodEnd: String(normalized.period_end)
    });
  }

  if (Object.keys(normalized).length === 0) {
    throw new RequestError(400, "No valid payroll run fields provided.");
  }

  return normalized;
}

function ensurePeriodOrder({
  periodStart,
  periodEnd
}: {
  periodStart: string;
  periodEnd: string;
}) {
  if (periodEnd < periodStart) {
    throw new RequestError(400, "`period_end` must be on or after `period_start`.");
  }
}

function normalizePayrollLinePayload({
  payload,
  isUpdate = false
}: {
  payload: Record<string, unknown>;
  isUpdate?: boolean;
}) {
  const parsed = (isUpdate ? PayrollLineUpdateSchema : PayrollLineWriteSchema).parse(payload);
  const normalized = Object.fromEntries(Object.entries(parsed).filter(([, value]) => value !== undefined));
  ensureNonNegativeNet({
    grossAmount: normalized.gross_amount as number | undefined,
    loanDeductionAmount: normalized.loan_deduction_amount as number | undefined,
    otherDeductionAmount: normalized.other_deduction_amount as number | undefined
  });

  if (Object.keys(normalized).length === 0) {
    throw new RequestError(400, "No valid payroll line fields provided.");
  }

  return normalized;
}

function ensureNonNegativeNet({
  grossAmount,
  loanDeductionAmount,
  otherDeductionAmount
}: {
  grossAmount?: number;
  loanDeductionAmount?: number;
  otherDeductionAmount?: number;
}) {
  if (grossAmount === undefined) return;
  const loan = loanDeductionAmount ?? 0;
  const other = otherDeductionAmount ?? 0;
  if (grossAmount - loan - other < 0) {
    throw new RequestError(400, "Payroll deductions cannot exceed the gross amount.");
  }
}

export function createPayrollRouter({
  env,
  db
}: {
  env: Env;
  db: SupabaseClient;
}) {
  const router = express.Router();

  router.get("/payroll-runs", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const limit = Number(req.query.limit ?? 80);
      const status =
        typeof req.query.status === "string"
          ? (PayrollStatusSchema.parse(req.query.status) as PayrollStatus)
          : undefined;

      const runs = await listPayrollRuns({
        db: getRequestDb(req, db),
        companyId,
        limit: Math.min(Math.max(limit, 1), 200),
        status
      });

      return res.json({ runs });
    } catch (error) {
      console.error("list-payroll-runs error:", error);
      return sendError(res, error, "Unable to list payroll runs.");
    }
  });

  router.get("/payroll-runs/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const run = await getPayrollRun({
        db: getRequestDb(req, db),
        companyId,
        payrollRunId: req.params.id
      });

      if (!run) {
        return res.status(404).json({ error: "Payroll run not found." });
      }

      return res.json({ run });
    } catch (error) {
      console.error("get-payroll-run error:", error);
      return sendError(res, error, "Unable to get payroll run.");
    }
  });

  router.post("/payroll-runs", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      if (getRequestedRole(req) !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const run = await createPayrollRun({
        db: getRequestDb(req, db),
        companyId,
        payload: normalizePayrollRunPayload({ payload: req.body as Record<string, unknown> })
      });

      return res.json({ run });
    } catch (error) {
      console.error("create-payroll-run error:", error);
      return sendError(res, error, "Unable to create payroll run.");
    }
  });

  router.put("/payroll-runs/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      if (getRequestedRole(req) !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const run = await updatePayrollRun({
        db: getRequestDb(req, db),
        companyId,
        payrollRunId: req.params.id,
        payload: normalizePayrollRunPayload({
          payload: req.body as Record<string, unknown>,
          isUpdate: true
        })
      });

      return res.json({ run });
    } catch (error) {
      console.error("update-payroll-run error:", error);
      return sendError(res, error, "Unable to update payroll run.");
    }
  });

  router.delete("/payroll-runs/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      if (getRequestedRole(req) !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deletePayrollRun({
        db: getRequestDb(req, db),
        companyId,
        payrollRunId: req.params.id
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-payroll-run error:", error);
      return sendError(res, error, "Unable to delete payroll run.");
    }
  });

  router.get("/payroll-runs/:id/lines", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const lines = await listPayrollLines({
        db: getRequestDb(req, db),
        companyId,
        payrollRunId: req.params.id
      });

      return res.json({ lines });
    } catch (error) {
      console.error("list-payroll-lines error:", error);
      return sendError(res, error, "Unable to list payroll lines.");
    }
  });

  router.post("/payroll-runs/:id/lines", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      if (getRequestedRole(req) !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const line = await createPayrollLine({
        db: getRequestDb(req, db),
        companyId,
        payrollRunId: req.params.id,
        payload: normalizePayrollLinePayload({ payload: req.body as Record<string, unknown> })
      });

      return res.json({ line });
    } catch (error) {
      console.error("create-payroll-line error:", error);
      return sendError(res, error, "Unable to create payroll line.");
    }
  });

  router.put("/payroll-lines/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      if (getRequestedRole(req) !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const line = await updatePayrollLine({
        db: getRequestDb(req, db),
        companyId,
        payrollLineId: req.params.id,
        payload: normalizePayrollLinePayload({
          payload: req.body as Record<string, unknown>,
          isUpdate: true
        })
      });

      return res.json({ line });
    } catch (error) {
      console.error("update-payroll-line error:", error);
      return sendError(res, error, "Unable to update payroll line.");
    }
  });

  router.delete("/payroll-lines/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      if (getRequestedRole(req) !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deletePayrollLine({
        db: getRequestDb(req, db),
        companyId,
        payrollLineId: req.params.id
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-payroll-line error:", error);
      return sendError(res, error, "Unable to delete payroll line.");
    }
  });

  router.get("/employee-loans/balances", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const balances = await listEmployeeLoanBalances({
        db: getRequestDb(req, db),
        companyId
      });

      return res.json({ balances });
    } catch (error) {
      console.error("list-employee-loan-balances error:", error);
      return sendError(res, error, "Unable to list employee loan balances.");
    }
  });

  return router;
}
