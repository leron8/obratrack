import express from "express";
import { z } from "zod";
import { CompleteOnboardingDtoSchema } from "../modules/auth/dto/complete-onboarding.dto";
import { AuthService } from "../modules/auth/services/auth.service";
import { sendError } from "./http-helpers";

const ActiveCompanyDtoSchema = z.object({
  company_id: z.string().uuid()
});

export function createAuthRouter({ authService }: { authService: AuthService }) {
  const router = express.Router();

  router.get("/auth/session", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication is required." });
      }

      const session = await authService.getSessionSnapshot(req.authUser);
      return res.json(session);
    } catch (error) {
      return sendError(res, error, "Unable to load the authenticated session.");
    }
  });

  router.post("/auth/onboarding", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication is required." });
      }

      const payload = CompleteOnboardingDtoSchema.parse(req.body);
      const session = await authService.completeOnboarding(req.authUser, payload);
      return res.status(201).json(session);
    } catch (error) {
      return sendError(res, error, "Unable to complete onboarding.");
    }
  });

  router.put("/auth/active-company", async (req, res) => {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: "Authentication is required." });
      }

      const payload = ActiveCompanyDtoSchema.parse(req.body);
      const session = await authService.setActiveCompany(req.authUser, payload.company_id);
      return res.json(session);
    } catch (error) {
      return sendError(res, error, "Unable to change the active company.");
    }
  });

  return router;
}
