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

function xmlEscape(s: string): string {
  const ent: Record<string, string> = {};
  ent["&"] = "&" + "amp;";
  ent["<"] = "&" + "lt;";
  ent[">"] = "&" + "gt;";
  ent['"'] = "&" + "quot;";
  ent["'"] = "&" + "apos;";
  return s.replace(/[&<>"']/g, (ch) => ent[ch] ?? ch);
}

function twimlMsg(message: string): string {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' +
    xmlEscape(message) +
    "</Message></Response>"
  );
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
    // Twilio hits this as `application/x-www-form-urlencoded`.
    const body = req.body as any;

    // Twilio fields (common):
    // - NumMedia, MediaUrl0, From, To, Body, etc.
    const numMedia = Number(body.NumMedia ?? 0);
    const mediaUrl = body.MediaUrl0 as string | undefined;
    const fromWhatsapp = (body.From as string | undefined) ?? "";
    const toWhatsapp = (body.To as string | undefined) ?? "";
    const bodyText = (body.Body as string | undefined) ?? "";
    const twilioSid = (body.MessageSid as string | undefined) ?? null;

    // For a demo: we store everything under DEFAULT_COMPANY_ID.
    const companyId = env.DEFAULT_COMPANY_ID;

    try {
      if (!fromWhatsapp) {
        res.type("text/xml").status(200).send(
          "<Response><Message>No pude identificar el remitente.</Message></Response>"
        );
        return;
      }

      // Find or create the WhatsApp contact
      const contact = await findOrCreateContact({
        db,
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

      // 1) If user replied "SI/NO", resolve the latest pending draft.
      if (numMedia === 0 && bodyText.trim().length > 0) {
        const decision = yesNoFromUser(bodyText);
        if (decision) {
          const pending = await getLatestPendingDraft({
            db,
            companyId,
            contactId: contact.id
          });

          if (!pending) {
            res.type("text/xml").status(200).send(
              twimlMsg("No hay una confirmaci\u00F3n pendiente para tu \u00FAltimo mensaje.")
            );
            return;
          }

          if (decision === "yes") {
            // Create the account movement from the draft data
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

            const movement = await insertMovement({ db, companyId, payload });

            // Update draft status to confirmed
            await updateDraftStatus({
              db,
              draftId: pending.id,
              status: "confirmed",
              accountMovementId: movement.id
            });

            res.type("text/xml").status(200).send(
              twimlMsg("Listo, guard\u00E9 el registro correctamente \u2705")
            );
            return;
          }

          await updateDraftStatus({
            db,
            draftId: pending.id,
            status: "rejected"
          });
          res.type("text/xml").status(200).send(
            twimlMsg("Entendido, no se guard\u00F3 el registro \u274C")
          );
          return;
        }
      }

      // 2) Otherwise, interpret this message as a new movement request:
      //    - If there's audio: download + Whisper -> transcript
      //    - If it's text: use Body as transcript
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
          // Best-effort cleanup.
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
          twimlMsg("No recib\u00ED un mensaje de texto ni un audio v\u00E1lido.")
        );
        return;
      }

      // Store the inbound message
      const inboundMsg = await insertWhatsAppMessage({
        db,
        companyId,
        contactId: contact.id,
        twilioMessageSid: twilioSid,
        direction: "inbound",
        messageKind: numMedia > 0 ? "audio" : "text",
        fromNumber: fromWhatsapp,
        toNumber: toWhatsapp,
        body: bodyText || null,
        mediaUrl: mediaUrl ?? null,
        transcript: transcriptText
      });

      const parsed = await parseMovementText({
        client: openaiClient,
        model: env.OPENAI_PARSING_MODEL,
        text: transcriptText,
        defaultCurrency: env.DEFAULT_CURRENCY
      });

      // Determine target type based on movement_kind
      let targetType: WhatsAppCaptureTarget = "account_movement";
      if (parsed.movement_kind === "fuel_expense") {
        targetType = "fuel_transaction";
      } else if (parsed.movement_kind === "payroll_payment") {
        targetType = "payroll_line";
      }

      // Store as pending capture draft before inserting into account_movements
      await insertCaptureDraft({
        db,
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
        payroll_payment: "N\u00F3mina",
        supplier_payment: "Pago a proveedor",
        bank_fee: "Comisi\u00F3n bancaria",
        tax_payment: "Pago de impuestos",
        internal_transfer: "Transferencia",
        adjustment: "Ajuste"
      };
      const kindLabel = kindLabels[parsed.movement_kind] ?? parsed.movement_kind;

      const summary = [
        "\u00BFConfirmas este registro?",
        "Tipo: " + directionLabel + " (" + kindLabel + ")",
        "Monto: " + parsed.amount + " " + parsed.currency,
        "Descripci\u00F3n: " + parsed.description,
        "",
        "Responde SI para guardar o NO para descartar."
      ].join("\n");

      res.type("text/xml").status(200).send(twimlMsg(summary));
    } catch (err) {
      console.error("WhatsApp webhook processing error:", err);
      res.type("text/xml").status(200).send(
        twimlMsg("Ocurri\u00F3 un error al procesar tu mensaje. Intenta de nuevo.")
      );
    }
  });

  return router;
}