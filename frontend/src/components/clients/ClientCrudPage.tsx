import { PartnerCrudPage } from "../partners/PartnerCrudPage";

export function ClientCrudPage() {
  return (
    <PartnerCrudPage
      partnerType="client"
      accent="cyan"
      eyebrow=""
      title="Clientes"
      description=""
      createLabel="Agregar cliente"
      recordLabel="cliente"
      searchPlaceholder="Nombre, RFC, contacto..."
      emptyTitle="No se encontraron clientes"
      emptyDescription="Crea tu primer cliente y aparecera aqui al instante."
    />
  );
}
