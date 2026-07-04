import OpenAI from "openai";
import fs from "node:fs";
import type { ParsedMovement } from "@expenses/shared";

export function createOpenAIClient(apiKey: string) {
  return new OpenAI({ apiKey });
}

export async function transcribeAudio({
  client,
  filePath,
  model
}: {
  client: OpenAI;
  filePath: string;
  model: string;
}): Promise<string> {
  const fileStream = fs.createReadStream(filePath);
  const result = await client.audio.transcriptions.create({
    file: fileStream,
    model
  });
  return result.text;
}

export async function parseMovementText({
  client,
  model,
  text,
  defaultCurrency
}: {
  client: OpenAI;
  model: string;
  text: string;
  defaultCurrency: string;
}): Promise<ParsedMovement> {
  const prompt = `
Eres un asistente que extrae movimientos financieros estructurados a partir de lenguaje natural en español.

Reglas:
- Determina "direction" según el significado del texto:
  * "Ingreso", "recibí", "depósito", "pago de cliente" => "in"
  * "Gasto", "pagué", "compra", "gasolina", "nómina" => "out"
- Determina "movement_kind" según el tipo de movimiento:
  * Ingresos de clientes => "client_income"
  * Gastos generales => "expense"
  * Combustible/gasolina => "fuel_expense"
  * Nómina/salarios => "payroll_payment"
  * Transferencias entre cuentas => "internal_transfer"
  * Pago a proveedores => "supplier_payment"
  * Comisiones bancarias => "bank_fee"
  * Pago de impuestos => "tax_payment"
  * Otros => "adjustment"
- Extrae "amount" como número (sin símbolo de moneda).
- Extrae "currency". Si no está presente, usa "${defaultCurrency}".
- Extrae "description" como una descripción concisa del movimiento en español.
- "payment_method" puede ser: "cash", "bank_transfer", "card", "cheque", "fuel_card", "credit", "payroll_discount", "other"

Devuelve SOLO JSON válido con esta forma:
{
  "direction": "in" | "out",
  "movement_kind": "client_income" | "expense" | "fuel_expense" | "payroll_payment" | "internal_transfer" | "supplier_payment" | "bank_fee" | "tax_payment" | "adjustment",
  "amount": number,
  "currency": string,
  "description": string,
  "payment_method": "cash" | "bank_transfer" | "card" | "cheque" | "fuel_card" | "credit" | "payroll_discount" | "other" | null
}

Texto:
${text}
`.trim();

  const resp = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Return strictly valid JSON." },
      { role: "user", content: prompt }
    ],
    temperature: 0,
    response_format: { type: "json_object" }
  });

  const content = resp.choices[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as ParsedMovement;

  // Normalization
  parsed.amount = Math.abs(Number(parsed.amount));
  parsed.currency = parsed.currency || defaultCurrency;
  parsed.direction = parsed.direction === "in" ? "in" : "out";
  parsed.description = parsed.description || text;

  return parsed;
}