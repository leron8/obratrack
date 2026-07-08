import { MovementCrudPage } from "../../components/movements/MovementCrudPage";

const MOVEMENT_KIND_LABELS = {
  client_income: "Ingreso de cliente",
  cash_income: "Ingreso en efectivo",
  invoice_exchange: "Intercambio de factura",
  partner_loan_repayment: "Pago de prestamo de socio",
  employee_loan_repayment: "Pago de prestamo de empleado"
} as const;

export default function IncomePage() {
  return (
    <MovementCrudPage
      direction="in"
      accent="cyan"
      eyebrow="Ingresos"
      title="Registros de ingresos"
      description="Revisa los movimientos de entrada mas recientes en una tabla paginada y administralos desde flujos modales mas claros."
      totalLabel="Ingresos cargados"
      totalHint="Suma de los registros mas recientes cargados desde el backend."
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
        { value: "employee_loan_repayment", label: "Pago de prestamo de empleado" }
      ]}
      movementKindLabels={MOVEMENT_KIND_LABELS}
      amountToneClass="text-emerald-300"
    />
  );
}
