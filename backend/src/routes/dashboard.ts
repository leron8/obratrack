import express from "express";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardSummary } from "../services/supabase";

export function createDashboardRouter({ db }: { db: SupabaseClient }) {
  const router = express.Router();

  router.get("/dashboard", async (req, res) => {
    const companyId = req.companyId;
    if (!companyId) {
      return res.status(400).json({ error: "Missing company_id on request." });
    }

    try {
      const summary = await getDashboardSummary({ db, companyId, limit: 8 });
      return res.json(summary);
    } catch (error) {
      console.error("Dashboard summary error:", error, { companyId });
      const message = error instanceof Error ? error.message : "Unable to fetch dashboard summary.";
      return res.status(500).json({ error: message });
    }
  });

  return router;
}