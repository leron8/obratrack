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
      eyebrow=""
      title="GASTOS"
      description=""
      totalLabel="MONTO TOTAL"
      totalHint=""
      createLabel="Agregar egreso"
      editLabel="Editar registro de egreso"
      recordLabel="registro de egreso"
      emptyTitle="No se encontraron registros de egresos"
      emptyDescription="Crea tu primer egreso y aparecera aqui al instante."
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
