import { MovementCrudPage } from "../../components/movements/MovementCrudPage";

const MOVEMENT_KIND_LABELS = {
  expense: "Gasto general",
  supplier_payment: "Pago a proveedor",
  fuel_expense: "Gasolina",
  payroll_payment: "Nomina",
  bank_fee: "Comision bancaria",
  tax_payment: "Pago de impuestos"
} as const;

export default function ExpensesPage() {
  return (
    <MovementCrudPage
      direction="out"
      accent="rose"
      eyebrow="Expenses"
      title="Expense records"
      description="Keep outgoing movements in view with a cleaner table, fast modal edits and a safer delete flow."
      totalLabel="Loaded expenses"
      totalHint="Sum of the latest records loaded from the backend."
      createLabel="Add expense"
      editLabel="Edit expense record"
      recordLabel="expense record"
      emptyTitle="No expense records found"
      emptyDescription="Create your first expense entry and it will show up here instantly."
      defaultMovementKind="expense"
      movementKindOptions={[
        { value: "expense", label: "Gasto general" },
        { value: "supplier_payment", label: "Pago a proveedor" },
        { value: "fuel_expense", label: "Gasolina" },
        { value: "payroll_payment", label: "Nomina" },
        { value: "bank_fee", label: "Comision bancaria" },
        { value: "tax_payment", label: "Pago de impuestos" }
      ]}
      movementKindLabels={MOVEMENT_KIND_LABELS}
      amountToneClass="text-rose-300"
    />
  );
}