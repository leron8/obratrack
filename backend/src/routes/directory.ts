import type { SupabaseClient } from "@supabase/supabase-js";
import express from "express";
import { z } from "zod";
import {
  createBusinessPartner,
  createEmployee,
  createVehicle,
  deleteBusinessPartner,
  deleteEmployee,
  deleteVehicle,
  getBusinessPartner,
  getEmployee,
  getVehicle,
  listBusinessPartners,
  listEmployees,
  listVehicles,
  updateBusinessPartner,
  updateEmployee,
  updateVehicle
} from "../services/supabase";
import type { EmployeeStatus, PartnerType, WorkerType } from "@expenses/shared";
import type { Env } from "../env";
import { RequestError, getRequestDb, getRequestedRole, sendError } from "./http-helpers";

const PartnerTypeSchema = z.enum(["client", "supplier", "lender", "contractor", "other"]);
const WorkerTypeSchema = z.enum(["employee", "contractor", "destajista", "partner"]);
const EmployeeStatusSchema = z.enum(["active", "inactive", "terminated"]);

const NullableStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() || null : value),
  z.string().nullable().optional()
);

const OptionalStringSchema = z.preprocess(
  (value) => (typeof value === "string" ? value.trim() : value),
  z.string().min(1).optional()
);

const NullableDateSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD.").nullable().optional()
);

const NullableUuidSchema = z.preprocess(
  (value) => (value === "" ? null : value),
  z.string().uuid().nullable().optional()
);

const BusinessPartnerWriteSchema = z
  .object({
    partner_type: PartnerTypeSchema,
    name: z.string().trim().min(1, "Partner name is required.").max(180),
    legal_name: NullableStringSchema,
    rfc: NullableStringSchema,
    tax_regime: NullableStringSchema,
    fiscal_postal_code: NullableStringSchema,
    email: NullableStringSchema,
    phone: NullableStringSchema,
    contact_name: NullableStringSchema,
    address: NullableStringSchema,
    status: OptionalStringSchema.default("active"),
    notes: NullableStringSchema
  })
  .strip();

const BusinessPartnerUpdateSchema = z
  .object({
    partner_type: PartnerTypeSchema.optional(),
    name: z.string().trim().min(1, "Partner name is required.").max(180).optional(),
    legal_name: NullableStringSchema,
    rfc: NullableStringSchema,
    tax_regime: NullableStringSchema,
    fiscal_postal_code: NullableStringSchema,
    email: NullableStringSchema,
    phone: NullableStringSchema,
    contact_name: NullableStringSchema,
    address: NullableStringSchema,
    status: OptionalStringSchema,
    notes: NullableStringSchema
  })
  .strip();

const EmployeeWriteSchema = z
  .object({
    employee_code: NullableStringSchema,
    worker_type: WorkerTypeSchema.optional().default("employee"),
    first_name: z.string().trim().min(1, "First name is required.").max(120),
    last_name: NullableStringSchema,
    rfc: NullableStringSchema,
    curp: NullableStringSchema,
    nss: NullableStringSchema,
    email: NullableStringSchema,
    phone: NullableStringSchema,
    position: NullableStringSchema,
    default_daily_rate: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().min(0).nullable().optional()),
    default_weekly_salary: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().min(0).nullable().optional()),
    status: EmployeeStatusSchema.optional().default("active"),
    hire_date: NullableDateSchema,
    termination_date: NullableDateSchema,
    notes: NullableStringSchema
  })
  .strip();

const EmployeeUpdateSchema = z
  .object({
    employee_code: NullableStringSchema,
    worker_type: WorkerTypeSchema.optional(),
    first_name: z.string().trim().min(1, "First name is required.").max(120).optional(),
    last_name: NullableStringSchema,
    rfc: NullableStringSchema,
    curp: NullableStringSchema,
    nss: NullableStringSchema,
    email: NullableStringSchema,
    phone: NullableStringSchema,
    position: NullableStringSchema,
    default_daily_rate: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().min(0).nullable().optional()),
    default_weekly_salary: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().min(0).nullable().optional()),
    status: EmployeeStatusSchema.optional(),
    hire_date: NullableDateSchema,
    termination_date: NullableDateSchema,
    notes: NullableStringSchema
  })
  .strip();

const VehicleWriteSchema = z
  .object({
    plate: NullableStringSchema,
    economic_number: NullableStringSchema,
    vin: NullableStringSchema,
    brand: NullableStringSchema,
    model_name: z.string().trim().min(1, "Model name is required.").max(180),
    model_year: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().int().min(1900).max(2100).nullable().optional()),
    color: NullableStringSchema,
    vehicle_type: NullableStringSchema,
    status: OptionalStringSchema.default("active"),
    purchase_date: NullableDateSchema,
    purchase_value: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().min(0).nullable().optional()),
    default_project_id: NullableUuidSchema,
    responsible_employee_id: NullableUuidSchema,
    notes: NullableStringSchema
  })
  .strip();

const VehicleUpdateSchema = z
  .object({
    plate: NullableStringSchema,
    economic_number: NullableStringSchema,
    vin: NullableStringSchema,
    brand: NullableStringSchema,
    model_name: z.string().trim().min(1, "Model name is required.").max(180).optional(),
    model_year: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().int().min(1900).max(2100).nullable().optional()),
    color: NullableStringSchema,
    vehicle_type: NullableStringSchema,
    status: OptionalStringSchema,
    purchase_date: NullableDateSchema,
    purchase_value: z.preprocess((value) => (value === "" ? null : value), z.coerce.number().min(0).nullable().optional()),
    default_project_id: NullableUuidSchema,
    responsible_employee_id: NullableUuidSchema,
    notes: NullableStringSchema
  })
  .strip();

function normalizePayload<T extends Record<string, unknown>>({
  payload,
  schema,
  typeLabel
}: {
  payload: Record<string, unknown>;
  schema: z.ZodType<T>;
  typeLabel: string;
}) {
  const parsed = schema.parse(payload);
  const normalized: Record<string, unknown> = Object.fromEntries(
    Object.entries(parsed).filter(([, value]) => value !== undefined)
  );

  if (Object.keys(normalized).length === 0) {
    throw new RequestError(400, `No valid ${typeLabel} fields provided.`);
  }

  return normalized;
}

function normalizeEmployeePayload({
  payload,
  isUpdate = false
}: {
  payload: Record<string, unknown>;
  isUpdate?: boolean;
}) {
  const normalized = normalizePayload({
    payload,
    schema: isUpdate ? EmployeeUpdateSchema : EmployeeWriteSchema,
    typeLabel: "employee"
  });

  if (normalized.last_name === null) {
    normalized.last_name = "";
  }

  const shouldClearTerminationDate =
    (!isUpdate && normalized.status !== "terminated") ||
    (isUpdate && normalized.status !== undefined && normalized.status !== "terminated");

  if (shouldClearTerminationDate && !("termination_date" in normalized)) {
    normalized.termination_date = null;
  }

  return normalized;
}

function normalizeVehiclePayload({
  payload,
  isUpdate = false
}: {
  payload: Record<string, unknown>;
  isUpdate?: boolean;
}) {
  return normalizePayload({
    payload,
    schema: isUpdate ? VehicleUpdateSchema : VehicleWriteSchema,
    typeLabel: "vehicle"
  });
}

export function createDirectoryRouter({
  env,
  db
}: {
  env: Env;
  db: SupabaseClient;
}) {
  const router = express.Router();

  router.get("/business-partners", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const limit = Number(req.query.limit ?? 200);
      const partnerType =
        typeof req.query.partner_type === "string"
          ? (PartnerTypeSchema.parse(req.query.partner_type) as PartnerType)
          : undefined;
      const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;

      const partners = await listBusinessPartners({
        db: getRequestDb(req, db),
        companyId,
        partnerType
      });

      const filtered = status ? partners.filter((partner) => partner.status === status) : partners;
      return res.json({ partners: filtered.slice(0, Math.min(Math.max(limit, 1), 500)) });
    } catch (error) {
      console.error("list-business-partners error:", error);
      return sendError(res, error, "Unable to list business partners.");
    }
  });

  router.get("/business-partners/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const partner = await getBusinessPartner({
        db: getRequestDb(req, db),
        companyId,
        partnerId: req.params.id
      });

      if (!partner) {
        return res.status(404).json({ error: "Business partner not found." });
      }

      return res.json({ partner });
    } catch (error) {
      console.error("get-business-partner error:", error);
      return sendError(res, error, "Unable to get business partner.");
    }
  });

  router.post("/business-partners", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const partner = await createBusinessPartner({
        db: getRequestDb(req, db),
        companyId,
        payload: normalizePayload({
          payload: req.body as Record<string, unknown>,
          schema: BusinessPartnerWriteSchema,
          typeLabel: "business partner"
        })
      });

      return res.json({ partner });
    } catch (error) {
      console.error("create-business-partner error:", error);
      return sendError(res, error, "Unable to create business partner.");
    }
  });

  router.put("/business-partners/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const partner = await updateBusinessPartner({
        db: getRequestDb(req, db),
        companyId,
        partnerId: req.params.id,
        payload: normalizePayload({
          payload: req.body as Record<string, unknown>,
          schema: BusinessPartnerUpdateSchema,
          typeLabel: "business partner"
        })
      });

      return res.json({ partner });
    } catch (error) {
      console.error("update-business-partner error:", error);
      return sendError(res, error, "Unable to update business partner.");
    }
  });

  router.delete("/business-partners/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deleteBusinessPartner({
        db: getRequestDb(req, db),
        companyId,
        partnerId: req.params.id
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-business-partner error:", error);
      return sendError(res, error, "Unable to delete business partner.");
    }
  });

  router.get("/employees", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const limit = Number(req.query.limit ?? 200);
      const status =
        typeof req.query.status === "string"
          ? (EmployeeStatusSchema.parse(req.query.status) as EmployeeStatus)
          : undefined;

      const employees = await listEmployees({
        db: getRequestDb(req, db),
        companyId,
        limit: Math.min(Math.max(limit, 1), 500),
        status
      });

      return res.json({ employees });
    } catch (error) {
      console.error("list-employees error:", error);
      return sendError(res, error, "Unable to list employees.");
    }
  });

  router.get("/employees/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const employee = await getEmployee({
        db: getRequestDb(req, db),
        companyId,
        employeeId: req.params.id
      });

      if (!employee) {
        return res.status(404).json({ error: "Employee not found." });
      }

      return res.json({ employee });
    } catch (error) {
      console.error("get-employee error:", error);
      return sendError(res, error, "Unable to get employee.");
    }
  });

  router.post("/employees", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const employee = await createEmployee({
        db: getRequestDb(req, db),
        companyId,
        payload: normalizeEmployeePayload({ payload: req.body as Record<string, unknown> })
      });

      return res.json({ employee });
    } catch (error) {
      console.error("create-employee error:", error);
      return sendError(res, error, "Unable to create employee.");
    }
  });

  router.put("/employees/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const employee = await updateEmployee({
        db: getRequestDb(req, db),
        companyId,
        employeeId: req.params.id,
        payload: normalizeEmployeePayload({
          payload: req.body as Record<string, unknown>,
          isUpdate: true
        })
      });

      return res.json({ employee });
    } catch (error) {
      console.error("update-employee error:", error);
      return sendError(res, error, "Unable to update employee.");
    }
  });

  router.delete("/employees/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deleteEmployee({
        db: getRequestDb(req, db),
        companyId,
        employeeId: req.params.id
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-employee error:", error);
      return sendError(res, error, "Unable to delete employee.");
    }
  });

  router.get("/vehicles", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const limit = Number(req.query.limit ?? 200);
      const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;

      const vehicles = await listVehicles({
        db: getRequestDb(req, db),
        companyId,
        limit: Math.min(Math.max(limit, 1), 500),
        status
      });

      return res.json({ vehicles });
    } catch (error) {
      console.error("list-vehicles error:", error);
      return sendError(res, error, "Unable to list vehicles.");
    }
  });

  router.get("/vehicles/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const vehicle = await getVehicle({
        db: getRequestDb(req, db),
        companyId,
        vehicleId: req.params.id
      });

      if (!vehicle) {
        return res.status(404).json({ error: "Vehicle not found." });
      }

      return res.json({ vehicle });
    } catch (error) {
      console.error("get-vehicle error:", error);
      return sendError(res, error, "Unable to get vehicle.");
    }
  });

  router.post("/vehicles", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const vehicle = await createVehicle({
        db: getRequestDb(req, db),
        companyId,
        payload: normalizeVehiclePayload({ payload: req.body as Record<string, unknown> })
      });

      return res.json({ vehicle });
    } catch (error) {
      console.error("create-vehicle error:", error);
      return sendError(res, error, "Unable to create vehicle.");
    }
  });

  router.put("/vehicles/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      const vehicle = await updateVehicle({
        db: getRequestDb(req, db),
        companyId,
        vehicleId: req.params.id,
        payload: normalizeVehiclePayload({
          payload: req.body as Record<string, unknown>,
          isUpdate: true
        })
      });

      return res.json({ vehicle });
    } catch (error) {
      console.error("update-vehicle error:", error);
      return sendError(res, error, "Unable to update vehicle.");
    }
  });

  router.delete("/vehicles/:id", async (req, res) => {
    try {
      const companyId = req.companyId ?? env.DEFAULT_COMPANY_ID;
      const role = getRequestedRole(req);
      if (role !== "admin") {
        return res.status(403).json({ error: "Admin role required for write operations." });
      }

      await deleteVehicle({
        db: getRequestDb(req, db),
        companyId,
        vehicleId: req.params.id
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error("delete-vehicle error:", error);
      return sendError(res, error, "Unable to delete vehicle.");
    }
  });

  return router;
}
