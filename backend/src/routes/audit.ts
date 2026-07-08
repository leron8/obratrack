import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import type { Env } from "../env";
import { createSupabaseClient, type AuditContext } from "../services/supabase";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstHeaderValue(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanUuid(value: unknown): string | null {
  const text = clean(value);
  return text && UUID_RE.test(text) ? text : null;
}

function getBodyValue(req: Request, key: string): string | null {
  if (!req.body || typeof req.body !== "object") return null;
  return clean((req.body as Record<string, unknown>)[key]);
}

function getAuditReason(req: Request): string | null {
  return (
    clean(req.header("x-audit-reason")) ??
    clean(req.query.audit_reason) ??
    clean(req.query.reason) ??
    getBodyValue(req, "audit_reason") ??
    getBodyValue(req, "reason")
  );
}

function getIdempotencyKey(req: Request): string | null {
  return (
    clean(req.header("idempotency-key")) ??
    clean(req.header("x-idempotency-key")) ??
    getBodyValue(req, "MessageSid")
  );
}

function getIpAddress(req: Request): string | null {
  const forwardedFor = firstHeaderValue(req.headers["x-forwarded-for"]);
  return clean(forwardedFor?.split(",")[0]) ?? clean(req.ip);
}

function getActorType(req: Request, actorProfileId: string | null, isWhatsAppWebhook: boolean): AuditContext["actorType"] {
  const raw = clean(req.header("x-actor-type"));
  if (raw === "user" || raw === "system" || raw === "whatsapp_contact" || raw === "import" || raw === "api") {
    return raw;
  }
  if (actorProfileId) return "user";
  return isWhatsAppWebhook ? "whatsapp_contact" : "api";
}

function buildAuditHeaders(context: AuditContext): Record<string, string> {
  const headers: Record<string, string | null> = {
    "x-audit-request-id": context.requestId,
    "x-audit-actor-profile-id": context.actorProfileId,
    "x-audit-actor-type": context.actorType,
    "x-audit-actor-label": context.actorLabel,
    "x-audit-source-module": context.sourceModule,
    "x-audit-ip-address": context.ipAddress,
    "x-audit-user-agent": context.userAgent,
    "x-audit-http-method": context.httpMethod,
    "x-audit-http-path": context.httpPath,
    "x-audit-reason": context.reason,
    "x-audit-idempotency-key": context.idempotencyKey
  };

  return Object.fromEntries(
    Object.entries(headers).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0
    )
  );
}

export function auditContextMiddleware(env: Env) {
  return (req: Request, res: Response, next: NextFunction) => {
    const isWhatsAppWebhook = req.path.includes("/webhook/whatsapp");
    const actorProfileId = cleanUuid(req.header("x-actor-profile-id")) ?? cleanUuid(req.header("x-user-id"));
    const actorType = getActorType(req, actorProfileId, isWhatsAppWebhook);

    const context: AuditContext = {
      requestId: clean(req.header("x-request-id")) ?? crypto.randomUUID(),
      actorProfileId,
      actorType,
      actorLabel:
        clean(req.header("x-actor-label")) ??
        clean(req.header("x-user-email")) ??
        clean(req.header("x-user-name")) ??
        (isWhatsAppWebhook ? getBodyValue(req, "From") : null),
      sourceModule: isWhatsAppWebhook ? "whatsapp" : clean(req.header("x-source-module")) ?? "api",
      ipAddress: getIpAddress(req),
      userAgent: clean(req.header("user-agent")),
      httpMethod: req.method,
      httpPath: req.originalUrl,
      reason: getAuditReason(req),
      idempotencyKey: getIdempotencyKey(req)
    };

    req.auditContext = context;
    req.db = createSupabaseClient({
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      globalHeaders: buildAuditHeaders(context)
    });
    res.setHeader("x-request-id", context.requestId);
    next();
  };
}
