import { MovementCrudPage } from "../../components/movements/MovementCrudPage";

const MOVEMENT_KIND_LABELS = {
  client_income: "Ingreso de cliente",
  cash_income: "Ingreso en efectivo",
  invoice_exchange: "Intercambio factura",
  partner_loan_repayment: "Pago prestamo socio",
  employee_loan_repayment: "Pago prestamo empleado"
} as const;

export default function IncomePage() {
  return (
    <MovementCrudPage
      direction="in"
      accent="cyan"
      eyebrow="Income"
      title="Income records"
      description="Review the latest incoming movements in a paginated table and manage them from polished modal flows."
      totalLabel="Loaded income"
      totalHint="Sum of the latest records loaded from the backend."
      createLabel="Add income"
      editLabel="Edit income record"
      recordLabel="income record"
      emptyTitle="No income records found"
      emptyDescription="Create your first income entry and it will show up here instantly."
      defaultMovementKind="client_income"
      movementKindOptions={[
        { value: "client_income", label: "Ingreso de cliente" },
        { value: "cash_income", label: "Ingreso en efectivo" },
        { value: "invoice_exchange", label: "Intercambio factura" },
        { value: "partner_loan_repayment", label: "Pago prestamo socio" },
        { value: "employee_loan_repayment", label: "Pago prestamo empleado" }
      ]}
      movementKindLabels={MOVEMENT_KIND_LABELS}
      amountToneClass="text-emerald-300"
    />
  );
}
