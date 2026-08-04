import type OpenAI from "openai";
import type { SupabaseClient } from "@supabase/supabase-js";
import express from "express";
import { downloadAudioToTempFile } from "../services/audio";
import { transcribeAudio, parseMovementText } from "../services/openai";
import {
  findOrCreateContact,
  getLatestPendingDraft,
  insertCaptureDraft,
  insertMovement,
  insertWhatsAppMessage,
  updateDraftStatus
} from "../services/supabase";
import type { Env } from "../env";
import type { WhatsAppCaptureTarget } from "@expenses/shared";

function twimlMsg(message: string): string {
  const escaped = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
  return '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + escaped + "</Message></Response>";
}

function getRequestDb(req: express.Request, fallback: SupabaseClient): SupabaseClient {
  return req.db ?? fallback;
}

export function createWhatsappRouter({
  env,
  openaiClient,
  db
}: {
  env: Env;
  openaiClient: OpenAI;
  db: SupabaseClient;
}) {
  const router = express.Router();

  router.post("/webhook/whatsapp", async (req, res) => {
    const body = req.body as any;
    const numMedia = Number(body.NumMedia ?? 0);
    const mediaUrl = body.MediaUrl0 as string | undefined;
    const fromWhatsapp = (body.From as string | undefined) ?? "";
    const toWhatsapp = (body.To as string | undefined) ?? "";
    const bodyText = (body.Body as string | undefined) ?? "";
    const twilioSid = (body.MessageSid as string | undefined) ?? null;
    const companyId = env.DEFAULT_COMPANY_ID;
    const requestDb = getRequestDb(req, db);

    try {
      if (!companyId) {
        res.type("text/xml").status(200).send(
          twimlMsg("La integración de WhatsApp no tiene una empresa configurada todavía.")
        );
        return;
      }

      if (!fromWhatsapp) {
        res.type("text/xml").status(200).send(
          "<Response><Message>No pude identificar el remitente.</Message></Response>"
        );
        return;
      }

      const contact = await findOrCreateContact({
        db: requestDb,
        companyId,
        phoneNumber: fromWhatsapp
      });

      const yesNoFromUser = (raw: string) => {
        const norm = raw
          .trim()
          .toUpperCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
        if (norm === "SI" || norm === "S") return "yes";
        if (norm === "NO" || norm === "N") return "no";
        return null;
      };

      if (numMedia === 0 && bodyText.trim().length > 0) {
        const decision = yesNoFromUser(bodyText);
        if (decision) {
          const confirmationMsg = await insertWhatsAppMessage({
            db: requestDb,
            companyId,
            contactId: contact.id,
            twilioMessageSid: twilioSid,
            direction: "inbound",
            messageKind: "confirmation",
            fromNumber: fromWhatsapp,
            toNumber: toWhatsapp,
            body: bodyText || null,
            transcript: bodyText.trim(),
            rawPayload: body
          });

          const pending = await getLatestPendingDraft({
            db: requestDb,
            companyId,
            contactId: contact.id
          });

          if (!pending) {
            res.type("text/xml").status(200).send(
              twimlMsg("No hay una confirmación pendiente para tu último mensaje.")
            );
            return;
          }

          if (decision === "yes") {
            const payload: Record<string, unknown> = {
              account_id: pending.account_id ?? null,
              movement_date: pending.movement_date ?? new Date().toISOString().slice(0, 10),
              direction: pending.direction ?? "out",
              movement_kind: pending.movement_kind ?? "expense",
              amount: pending.amount ?? 0,
              currency: pending.currency,
              payment_method: pending.payment_method ?? null,
              description: pending.description ?? null,
              business_partner_id: pending.business_partner_id ?? null,
              employee_id: pending.employee_id ?? null,
              project_id: pending.project_id ?? null,
              vehicle_id: pending.vehicle_id ?? null,
              expense_category_id: pending.expense_category_id ?? null,
              cost_center_id: pending.cost_center_id ?? null,
              source_module: "whatsapp"
            };

            const movement = await insertMovement({
              db: requestDb,
              companyId,
              payload,
              auditContext: req.auditContext
            });
            await updateDraftStatus({
              db: requestDb,
              draftId: pending.id,
              status: "confirmed",
              accountMovementId: movement.id,
              confirmationMessageId: confirmationMsg.id
            });

            res.type("text/xml").status(200).send(
              twimlMsg("Listo, guardé el registro correctamente ✓")
            );
            return;
          }

          await updateDraftStatus({
            db: requestDb,
            draftId: pending.id,
            status: "rejected",
            confirmationMessageId: confirmationMsg.id
          });
          res.type("text/xml").status(200).send(
            twimlMsg("Entendido, no se guardó el registro ✗")
          );
          return;
        }
      }

      let transcriptText: string;
      if (numMedia > 0 && mediaUrl) {
        const tmpPath = await downloadAudioToTempFile({
          mediaUrl,
          accountSid: env.TWILIO_ACCOUNT_SID,
          authToken: env.TWILIO_AUTH_TOKEN
        });

        try {
          transcriptText = await transcribeAudio({
            client: openaiClient,
            filePath: tmpPath,
            model: env.OPENAI_WHISPER_MODEL
          });
        } finally {
          void (async () => {
            try {
              const fs = await import("node:fs/promises");
              await fs.unlink(tmpPath);
            } catch {
              // ignore
            }
          })();
        }
      } else {
        transcriptText = bodyText.trim();
      }

      if (!transcriptText) {
        res.type("text/xml").status(200).send(
          twimlMsg("No recibí un mensaje de texto ni un audio válido.")
        );
        return;
      }

      const inboundMsg = await insertWhatsAppMessage({
        db: requestDb,
        companyId,
        contactId: contact.id,
        twilioMessageSid: twilioSid,
        direction: "inbound",
        messageKind: numMedia > 0 ? "audio" : "text",
        fromNumber: fromWhatsapp,
        toNumber: toWhatsapp,
        body: bodyText || null,
        mediaUrl: mediaUrl ?? null,
        transcript: transcriptText,
        rawPayload: body
      });

      const parsed = await parseMovementText({
        client: openaiClient,
        model: env.OPENAI_PARSING_MODEL,
        text: transcriptText,
        defaultCurrency: env.DEFAULT_CURRENCY
      });

      let targetType: WhatsAppCaptureTarget = "account_movement";
      if (parsed.movement_kind === "fuel_expense") {
        targetType = "fuel_transaction";
      } else if (parsed.movement_kind === "payroll_payment") {
        targetType = "payroll_line";
      }

      await insertCaptureDraft({
        db: requestDb,
        companyId,
        contactId: contact.id,
        sourceMessageId: inboundMsg.id,
        targetType,
        parsedPayload: parsed as unknown as Record<string, unknown>,
        transcript: transcriptText,
        parsed
      });

      const directionLabel = parsed.direction === "in" ? "Ingreso" : "Gasto";
      const kindLabels: Record<string, string> = {
        client_income: "Ingreso de cliente",
        expense: "Gasto general",
        fuel_expense: "Gasolina",
        payroll_payment: "Nómina",
        supplier_payment: "Pago a proveedor",
        bank_fee: "Comisión bancaria",
        tax_payment: "Pago de impuestos",
        internal_transfer: "Transferencia",
        adjustment: "Ajuste"
      };
      const kindLabel = kindLabels[parsed.movement_kind] ?? parsed.movement_kind;

      const summary = [
        "¿Confirmas este registro?",
        "Tipo: " + directionLabel + " (" + kindLabel + ")",
        "Monto: " + parsed.amount + " " + parsed.currency,
        "Descripción: " + parsed.description,
        "",
        "Responde SI para guardar o NO para descartar."
      ].join("\n");

      res.type("text/xml").status(200).send(twimlMsg(summary));
    } catch (err) {
      console.error("WhatsApp webhook processing error:", err);
      res.type("text/xml").status(200).send(
        twimlMsg("Ocurrió un error al procesar tu mensaje. Intenta de nuevo.")
      );
    }
  });

  return router;
}
