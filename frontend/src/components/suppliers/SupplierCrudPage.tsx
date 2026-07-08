import { PartnerCrudPage } from "../partners/PartnerCrudPage";

export function SupplierCrudPage() {
  return (
    <PartnerCrudPage
      partnerType="supplier"
      accent="amber"
      eyebrow="Proveedores"
      title="Catalogo de proveedores"
      description="Centraliza tu directorio de proveedores con el mismo flujo de captura, edicion y baja logica que ya usamos para clientes y otras pantallas del sistema."
      createLabel="Agregar proveedor"
      recordLabel="proveedor"
      searchPlaceholder="Nombre, RFC, contacto..."
      emptyTitle="No se encontraron proveedores"
      emptyDescription="Crea tu primer proveedor y aparecera aqui al instante."
    />
  );
}
