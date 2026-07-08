import express from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getProjectProfitability,
  getExpensesByProject,
  getIncomeByProject,
  getCashFlowReport,
  getSupplierCreditReport,
  getFuelConsumptionReport
} from "../services/supabase";

function getRequestDb(req: express.Request, fallback: SupabaseClient): SupabaseClient {
  return req.db ?? fallback;
}

export function createReportsRouter({ db }: { db: SupabaseClient }) {
  const router = express.Router();

  // ── Project Profitability (main report) ──────────────────────────────
  router.get("/reports/project-profitability", async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id on request." });
    }

    try {
      const { start_date, end_date, project_id } = req.query as Record<string, string | undefined>;
      const result = await getProjectProfitability({
        db: getRequestDb(req, db),
        companyId,
        startDate: start_date,
        endDate: end_date,
        projectId: project_id
      });
      return res.json(result);
    } catch (error) {
      console.error("Project profitability report error:", error, { companyId });
      const message = error instanceof Error ? error.message : "Unable to fetch project profitability report.";
      return res.status(500).json({ error: message });
    }
  });

  // ── Expenses by Project ──────────────────────────────────────────────
  router.get("/reports/expenses-by-project", async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id on request." });
    }

    try {
      const { start_date, end_date, project_id } = req.query as Record<string, string | undefined>;
      const result = await getExpensesByProject({
        db: getRequestDb(req, db),
        companyId,
        startDate: start_date,
        endDate: end_date,
        projectId: project_id
      });
      return res.json(result);
    } catch (error) {
      console.error("Expenses by project report error:", error, { companyId });
      const message = error instanceof Error ? error.message : "Unable to fetch expenses by project report.";
      return res.status(500).json({ error: message });
    }
  });

  // ── Income by Project ────────────────────────────────────────────────
  router.get("/reports/income-by-project", async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id on request." });
    }

    try {
      const { start_date, end_date, project_id } = req.query as Record<string, string | undefined>;
      const result = await getIncomeByProject({
        db: getRequestDb(req, db),
        companyId,
        startDate: start_date,
        endDate: end_date,
        projectId: project_id
      });
      return res.json(result);
    } catch (error) {
      console.error("Income by project report error:", error, { companyId });
      const message = error instanceof Error ? error.message : "Unable to fetch income by project report.";
      return res.status(500).json({ error: message });
    }
  });

  // ── Cash Flow ────────────────────────────────────────────────────────
  router.get("/reports/cash-flow", async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id on request." });
    }

    try {
      const { start_date, end_date, account_id } = req.query as Record<string, string | undefined>;
      const result = await getCashFlowReport({
        db: getRequestDb(req, db),
        companyId,
        startDate: start_date,
        endDate: end_date,
        accountId: account_id
      });
      return res.json(result);
    } catch (error) {
      console.error("Cash flow report error:", error, { companyId });
      const message = error instanceof Error ? error.message : "Unable to fetch cash flow report.";
      return res.status(500).json({ error: message });
    }
  });

  // ── Supplier Credit ──────────────────────────────────────────────────
  router.get("/reports/supplier-credit", async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id on request." });
    }

    try {
      const result = await getSupplierCreditReport({
        db: getRequestDb(req, db),
        companyId
      });
      return res.json(result);
    } catch (error) {
      console.error("Supplier credit report error:", error, { companyId });
      const message = error instanceof Error ? error.message : "Unable to fetch supplier credit report.";
      return res.status(500).json({ error: message });
    }
  });

  // ── Fuel Consumption ─────────────────────────────────────────────────
  router.get("/reports/fuel-consumption", async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id on request." });
    }

    try {
      const { start_date, end_date, project_id } = req.query as Record<string, string | undefined>;
      const result = await getFuelConsumptionReport({
        db: getRequestDb(req, db),
        companyId,
        startDate: start_date,
        endDate: end_date,
        projectId: project_id
      });
      return res.json(result);
    } catch (error) {
      console.error("Fuel consumption report error:", error, { companyId });
      const message = error instanceof Error ? error.message : "Unable to fetch fuel consumption report.";
      return res.status(500).json({ error: message });
    }
  });

  return router;
}