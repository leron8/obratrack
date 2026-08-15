import { MovementCrudPage } from "../../components/movements/MovementCrudPage";

const MOVEMENT_KIND_LABELS = {
  client_income: "Ingreso de cliente",
  cash_income: "Ingreso en efectivo",
  invoice_exchange: "Intercambio de factura",
  partner_loan_repayment: "Pago de prestamo de socio",
  employee_loan_repayment: "Pago de prestamo de empleado",
  credit_line_disbursement: "Dispersion de linea de credito"
} as const;

export default function IncomePage() {
  return (
    <MovementCrudPage
      direction="in"
      accent="cyan"
      eyebrow=""
      title="INGRESOS"
      description=""
      totalLabel="MONTO TOTAL"
      totalHint=""
      createLabel="Agregar ingreso"
      editLabel="Editar registro de ingreso"
      recordLabel="registro de ingreso"
      emptyTitle="No se encontraron registros de ingresos"
      emptyDescription="Crea tu primer ingreso y aparecera aqui al instante."
      defaultMovementKind="client_income"
      movementKindOptions={[
        { value: "client_income", label: "Ingreso de cliente" },
        { value: "cash_income", label: "Ingreso en efectivo" },
        { value: "invoice_exchange", label: "Intercambio de factura" },
        { value: "partner_loan_repayment", label: "Pago de prestamo de socio" },
        { value: "employee_loan_repayment", label: "Pago de prestamo de empleado" },
        { value: "credit_line_disbursement", label: "Dispersion de linea de credito" }
      ]}
      movementKindLabels={MOVEMENT_KIND_LABELS}
      amountToneClass="text-emerald-300"
    />
  );
}
