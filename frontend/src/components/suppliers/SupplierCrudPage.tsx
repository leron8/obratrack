import { PartnerCrudPage } from "../partners/PartnerCrudPage";

export function SupplierCrudPage() {
  return (
    <PartnerCrudPage
      partnerType="supplier"
      accent="amber"
      eyebrow=""
      title="Proveedores"
      description=""
      createLabel="Agregar proveedor"
      recordLabel="proveedor"
      searchPlaceholder="Nombre, RFC, contacto..."
      emptyTitle="No se encontraron proveedores"
      emptyDescription="Crea tu primer proveedor y aparecera aqui al instante."
    />
  );
}
